import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  Certificate,
  CertificateTemplate,
  Organization,
  Course,
  withPlatformContext,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { env } from '../config/env.js';

export class CertificateController {
  // Public Verification (No Auth Required)
  static async verifyCertificate(req, res, next) {
    try {
      const cert = await withPlatformContext(async (t) => {
        const record = await Certificate.findOne({
          where: {
            verification_code: req.params.code
          },
          include: [{ model: Organization, as: 'organization', attributes: ['name', 'slug'] }],
          transaction: t
        });
        if (!record) {
          const byNum = await Certificate.findOne({
            where: { certificate_number: req.params.code },
            include: [{ model: Organization, as: 'organization', attributes: ['name', 'slug'] }],
            transaction: t
          });
          return byNum;
        }
        return record;
      });

      if (!cert) throw new NotFoundError('Certificate');
      const isExpired = cert.expires_at && new Date(cert.expires_at) < new Date();
      const valid = !cert.revoked_at && !isExpired;

      return res.status(200).json({
        valid,
        status: cert.revoked_at ? 'revoked' : isExpired ? 'expired' : 'valid',
        certificate: {
          certificate_number: cert.certificate_number,
          verification_code: cert.verification_code,
          recipient_name: cert.recipient_name,
          course_title: cert.course_title,
          issued_at: cert.issued_at,
          expires_at: cert.expires_at,
          revoked_at: cert.revoked_at,
          revocation_reason: cert.revocation_reason,
          organization_name: cert.organization?.name,
          organization_slug: cert.organization?.slug
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listCertificates(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };
        if (req.permissionScope?.scope === 'self') {
          whereClause.membership_id = req.membership.id;
        }

        const certs = await Certificate.findAll({
          where: whereClause,
          include: [{ model: CertificateTemplate, as: 'template', attributes: ['name'] }],
          order: [['issued_at', 'DESC']],
          transaction: t
        });

        return certs.map((c) => ({
          ...c.toJSON(),
          template_name: c.template?.name || null
        }));
      });

      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async listTemplates(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        return CertificateTemplate.findAll({
          where: { organization_id: req.organizationId },
          order: [
            ['is_default', 'DESC'],
            ['created_at', 'DESC']
          ],
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async createTemplate(req, res, next) {
    try {
      const b = req.body;
      const row = await withTenantContext(req.organizationId, async (t) => {
        if (b.isDefault) {
          await CertificateTemplate.update(
            { is_default: false },
            { where: { organization_id: req.organizationId }, transaction: t }
          );
        }

        return CertificateTemplate.create(
          {
            organization_id: req.organizationId,
            name: b.name,
            title_text: b.titleText || 'Certificate of Completion',
            subtitle_text: b.subtitleText || 'This certifies that',
            body_template: b.bodyTemplate || 'has successfully completed {{course_title}} on {{issued_date}}.',
            signature_name: b.signatureName || null,
            signature_title: b.signatureTitle || null,
            accent_color: b.accentColor || '#2563eb',
            validity_days: b.validityDays || null,
            is_default: Boolean(b.isDefault)
          },
          { transaction: t }
        );
      });

      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPdf(req, res, next) {
    try {
      const cert = await withTenantContext(req.organizationId, async (t) => {
        const record = await Certificate.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          include: [{ model: CertificateTemplate, as: 'template' }],
          transaction: t
        });
        if (!record) throw new NotFoundError('Certificate');
        return record;
      });

      const qrUrl = `${env.API_BASE_URL}/api/v1/certificates/verify/${cert.verification_code}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 140 });
      const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

      const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${cert.certificate_number}.pdf"`);
      doc.pipe(res);

      const tpl = cert.template;
      const accent = tpl?.accent_color || '#2563eb';

      // Border
      doc.rect(20, 20, 782, 535).lineWidth(3).stroke(accent);
      doc.rect(26, 26, 770, 523).lineWidth(1).stroke('#cbd5e1');

      doc.moveDown(2);
      doc.fontSize(14).fillColor('#64748b').text((req.organization?.name || 'Enterprise LMS').toUpperCase(), { align: 'center', characterSpacing: 2 });
      doc.moveDown(0.5);
      doc.fontSize(28).fillColor('#0f172a').font('Helvetica-Bold').text(tpl?.title_text || 'Certificate of Completion', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica').fillColor('#64748b').text(tpl?.subtitle_text || 'This certifies that', { align: 'center' });
      doc.moveDown(0.8);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(accent).text(cert.recipient_name, { align: 'center' });
      doc.moveDown(0.8);

      const issuedDateStr = new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const bodyText = (tpl?.body_template || 'has successfully completed {{course_title}} on {{issued_date}}.')
        .replace('{{course_title}}', cert.course_title)
        .replace('{{issued_date}}', issuedDateStr);

      doc.fontSize(13).font('Helvetica').fillColor('#334155').text(bodyText, { align: 'center', width: 600, indent: 90 });
      doc.moveDown(3);

      doc.image(qrBuffer, 80, 410, { width: 90 });
      doc.fontSize(8).fillColor('#64748b').text('Scan to Verify Credential', 75, 505);
      doc.fontSize(8).text(`Code: ${cert.verification_code}`, 75, 517);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(tpl?.signature_name || 'Authorized Signatory', 540, 470, { align: 'center', width: 200 });
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(tpl?.signature_title || 'Chief Learning Officer', 540, 485, { align: 'center', width: 200 });
      doc.moveTo(540, 465).lineTo(740, 465).stroke('#cbd5e1');

      doc.end();
    } catch (err) {
      next(err);
    }
  }
}

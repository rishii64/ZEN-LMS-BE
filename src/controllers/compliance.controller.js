import { Op } from 'sequelize';
import {
  Enrollment,
  Certificate,
  Policy,
  PolicyAcknowledgement,
  EvidenceRecord,
  OrganizationMembership,
  User,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { auditFromReq } from '../services/audit.service.js';

export class ComplianceController {
  static async getOverview(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const totalMandatory = await Enrollment.count({
          where: { organization_id: req.organizationId, is_mandatory: true },
          transaction: t
        });
        const completedMandatory = await Enrollment.count({
          where: { organization_id: req.organizationId, is_mandatory: true, status: 'completed' },
          transaction: t
        });
        const overdueMandatory = await Enrollment.count({
          where: {
            organization_id: req.organizationId,
            is_mandatory: true,
            status: 'active',
            due_date: { [Op.lt]: new Date() }
          },
          transaction: t
        });

        const thirtyDaysAhead = new Date(Date.now() + 30 * 86400 * 1000);
        const expiredCerts = await Certificate.findAll({
          where: {
            organization_id: req.organizationId,
            expires_at: { [Op.lte]: thirtyDaysAhead },
            revoked_at: null
          },
          order: [['expires_at', 'ASC']],
          transaction: t
        });

        const policies = await Policy.findAll({
          where: { organization_id: req.organizationId, is_active: true },
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const evidence = await EvidenceRecord.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          limit: 50,
          transaction: t
        });

        return {
          summary: {
            total_mandatory: totalMandatory,
            completed_mandatory: completedMandatory,
            overdue_mandatory: overdueMandatory
          },
          expiringOrExpiredCertificates: expiredCerts,
          policies,
          evidenceRecords: evidence
        };
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async listPolicies(req, res, next) {
    try {
      const policies = await withTenantContext(req.organizationId, async (t) => {
        return Policy.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          transaction: t
        });
      });
      return res.status(200).json({ data: policies });
    } catch (err) {
      next(err);
    }
  }

  static async createPolicy(req, res, next) {
    try {
      const b = req.body;
      const policy = await withTenantContext(req.organizationId, async (t) => {
        return Policy.create(
          {
            organization_id: req.organizationId,
            title: b.title,
            version: b.version || '1.0',
            content: b.content,
            is_mandatory: b.isMandatory !== false,
            renewal_days: b.renewalDays || null
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'compliance.policy_created', 'policy', policy.id, { title: policy.title });
      return res.status(201).json({ data: policy });
    } catch (err) {
      next(err);
    }
  }

  static async acknowledgePolicy(req, res, next) {
    try {
      const ack = await withTenantContext(req.organizationId, async (t) => {
        const policy = await Policy.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!policy) throw new NotFoundError('Policy');

        const expiresAt = policy.renewal_days
          ? new Date(Date.now() + policy.renewal_days * 86400000)
          : null;

        const [record] = await PolicyAcknowledgement.upsert(
          {
            organization_id: req.organizationId,
            policy_id: policy.id,
            membership_id: req.membership.id,
            acknowledged_at: new Date(),
            expires_at: expiresAt,
            ip_address: req.ip
          },
          { transaction: t }
        );

        return record;
      });

      return res.status(200).json({ success: true, data: ack });
    } catch (err) {
      next(err);
    }
  }

  static async submitEvidence(req, res, next) {
    try {
      const b = req.body;
      const record = await withTenantContext(req.organizationId, async (t) => {
        return EvidenceRecord.create(
          {
            organization_id: req.organizationId,
            membership_id: req.membership.id,
            course_id: b.courseId || null,
            title: b.title,
            description: b.description || null,
            asset_id: b.assetId || null,
            status: 'submitted'
          },
          { transaction: t }
        );
      });

      return res.status(201).json({ data: record });
    } catch (err) {
      next(err);
    }
  }
}

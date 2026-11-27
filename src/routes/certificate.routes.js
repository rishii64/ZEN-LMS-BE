import express from 'express';
import { z } from 'zod';
import { CertificateController } from '../controllers/certificate.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const certificatesRouter = express.Router();

// Public QR / verification endpoint (no auth required)
certificatesRouter.get('/verify/:code', CertificateController.verifyCertificate);

certificatesRouter.use(requireAuth, resolveTenant);

const templateSchema = z.object({
  name: z.string().min(2).max(180),
  titleText: z.string().default('Certificate of Completion'),
  subtitleText: z.string().default('This certifies that'),
  bodyTemplate: z.string().default('has successfully completed {{course_title}} on {{issued_date}}.'),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  accentColor: z.string().default('#2563eb'),
  validityDays: z.coerce.number().int().positive().nullable().optional(),
  isDefault: z.boolean().default(false)
});

certificatesRouter.get('/', requirePermission('certificates', 'view'), CertificateController.listCertificates);
certificatesRouter.get('/templates', requirePermission('certificates', 'view'), CertificateController.listTemplates);
certificatesRouter.post('/templates', requirePermission('certificates', 'create'), validate(templateSchema), CertificateController.createTemplate);
certificatesRouter.get('/:id/download', requirePermission('certificates', 'view'), CertificateController.downloadPdf);
certificatesRouter.get('/:id/pdf', requirePermission('certificates', 'view'), CertificateController.downloadPdf);

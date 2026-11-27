import express from 'express';
import { z } from 'zod';
import { ComplianceController } from '../controllers/compliance.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const complianceRouter = express.Router();
complianceRouter.use(requireAuth, resolveTenant);

complianceRouter.get('/overview', requirePermission('compliance', 'view'), ComplianceController.getOverview);
complianceRouter.get('/policies', requirePermission('compliance', 'view'), ComplianceController.listPolicies);
complianceRouter.post('/policies', requirePermission('compliance', 'manage'), validate(z.object({
  title: z.string().min(2).max(220),
  version: z.string().default('1.0'),
  content: z.string().min(5),
  isMandatory: z.boolean().default(true),
  renewalDays: z.coerce.number().int().positive().nullable().optional()
})), ComplianceController.createPolicy);
complianceRouter.post('/policies/:id/acknowledge', requirePermission('compliance', 'view'), ComplianceController.acknowledgePolicy);
complianceRouter.post('/evidence', requirePermission('compliance', 'view'), validate(z.object({
  title: z.string().min(2).max(220),
  description: z.string().optional(),
  courseId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional()
})), ComplianceController.submitEvidence);

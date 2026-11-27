import express from 'express';
import { z } from 'zod';
import { OrganizationController } from '../controllers/organization.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const organizationsRouter = express.Router();
organizationsRouter.use(requireAuth, resolveTenant);

const updateOrgSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  legalName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  defaultLanguage: z.string().max(20).optional(),
  timezone: z.string().max(80).optional(),
  dateFormat: z.string().max(40).optional(),
  timeFormat: z.string().max(40).optional(),
  terminology: z.record(z.string()).optional(),
  completionPolicy: z.record(z.any()).optional(),
  securityPolicy: z.record(z.any()).optional(),
  retentionPolicy: z.record(z.any()).optional(),
  dashboardLayout: z.record(z.any()).optional()
});

organizationsRouter.get('/current', OrganizationController.getCurrent);
organizationsRouter.patch('/current', requirePermission('organizations', 'edit'), validate(updateOrgSchema), OrganizationController.updateCurrent);
organizationsRouter.get('/domains', requirePermission('organizations', 'view'), OrganizationController.listDomains);
organizationsRouter.post('/domains', requirePermission('organizations', 'edit'), validate(z.object({ domain: z.string().min(3) })), OrganizationController.addDomain);
organizationsRouter.post('/domains/:id/verify', requirePermission('organizations', 'edit'), OrganizationController.verifyDomain);
organizationsRouter.delete('/domains/:id', requirePermission('organizations', 'edit'), OrganizationController.deleteDomain);

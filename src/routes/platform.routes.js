import express from 'express';
import { z } from 'zod';
import { PlatformController } from '../controllers/platform.controller.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const platformRouter = express.Router();
platformRouter.use(requireAuth, requirePlatformAdmin);

const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  legalName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  organizationType: z.enum(['educational', 'corporate', 'government', 'nonprofit', 'training_institute', 'other']).default('corporate'),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  trialDays: z.coerce.number().int().min(0).max(90).optional(),
  customMaxUsers: z.coerce.number().int().positive().optional(),
  customMaxCourses: z.coerce.number().int().positive().optional(),
  customMaxStorageBytes: z.coerce.number().int().positive().optional(),
  activateImmediately: z.boolean().default(true),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2).max(180),
  adminTemporaryPassword: z.string().min(8).optional()
});

const createPlanSchema = z.object({
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  tierOrder: z.coerce.number().int().default(1),
  monthlyPriceCents: z.coerce.number().int().nonnegative(),
  annualPriceCents: z.coerce.number().int().nonnegative(),
  currency: z.string().default('USD'),
  trialDays: z.coerce.number().int().default(14),
  gracePeriodDays: z.coerce.number().int().default(7),
  maxUsers: z.coerce.number().int().positive(),
  maxCourses: z.coerce.number().int().positive(),
  maxStorageBytes: z.coerce.number().int().positive(),
  maxCustomRoles: z.coerce.number().int().default(10),
  features: z.array(z.object({
    moduleKey: z.string(),
    isEnabled: z.boolean().default(true),
    limitValue: z.coerce.number().int().optional()
  })).optional()
});

platformRouter.get('/dashboard', PlatformController.getDashboard);
platformRouter.get('/organizations', PlatformController.listOrganizations);
platformRouter.post('/organizations', validate(createOrgSchema), PlatformController.createOrganization);
platformRouter.get('/organizations/:id', PlatformController.getOrganization);
platformRouter.patch('/organizations/:id/status', PlatformController.updateOrganizationStatus);
platformRouter.get('/plans', PlatformController.listPlans);
platformRouter.post('/plans', validate(createPlanSchema), PlatformController.createPlan);
platformRouter.get('/audit-logs', PlatformController.listAuditLogs);
platformRouter.get('/announcements', PlatformController.listAnnouncements);
platformRouter.post('/announcements', PlatformController.createAnnouncement);
platformRouter.get('/settings', PlatformController.getPlatformSettings);
platformRouter.put('/settings/:key', PlatformController.updatePlatformSetting);

import express from 'express';
import { z } from 'zod';
import { IntegrationController } from '../controllers/integration.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const integrationsRouter = express.Router();
integrationsRouter.use(requireAuth, resolveTenant);

const integrationSchema = z.object({
  provider: z.enum(['oidc', 'saml', 'webhook', 'zoom', 'teams', 'slack']),
  name: z.string().min(2).max(150),
  config: z.record(z.any()).default({})
});

integrationsRouter.get('/', requirePermission('integrations', 'view'), IntegrationController.listIntegrations);
integrationsRouter.post('/', requirePermission('integrations', 'manage'), validate(integrationSchema), IntegrationController.createIntegration);

import express from 'express';
import { z } from 'zod';
import { SubscriptionController } from '../controllers/subscription.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const subscriptionsRouter = express.Router();
subscriptionsRouter.use(requireAuth, resolveTenant);

subscriptionsRouter.get('/plans', SubscriptionController.listPlans);
subscriptionsRouter.get('/current', requirePermission('billing', 'view'), SubscriptionController.getCurrent);
subscriptionsRouter.post('/change-plan', requirePermission('billing', 'manage'), validate(z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly')
})), SubscriptionController.changePlan);
subscriptionsRouter.get('/invoices', requirePermission('billing', 'view'), SubscriptionController.listInvoices);
subscriptionsRouter.post('/cancel', requirePermission('billing', 'manage'), SubscriptionController.cancelSubscription);

export const billingRouter = express.Router();
billingRouter.post('/webhooks/:provider', SubscriptionController.handleWebhook);

billingRouter.use(requireAuth, resolveTenant);
billingRouter.get('/invoices', requirePermission('billing', 'view'), SubscriptionController.listInvoices);
billingRouter.post('/checkout', requirePermission('billing', 'manage'), SubscriptionController.checkout);

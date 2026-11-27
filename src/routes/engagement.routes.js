import express from 'express';
import { z } from 'zod';
import { EngagementController } from '../controllers/engagement.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

export const engagementRouter = express.Router();
engagementRouter.use(requireAuth, resolveTenant);

engagementRouter.get('/forums', EngagementController.listForums);
engagementRouter.post('/forums', validate(z.object({
  courseId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(220),
  body: z.string().min(2)
})), EngagementController.createForumThread);

engagementRouter.get('/surveys', EngagementController.listSurveys);
engagementRouter.post('/surveys/:id/respond', validate(z.object({
  answers: z.record(z.any()),
  rating: z.coerce.number().int().min(1).max(5).optional()
})), EngagementController.submitSurvey);

export const notificationsRouter = express.Router();
notificationsRouter.use(requireAuth, resolveTenant);
notificationsRouter.get('/', EngagementController.listNotifications);
notificationsRouter.patch('/:id/read', EngagementController.markNotificationRead);

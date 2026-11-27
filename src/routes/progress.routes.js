import express from 'express';
import { z } from 'zod';
import { ProgressController } from '../controllers/progress.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const progressRouter = express.Router();
progressRouter.use(requireAuth, resolveTenant);

const progressEventSchema = z.object({
  enrollmentId: z.string().uuid(),
  eventType: z.string().min(2),
  durationSeconds: z.coerce.number().int().nonnegative().default(0),
  positionSeconds: z.coerce.number().int().nonnegative().optional(),
  isCompleted: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

const lessonProgressSchema = z.object({
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  isCompleted: z.boolean().default(true),
  timeSpentSeconds: z.coerce.number().int().nonnegative().default(0),
  positionSeconds: z.coerce.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional()
});

progressRouter.get('/enrollment/:enrollmentId', requirePermission('progress', 'view'), ProgressController.getEnrollmentProgress);
progressRouter.post('/lesson', requirePermission('progress', 'view'), validate(lessonProgressSchema), ProgressController.recordLessonProgress);
progressRouter.post('/lessons/:lessonId/event', requirePermission('progress', 'view'), validate(progressEventSchema), ProgressController.recordEvent);
progressRouter.post('/complete-check', requirePermission('progress', 'view'), validate(z.object({ enrollmentId: z.string().uuid() })), ProgressController.completeCourse);

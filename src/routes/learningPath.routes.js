import express from 'express';
import { z } from 'zod';
import { LearningPathController } from '../controllers/learningPath.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const learningPathsRouter = express.Router();
learningPathsRouter.use(requireAuth, resolveTenant);

const pathSchema = z.object({
  title: z.string().min(2).max(220),
  description: z.string().optional(),
  isMandatory: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('published'),
  estimatedHours: z.coerce.number().min(0).default(0),
  courseIds: z.array(z.string().uuid()).default([])
});

learningPathsRouter.get('/', requirePermission('learning_paths', 'view'), LearningPathController.listLearningPaths);
learningPathsRouter.post('/', requirePermission('learning_paths', 'create'), validate(pathSchema), LearningPathController.createLearningPath);
learningPathsRouter.post('/:id/enroll', requirePermission('enrollments', 'create'), validate(z.object({
  membershipIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().optional()
})), LearningPathController.enrollLearningPath);

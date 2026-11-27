import express from 'express';
import { z } from 'zod';
import { EnrollmentController } from '../controllers/enrollment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const enrollmentsRouter = express.Router();
enrollmentsRouter.use(requireAuth, resolveTenant);

const enrollSchema = z.object({
  courseId: z.string().uuid(),
  offeringId: z.string().uuid().nullable().optional(),
  membershipIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  isMandatory: z.boolean().default(false),
  dueDate: z.string().datetime().optional()
});

enrollmentsRouter.get('/', requirePermission('enrollments', 'view'), EnrollmentController.listEnrollments);
enrollmentsRouter.post('/', requirePermission('enrollments', 'create'), validate(enrollSchema), EnrollmentController.enroll);
enrollmentsRouter.post('/offerings', requirePermission('courses', 'edit'), EnrollmentController.createOffering);
enrollmentsRouter.post('/:id/drop', requirePermission('enrollments', 'edit'), EnrollmentController.dropEnrollment);

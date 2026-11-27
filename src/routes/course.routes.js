import express from 'express';
import { z } from 'zod';
import { CourseController } from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const coursesRouter = express.Router();
coursesRouter.use(requireAuth, resolveTenant);

const createCourseSchema = z.object({
  title: z.string().min(2).max(250),
  slug: z.string().min(2).max(250).optional(),
  code: z.string().max(64).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  deliveryMode: z.enum(['self_paced', 'instructor_led', 'virtual_live', 'blended']).default('self_paced'),
  language: z.string().default('en'),
  estimatedMinutes: z.coerce.number().int().positive().default(60),
  isTemplate: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  prerequisiteCourseIds: z.array(z.string().uuid()).default([]),
  completionPolicy: z.object({
    require_all_required_lessons: z.boolean().default(true),
    require_assessment_pass: z.boolean().default(false)
  }).optional()
});

coursesRouter.get('/categories', requirePermission('courses', 'view'), CourseController.listCategories);
coursesRouter.post('/categories', requirePermission('courses', 'create'), CourseController.createCategory);

coursesRouter.get('/', requirePermission('courses', 'view'), CourseController.listCourses);
coursesRouter.post('/', requirePermission('courses', 'create'), validate(createCourseSchema), CourseController.createCourse);
coursesRouter.get('/:id', requirePermission('courses', 'view'), CourseController.getCourse);
coursesRouter.patch('/:id', requirePermission('courses', 'edit'), CourseController.updateCourse);
coursesRouter.post('/:id/publish', requirePermission('courses', 'publish'), CourseController.publishCourse);
coursesRouter.post('/:id/transition', CourseController.transitionCourse);

coursesRouter.post('/:id/modules', requirePermission('courses', 'edit'), CourseController.addModule);
coursesRouter.post('/:id/modules/:moduleId/lessons', requirePermission('courses', 'edit'), CourseController.addLesson);
coursesRouter.patch('/:id/lessons/:lessonId', requirePermission('courses', 'edit'), CourseController.updateLesson);
coursesRouter.delete('/:id/lessons/:lessonId', requirePermission('courses', 'delete'), CourseController.deleteLesson);

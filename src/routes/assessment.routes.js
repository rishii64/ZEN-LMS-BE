import express from 'express';
import { z } from 'zod';
import { AssessmentController } from '../controllers/assessment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const assessmentsRouter = express.Router();
assessmentsRouter.use(requireAuth, resolveTenant);

const assessmentSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(220),
  description: z.string().optional(),
  assessmentType: z.enum(['quiz', 'exam', 'assignment', 'survey_eval']).default('quiz'),
  timeLimitMinutes: z.coerce.number().int().positive().nullable().optional(),
  maxAttempts: z.coerce.number().int().positive().default(3),
  passingScorePercent: z.coerce.number().min(0).max(100).default(70),
  randomizeQuestions: z.boolean().default(false),
  questionDrawCount: z.coerce.number().int().positive().nullable().optional(),
  allowResubmission: z.boolean().default(true)
});

const questionSchema = z.object({
  questionType: z.enum(['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'essay', 'matching', 'file_upload']),
  prompt: z.string().min(1),
  explanation: z.string().optional(),
  points: z.coerce.number().positive().default(1),
  correctAnswer: z.any().optional(),
  isBankItem: z.boolean().default(false),
  options: z.array(z.object({
    optionText: z.string().min(1),
    matchTarget: z.string().optional(),
    isCorrect: z.boolean().default(false)
  })).default([])
});

assessmentsRouter.get('/', requirePermission('assessments', 'view'), AssessmentController.listAssessments);
assessmentsRouter.post('/', requirePermission('assessments', 'create'), validate(assessmentSchema), AssessmentController.createAssessment);
assessmentsRouter.get('/:id', requirePermission('assessments', 'view'), AssessmentController.getAssessment);
assessmentsRouter.post('/:id/questions', requirePermission('assessments', 'edit'), validate(questionSchema), AssessmentController.addQuestion);

export const attemptsRouter = express.Router();
attemptsRouter.use(requireAuth, resolveTenant);

const startAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
  enrollmentId: z.string().uuid()
});

const submitAttemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).default([]),
    textResponse: z.string().optional(),
    matchingResponse: z.record(z.string()).optional(),
    fileAssetId: z.string().uuid().nullable().optional()
  }))
});

attemptsRouter.get('/', requirePermission('assessments', 'view'), AssessmentController.listAttempts);
attemptsRouter.post('/start', requirePermission('assessments', 'view'), validate(startAttemptSchema), AssessmentController.startAttempt);
attemptsRouter.post('/:attemptId/submit', requirePermission('assessments', 'view'), validate(submitAttemptSchema), AssessmentController.submitAttempt);

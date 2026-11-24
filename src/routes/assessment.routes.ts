import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { evaluateCourseCompletion } from './progress.routes.js';

export const assessmentRouter = Router();

// Get assessment questions (safe for learner, hides isCorrect)
assessmentRouter.get('/:id', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isTeacher = req.user?.isSuperAdmin || 
      (req.membership && ['ORG_ADMIN', 'INSTRUCTOR'].includes(req.membership.role));

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: {
              include: { course: true }
            }
          }
        },
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            options: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                questionId: true,
                text: true,
                orderIndex: true,
                isCorrect: isTeacher // only send isCorrect to teacher/author
              }
            }
          }
        }
      }
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }

    // Get learner's past attempts
    const pastAttempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: id, userId: req.user!.id },
      orderBy: { submittedAt: 'desc' }
    });

    res.json({
      ...assessment,
      pastAttempts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve assessment.' });
  }
});

// Submit assessment attempt & auto-grade server side
assessmentRouter.post('/:id/submit', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { answers, courseId } = req.body; // answers: { [questionId: string]: string[] | string }

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            module: { include: { course: true } }
          }
        },
        questions: {
          include: { options: true }
        }
      }
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }

    // Check attempts limit
    const attemptCount = await prisma.assessmentAttempt.count({
      where: { assessmentId: id, userId }
    });

    if (attemptCount >= assessment.maxAttempts) {
      res.status(400).json({ error: `Maximum attempts limit reached (${assessment.maxAttempts}).` });
      return;
    }

    // Auto-grade answers
    let totalPoints = 0;
    let pointsEarned = 0;
    const detailedAnswers: any[] = [];

    for (const q of assessment.questions) {
      totalPoints += q.points;
      const userSelectedOptionIds: string[] = Array.isArray(answers?.[q.id]) 
        ? answers[q.id] 
        : (answers?.[q.id] ? [answers[q.id]] : []);

      const correctOptionIds = q.options.filter(o => o.isCorrect).map(o => o.id);

      // Check correctness
      let isCorrect = false;
      if (q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE') {
        isCorrect = userSelectedOptionIds.length === 1 && correctOptionIds.includes(userSelectedOptionIds[0]);
      } else if (q.type === 'MULTIPLE_CHOICE') {
        const hasAllCorrect = correctOptionIds.every(id => userSelectedOptionIds.includes(id));
        const hasNoExtra = userSelectedOptionIds.every(id => correctOptionIds.includes(id));
        isCorrect = hasAllCorrect && hasNoExtra;
      } else if (q.type === 'SHORT_ANSWER') {
        // String comparison against correct option texts
        const textAns = (req.body.textAnswers?.[q.id] || '').trim().toLowerCase();
        isCorrect = q.options.some(o => o.text.trim().toLowerCase() === textAns);
      }

      const qPoints = isCorrect ? q.points : 0;
      pointsEarned += qPoints;

      detailedAnswers.push({
        questionId: q.id,
        selectedOptionIds: JSON.stringify(userSelectedOptionIds),
        isCorrect,
        pointsAwarded: qPoints,
        explanation: q.explanation
      });
    }

    const scorePercentage = totalPoints > 0 ? Math.round((pointsEarned / totalPoints) * 100) : 100;
    const isPassed = scorePercentage >= assessment.passingScore;

    // Find enrollment
    const finalCourseId = courseId || assessment.lesson.module.courseId;
    let enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: finalCourseId,
          userId
        }
      }
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId: id,
        userId,
        enrollmentId: enrollment?.id || null,
        score: scorePercentage,
        totalPoints,
        isPassed,
        attemptNumber: attemptCount + 1,
        answers: {
          create: detailedAnswers.map(a => ({
            questionId: a.questionId,
            selectedOptionIds: a.selectedOptionIds,
            isCorrect: a.isCorrect,
            pointsAwarded: a.pointsAwarded
          }))
        }
      },
      include: {
        answers: true
      }
    });

    // If passed and part of an enrollment, mark the quiz lesson complete and evaluate course completion
    if (enrollment && isPassed) {
      await prisma.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: enrollment.id,
            lessonId: assessment.lessonId
          }
        },
        create: {
          enrollmentId: enrollment.id,
          lessonId: assessment.lessonId,
          isCompleted: true,
          completedAt: new Date()
        },
        update: {
          isCompleted: true,
          completedAt: new Date()
        }
      });

      await evaluateCourseCompletion(enrollment.id);
    }

    res.status(201).json({
      attemptId: attempt.id,
      score: scorePercentage,
      totalPoints,
      passingScore: assessment.passingScore,
      isPassed,
      attemptNumber: attempt.attemptNumber,
      remainingAttempts: assessment.maxAttempts - attempt.attemptNumber,
      feedback: isPassed ? 'Congratulations! You passed the assessment.' : 'You did not meet the passing criteria. Please review the material and try again.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to evaluate assessment submission.' });
  }
});

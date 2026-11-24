import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

export const progressRouter = Router();

// Helper to evaluate completion & award certificate if eligible
export async function evaluateCourseCompletion(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: {
        include: {
          modules: {
            include: {
              lessons: {
                include: { assessment: true }
              }
            }
          }
        }
      },
      lessonProgress: true,
      user: true,
      organization: true,
      certificate: true
    }
  });

  if (!enrollment) return null;

  // Gather all required lessons
  const allLessons: any[] = [];
  enrollment.course.modules.forEach(m => {
    m.lessons.forEach(l => allLessons.push(l));
  });

  const requiredLessons = allLessons.filter(l => l.isRequired);
  const totalUnits = requiredLessons.length > 0 ? requiredLessons.length : allLessons.length;

  if (totalUnits === 0) return enrollment;

  // Completed required lessons
  const completedLessonIds = new Set(
    enrollment.lessonProgress.filter(p => p.isCompleted).map(p => p.lessonId)
  );

  const completedRequiredCount = requiredLessons.filter(l => completedLessonIds.has(l.id)).length;
  const progressPct = Math.min(100, Math.round((completedRequiredCount / totalUnits) * 100));

  let status = enrollment.status;
  if (progressPct > 0 && status === 'NOT_STARTED') {
    status = 'IN_PROGRESS';
  }

  let completedAt = enrollment.completedAt;

  // Check if course has quizzes and ensure they are passed if required
  let isFullyPassed = true;
  for (const l of allLessons) {
    if (l.contentType === 'QUIZ' && l.assessment) {
      const bestAttempt = await prisma.assessmentAttempt.findFirst({
        where: { assessmentId: l.assessment.id, userId: enrollment.userId, isPassed: true }
      });
      if (!bestAttempt) {
        isFullyPassed = false;
        break;
      }
    }
  }

  let certificateAwarded = null;

  if (progressPct >= 100 && isFullyPassed) {
    status = 'COMPLETED';
    if (!completedAt) {
      completedAt = new Date();
    }

    // Check certificate issuance
    if (!enrollment.certificate) {
      const currentYear = new Date().getFullYear();
      const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      const certNumber = `ZEN-${currentYear}-${randomCode}`;
      const verificationCode = crypto.randomBytes(16).toString('hex');

      certificateAwarded = await prisma.certificate.create({
        data: {
          certificateNumber: certNumber,
          organizationId: enrollment.organizationId,
          courseId: enrollment.courseId,
          userId: enrollment.userId,
          enrollmentId: enrollment.id,
          verificationCode,
          issueDate: new Date(),
          recipientName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
          courseTitle: enrollment.course.title,
          organizationName: enrollment.organization.name
        }
      });
    }
  }

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPct,
      status,
      startedAt: enrollment.startedAt || new Date(),
      completedAt
    },
    include: {
      certificate: true,
      lessonProgress: true
    }
  });

  return updatedEnrollment;
}

// Mark lesson completed
progressRouter.post('/lesson', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { courseId, lessonId, isCompleted, lastPositionSeconds } = req.body;

    if (!courseId || !lessonId) {
      res.status(400).json({ error: 'courseId and lessonId are required.' });
      return;
    }

    // Find or create enrollment
    let enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_userId: { courseId, userId }
      }
    });

    if (!enrollment) {
      enrollment = await prisma.enrollment.create({
        data: {
          organizationId: req.organization!.id,
          courseId,
          userId,
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });
    }

    // Upsert lesson progress
    await prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId
        }
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : true,
        completedAt: isCompleted ? new Date() : null,
        lastPositionSeconds: lastPositionSeconds || 0
      },
      update: {
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : true,
        completedAt: isCompleted ? new Date() : undefined,
        lastPositionSeconds: lastPositionSeconds !== undefined ? lastPositionSeconds : undefined
      }
    });

    // Recalculate course progress & issue certificate if 100%
    const updatedEnrollment = await evaluateCourseCompletion(enrollment.id);

    res.json({
      success: true,
      enrollment: updatedEnrollment
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record lesson progress.' });
  }
});

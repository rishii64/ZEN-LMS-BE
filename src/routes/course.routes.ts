import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const courseRouter = Router();

// List courses for active tenant
courseRouter.get('/', optionalAuthMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const isManagerOrAuthor = req.user?.isSuperAdmin || 
      (req.membership && ['ORG_ADMIN', 'DEPT_MANAGER', 'INSTRUCTOR'].includes(req.membership.role));

    // Learners see PUBLISHED courses; Admins/Instructors see all statuses
    const whereClause: any = { organizationId: orgId };
    if (!isManagerOrAuthor) {
      whereClause.status = 'PUBLISHED';
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        },
        _count: {
          select: {
            modules: true,
            enrollments: true
          }
        },
        enrollments: req.user ? {
          where: { userId: req.user.id },
          select: { id: true, status: true, progressPct: true }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = courses.map(c => {
      const userEnrollment = Array.isArray(c.enrollments) && c.enrollments.length > 0 ? c.enrollments[0] : null;
      return {
        ...c,
        isEnrolled: Boolean(userEnrollment),
        enrollment: userEnrollment
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list courses.' });
  }
});

// Get course details by ID or Slug with modules and lessons
courseRouter.get('/:idOrSlug', optionalAuthMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { idOrSlug } = req.params;

    const course = await prisma.course.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }]
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        },
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
              include: {
                assessment: {
                  select: {
                    id: true,
                    title: true,
                    passingScore: true,
                    timeLimitMinutes: true,
                    maxAttempts: true,
                    _count: { select: { questions: true } }
                  }
                }
              }
            }
          }
        },
        enrollments: req.user ? {
          where: { userId: req.user.id },
          include: {
            lessonProgress: true,
            certificate: true
          }
        } : false
      }
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found in this organization.' });
      return;
    }

    const userEnrollment = Array.isArray(course.enrollments) && course.enrollments.length > 0 ? course.enrollments[0] : null;

    res.json({
      ...course,
      isEnrolled: Boolean(userEnrollment),
      userEnrollment
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve course details.' });
  }
});

// Create course (Instructor or Org Admin)
courseRouter.post('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const authorId = req.user!.id;
    const { title, slug, description, category, level, coverImageUrl, estimatedHours, isMandatory } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Course title is required.' });
      return;
    }

    const courseSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await prisma.course.findUnique({
      where: {
        organizationId_slug: {
          organizationId: orgId,
          slug: courseSlug
        }
      }
    });

    if (existing) {
      res.status(409).json({ error: 'A course with this slug/title already exists in this organization.' });
      return;
    }

    const course = await prisma.course.create({
      data: {
        organizationId: orgId,
        authorId,
        title,
        slug: courseSlug,
        description,
        category: category || 'General',
        level: level || 'BEGINNER',
        coverImageUrl: coverImageUrl || null,
        estimatedHours: estimatedHours ? parseInt(estimatedHours) : 2,
        isMandatory: Boolean(isMandatory),
        status: 'DRAFT'
      }
    });

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create course.' });
  }
});

// Update course (metadata, status publish/draft)
courseRouter.put('/:id', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, category, level, coverImageUrl, estimatedHours, isMandatory, status } = req.body;

    const course = await prisma.course.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        category: category !== undefined ? category : undefined,
        level: level !== undefined ? level : undefined,
        coverImageUrl: coverImageUrl !== undefined ? coverImageUrl : undefined,
        estimatedHours: estimatedHours !== undefined ? parseInt(estimatedHours) : undefined,
        isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : undefined,
        status: status !== undefined ? status : undefined
      }
    });

    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update course.' });
  }
});

// Add module to course
courseRouter.post('/:id/modules', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, orderIndex } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Module title is required.' });
      return;
    }

    const count = await prisma.module.count({ where: { courseId: id } });

    const newModule = await prisma.module.create({
      data: {
        courseId: id,
        title,
        description: description || null,
        orderIndex: orderIndex !== undefined ? orderIndex : count
      }
    });

    res.status(201).json(newModule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add module.' });
  }
});

// Add lesson to module
courseRouter.post('/modules/:moduleId/lessons', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleId } = req.params;
    const { title, contentType, contentText, contentUrl, durationMinutes, isRequired, orderIndex } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Lesson title is required.' });
      return;
    }

    const count = await prisma.lesson.count({ where: { moduleId } });

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        contentType: contentType || 'MARKDOWN',
        contentText: contentText || null,
        contentUrl: contentUrl || null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 10,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : true,
        orderIndex: orderIndex !== undefined ? orderIndex : count
      }
    });

    res.status(201).json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add lesson.' });
  }
});

// Attach/update assessment quiz for a lesson
courseRouter.post('/lessons/:lessonId/assessment', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const { title, description, passingScore, timeLimitMinutes, maxAttempts, questions } = req.body;

    const assessment = await prisma.assessment.upsert({
      where: { lessonId },
      create: {
        lessonId,
        title: title || 'Module Assessment',
        description: description || null,
        passingScore: passingScore ? parseInt(passingScore) : 70,
        timeLimitMinutes: timeLimitMinutes ? parseInt(timeLimitMinutes) : null,
        maxAttempts: maxAttempts ? parseInt(maxAttempts) : 3
      },
      update: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        passingScore: passingScore !== undefined ? parseInt(passingScore) : undefined,
        timeLimitMinutes: timeLimitMinutes !== undefined ? parseInt(timeLimitMinutes) : undefined,
        maxAttempts: maxAttempts !== undefined ? parseInt(maxAttempts) : undefined
      }
    });

    // If questions provided, re-create questions & options
    if (Array.isArray(questions)) {
      // Remove old questions to replace with updated set
      await prisma.question.deleteMany({ where: { assessmentId: assessment.id } });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const createdQ = await prisma.question.create({
          data: {
            assessmentId: assessment.id,
            text: q.text,
            type: q.type || 'SINGLE_CHOICE',
            points: q.points || 1,
            orderIndex: i,
            explanation: q.explanation || null
          }
        });

        if (Array.isArray(q.options)) {
          for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            await prisma.questionOption.create({
              data: {
                questionId: createdQ.id,
                text: opt.text,
                isCorrect: Boolean(opt.isCorrect),
                orderIndex: j
              }
            });
          }
        }
      }
    }

    const fullAssessment = await prisma.assessment.findUnique({
      where: { id: assessment.id },
      include: {
        questions: {
          include: { options: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    res.status(201).json(fullAssessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to configure assessment.' });
  }
});

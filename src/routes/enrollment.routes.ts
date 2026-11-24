import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const enrollmentRouter = Router();

// Get current user's enrollments in this tenant
enrollmentRouter.get('/my', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const userId = req.user!.id;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        organizationId: orgId,
        userId: userId
      },
      include: {
        course: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true }
            },
            _count: {
              select: { modules: true }
            }
          }
        },
        certificate: true
      },
      orderBy: { enrolledAt: 'desc' }
    });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user enrollments.' });
  }
});

// Self-enroll into a published course
enrollmentRouter.post('/self', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const userId = req.user!.id;
    const { courseId } = req.body;

    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, organizationId: orgId, status: 'PUBLISHED' }
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found or not published.' });
      return;
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId
        }
      }
    });

    if (existing) {
      res.json(existing);
      return;
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        organizationId: orgId,
        courseId,
        userId,
        status: 'NOT_STARTED',
        progressPct: 0.0
      },
      include: { course: true }
    });

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to enroll in course.' });
  }
});

// Assign course to a user or entire department (Admin / Manager)
enrollmentRouter.post('/assign', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_MANAGER', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { courseId, userIds, departmentId, deadline } = req.body;

    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required.' });
      return;
    }

    let targetUserIds: string[] = [];

    if (Array.isArray(userIds) && userIds.length > 0) {
      targetUserIds = userIds;
    } else if (departmentId) {
      const memberships = await prisma.userMembership.findMany({
        where: { organizationId: orgId, departmentId, status: 'ACTIVE' },
        select: { userId: true }
      });
      targetUserIds = memberships.map(m => m.userId);
    } else {
      res.status(400).json({ error: 'Must provide userIds or departmentId to assign course.' });
      return;
    }

    const results = [];
    for (const uid of targetUserIds) {
      const enrollment = await prisma.enrollment.upsert({
        where: {
          courseId_userId: {
            courseId,
            userId: uid
          }
        },
        create: {
          organizationId: orgId,
          courseId,
          userId: uid,
          deadline: deadline ? new Date(deadline) : null,
          status: 'NOT_STARTED',
          progressPct: 0.0
        },
        update: {
          deadline: deadline ? new Date(deadline) : undefined
        }
      });
      results.push(enrollment);
    }

    res.status(201).json({ message: `Assigned course to ${results.length} learners.`, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign course.' });
  }
});

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const liveSessionRouter = Router();

// List live sessions for current tenant
liveSessionRouter.get('/', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { courseId } = req.query;

    const sessions = await prisma.liveSession.findMany({
      where: {
        organizationId: orgId,
        ...(courseId ? { courseId: courseId as string } : {})
      },
      include: {
        course: { select: { title: true, slug: true } },
        attendances: {
          where: { userId: req.user!.id }
        },
        _count: { select: { attendances: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list live sessions' });
  }
});

// Create live session (Instructor / Admin)
liveSessionRouter.post('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const instructorId = req.user!.id;
    const { courseId, title, description, meetingUrl, startTime, endTime } = req.body;

    if (!courseId || !title || !meetingUrl || !startTime || !endTime) {
      res.status(400).json({ error: 'courseId, title, meetingUrl, startTime, and endTime are required' });
      return;
    }

    const session = await prisma.liveSession.create({
      data: {
        organizationId: orgId,
        courseId,
        instructorId,
        title,
        description: description || null,
        meetingUrl,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'SCHEDULED'
      },
      include: { course: true }
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create live session' });
  }
});

// Mark / Check-in attendance for current user
liveSessionRouter.post('/:id/attendance', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const record = await prisma.sessionAttendance.upsert({
      where: {
        liveSessionId_userId: {
          liveSessionId: id,
          userId
        }
      },
      create: {
        liveSessionId: id,
        userId,
        isPresent: true,
        joinedAt: new Date()
      },
      update: {
        isPresent: true
      }
    });

    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

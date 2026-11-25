import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const communicationRouter = Router();

// ----------------------------------------------------
// ANNOUNCEMENTS
// ----------------------------------------------------
communicationRouter.get('/announcements', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const announcements = await prisma.announcement.findMany({
      where: { organizationId: orgId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        course: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list announcements' });
  }
});

communicationRouter.post('/announcements', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const authorId = req.user!.id;
    const { title, content, priority, courseId } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        organizationId: orgId,
        authorId,
        courseId: courseId || null,
        title,
        content,
        priority: priority || 'NORMAL'
      }
    });

    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to post announcement' });
  }
});

// ----------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------
communicationRouter.get('/notifications', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

communicationRouter.put('/notifications/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ----------------------------------------------------
// COMPLIANCE POLICIES & ACKNOWLEDGEMENTS
// ----------------------------------------------------
communicationRouter.get('/compliance/policies', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const userId = req.user!.id;

    const policies = await prisma.compliancePolicy.findMany({
      where: { organizationId: orgId },
      include: {
        acknowledgements: {
          where: { userId }
        },
        _count: { select: { acknowledgements: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = policies.map(p => ({
      ...p,
      isAcknowledged: p.acknowledgements.length > 0,
      acknowledgedAt: p.acknowledgements[0]?.acknowledgedAt || null
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve compliance policies' });
  }
});

communicationRouter.post('/compliance/policies', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { title, content, version, requiresAcknowledgement, renewalMonths } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }

    const policy = await prisma.compliancePolicy.create({
      data: {
        organizationId: orgId,
        title,
        content,
        version: version || '1.0',
        requiresAcknowledgement: requiresAcknowledgement !== undefined ? Boolean(requiresAcknowledgement) : true,
        renewalMonths: renewalMonths ? parseInt(renewalMonths) : 12
      }
    });

    res.status(201).json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create compliance policy' });
  }
});

communicationRouter.post('/compliance/policies/:id/acknowledge', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const ack = await prisma.policyAcknowledgement.upsert({
      where: {
        policyId_userId: {
          policyId: id,
          userId
        }
      },
      create: {
        policyId: id,
        userId,
        acknowledgedAt: new Date(),
        ipAddress: req.ip || null
      },
      update: {
        acknowledgedAt: new Date()
      }
    });

    res.json({ success: true, acknowledgement: ack });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge policy' });
  }
});

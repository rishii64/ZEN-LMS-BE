import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const learningPathRouter = Router();

// List learning paths for active tenant
learningPathRouter.get('/', optionalAuthMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const isPrivileged = req.user?.isSuperAdmin || 
      (req.membership && ['ORG_ADMIN', 'INSTRUCTOR'].includes(req.membership.role));

    const paths = await prisma.learningPath.findMany({
      where: {
        organizationId: orgId,
        ...(isPrivileged ? {} : { status: 'PUBLISHED' })
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true }
        },
        items: {
          include: {
            course: {
              select: { id: true, title: true, slug: true, estimatedHours: true, level: true }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(paths);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list learning paths' });
  }
});

// Create learning path (Instructor / Org Admin)
learningPathRouter.post('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const authorId = req.user!.id;
    const { title, slug, description, coverImageUrl, courseIds } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Learning path title is required' });
      return;
    }

    const pathSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const path = await prisma.learningPath.create({
      data: {
        organizationId: orgId,
        authorId,
        title,
        slug: pathSlug,
        description: description || null,
        coverImageUrl: coverImageUrl || null,
        status: 'PUBLISHED',
        items: Array.isArray(courseIds) ? {
          create: courseIds.map((cid: string, idx: number) => ({
            courseId: cid,
            orderIndex: idx,
            isMandatory: true
          }))
        } : undefined
      },
      include: {
        items: {
          include: { course: true }
        }
      }
    });

    res.status(201).json(path);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create learning path' });
  }
});

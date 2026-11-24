import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const departmentRouter = Router();

// List departments for active tenant
departmentRouter.get('/', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const departments = await prisma.department.findMany({
      where: { organizationId: orgId },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { memberships: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list departments.' });
  }
});

// Create department (Org Admin)
departmentRouter.post('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { name, code, description, parentId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Department name is required.' });
      return;
    }

    const dept = await prisma.department.create({
      data: {
        organizationId: orgId,
        name,
        code,
        description,
        parentId: parentId || null
      }
    });

    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department.' });
  }
});

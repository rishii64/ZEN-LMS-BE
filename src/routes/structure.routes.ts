import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const structureRouter = Router();

// LOCATIONS & BRANCHES
structureRouter.get('/locations', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const locations = await prisma.location.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { memberships: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list locations' });
  }
});

structureRouter.post('/locations', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { name, code, address, city, country } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Location name is required' });
      return;
    }

    const loc = await prisma.location.create({
      data: {
        organizationId: orgId,
        name,
        code: code || null,
        address: address || null,
        city: city || null,
        country: country || null
      }
    });

    res.status(201).json(loc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// TEAMS & GROUPS
structureRouter.get('/teams', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId },
      include: {
        department: true,
        memberships: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

structureRouter.post('/teams', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { name, description, departmentId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name,
        description: description || null,
        departmentId: departmentId || null
      }
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

structureRouter.post('/teams/:id/members', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const membership = await prisma.groupMembership.upsert({
      where: {
        teamId_userId: {
          teamId: id,
          userId
        }
      },
      create: {
        teamId: id,
        userId
      },
      update: {}
    });

    res.status(201).json(membership);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add user to team' });
  }
});

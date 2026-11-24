import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const userRouter = Router();

// List members in current tenant (Admins & Managers)
userRouter.get('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    
    // If Dept Manager, can view members in their department
    let whereClause: any = { organizationId: orgId };
    if (req.membership?.role === 'DEPT_MANAGER' && req.membership.departmentId) {
      whereClause.departmentId = req.membership.departmentId;
    }

    const members = await prisma.userMembership.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true
          }
        },
        department: true,
        organization: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tenant users.' });
  }
});

// Invite / Add user to organization (Org Admin)
userRouter.post('/invite', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { email, firstName, lastName, role, departmentId, title, password } = req.body;

    if (!email || !firstName || !lastName) {
      res.status(400).json({ error: 'Email, firstName, and lastName are required.' });
      return;
    }

    // Check if user exists or create them
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const defaultPassword = password || 'Welcome123!';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName
        }
      });
    }

    // Check if membership already exists
    const existingMembership = await prisma.userMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id
        }
      }
    });

    if (existingMembership) {
      res.status(409).json({ error: 'User is already a member of this organization.' });
      return;
    }

    const membership = await prisma.userMembership.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: role || 'LEARNER',
        departmentId: departmentId || null,
        title: title || null,
        status: 'ACTIVE'
      },
      include: {
        user: true,
        department: true
      }
    });

    res.status(201).json(membership);
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite user.' });
  }
});

// Update membership (Role, Department, Title)
userRouter.put('/:membershipId', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { membershipId } = req.params;
    const { role, departmentId, title, status } = req.body;

    const updated = await prisma.userMembership.update({
      where: { id: membershipId },
      data: {
        role: role !== undefined ? role : undefined,
        departmentId: departmentId !== undefined ? departmentId : undefined,
        title: title !== undefined ? title : undefined,
        status: status !== undefined ? status : undefined
      },
      include: {
        user: true,
        department: true
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update membership.' });
  }
});

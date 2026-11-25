import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../lib/permissions.js';

export const roleRouter = Router();

// List all system-supported permission codes
roleRouter.get('/permissions', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }]
    });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve permissions' });
  }
});

// List roles for active tenant (including global templates and custom roles)
roleRouter.get('/', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization?.id;

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { organizationId: null, isSystemDefault: true }
        ]
      },
      include: {
        permissions: {
          include: { permission: true }
        },
        _count: {
          select: { memberships: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve roles.' });
  }
});

// Create custom role (Tenant Admin / Super Admin)
roleRouter.post('/', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization?.id;
    const { name, description, scope, permissionCodes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Role name is required.' });
      return;
    }

    const existing = await prisma.role.findFirst({
      where: {
        organizationId: orgId,
        name
      }
    });

    if (existing) {
      res.status(409).json({ error: `A role with name '${name}' already exists in this organization.` });
      return;
    }

    // Resolve permission IDs from codes
    const codes: string[] = Array.isArray(permissionCodes) ? permissionCodes : [];
    const matchedPerms = await prisma.permission.findMany({
      where: { code: { in: codes } }
    });

    const role = await prisma.role.create({
      data: {
        organizationId: orgId || null,
        name,
        description: description || null,
        scope: scope || 'ORGANIZATION',
        isSystemDefault: false,
        permissions: {
          create: matchedPerms.map(p => ({
            permissionId: p.id
          }))
        }
      },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId || null,
        userId: req.user?.id || null,
        action: 'ROLE_CREATED',
        entityType: 'Role',
        entityId: role.id,
        details: JSON.stringify({ roleName: role.name, scope: role.scope, permissionCount: matchedPerms.length })
      }
    });

    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role.' });
  }
});

// Assign custom role to user membership
roleRouter.post('/assign', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { membershipId, roleId } = req.body;

    if (!membershipId || !roleId) {
      res.status(400).json({ error: 'membershipId and roleId are required.' });
      return;
    }

    const assignment = await prisma.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId,
          roleId
        }
      },
      create: {
        membershipId,
        roleId
      },
      update: {}
    });

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign role to membership.' });
  }
});

// Remove custom role from membership
roleRouter.delete('/unassign', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { membershipId, roleId } = req.body;

    await prisma.membershipRole.deleteMany({
      where: { membershipId, roleId }
    });

    res.json({ success: true, message: 'Role assignment revoked.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke role assignment.' });
  }
});

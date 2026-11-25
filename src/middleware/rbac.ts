import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export type RoleType = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEPT_MANAGER' | 'INSTRUCTOR' | 'LEARNER';

export function requireRoles(...allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform Super Admin always has full bypass access
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (!req.membership) {
      res.status(403).json({ error: 'Access denied. You are not an active member of this organization.' });
      return;
    }

    const userRole = req.membership.role as RoleType;

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({
      error: `Access denied. Role '${userRole}' does not possess required privileges: [${allowedRoles.join(', ')}]`
    });
  };
}

export function requirePermissions(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform Super Admin has all permissions globally
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (!req.membership) {
      res.status(403).json({ error: 'Access denied. You are not an active member of this organization.' });
      return;
    }

    // Tenant Org Admin automatically has all organization permissions
    if (req.membership.role === 'ORG_ADMIN') {
      return next();
    }

    try {
      // Fetch dynamic custom roles assigned to this membership
      const membershipWithRoles = await prisma.userMembership.findUnique({
        where: { id: req.membership.id },
        include: {
          assignedRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true }
                  }
                }
              }
            }
          }
        }
      });

      const grantedPermissionCodes = new Set<string>();

      // Also map default archetype capabilities
      if (req.membership.role === 'INSTRUCTOR') {
        ['courses.view', 'courses.create', 'courses.edit', 'courses.review', 'assessments.view', 'assessments.create', 'assessments.grade'].forEach(p => grantedPermissionCodes.add(p));
      } else if (req.membership.role === 'DEPT_MANAGER') {
        ['users.view', 'courses.view', 'reports.view', 'reports.export'].forEach(p => grantedPermissionCodes.add(p));
      } else if (req.membership.role === 'LEARNER') {
        ['courses.view', 'assessments.view', 'certificates.view'].forEach(p => grantedPermissionCodes.add(p));
      }

      membershipWithRoles?.assignedRoles.forEach(ar => {
        ar.role.permissions.forEach(rp => {
          grantedPermissionCodes.add(rp.permission.code);
        });
      });

      const hasAll = requiredPermissions.every(p => grantedPermissionCodes.has(p));

      if (hasAll) {
        return next();
      }

      res.status(403).json({
        error: `Access denied. Missing required dynamic permission(s): [${requiredPermissions.join(', ')}]`
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal authorization evaluation error.' });
    }
  };
}

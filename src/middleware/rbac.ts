import { Request, Response, NextFunction } from 'express';

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

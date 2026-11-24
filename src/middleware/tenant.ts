import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantSlug = (req.headers['x-tenant-slug'] as string) || (req.query.tenant as string);
  const tenantId = (req.headers['x-tenant-id'] as string);

  if (!tenantSlug && !tenantId) {
    // If user is superadmin and no tenant specified, allowed for global routes
    if (req.user?.isSuperAdmin) {
      return next();
    }
    // Check if user has a membership we can default to
    if (req.user) {
      const defaultMembership = await prisma.userMembership.findFirst({
        where: { userId: req.user.id, status: 'ACTIVE' },
        include: { organization: true, department: true }
      });
      if (defaultMembership) {
        req.organization = defaultMembership.organization;
        req.membership = defaultMembership;
        return next();
      }
    }
    res.status(400).json({ error: 'Tenant context required. Provide x-tenant-slug or x-tenant-id header.' });
    return;
  }

  try {
    const org = await prisma.organization.findFirst({
      where: tenantId ? { id: tenantId } : { slug: tenantSlug }
    });

    if (!org) {
      res.status(404).json({ error: 'Organization tenant not found.' });
      return;
    }

    if (org.status === 'SUSPENDED') {
      res.status(403).json({ error: 'This organization account has been suspended.' });
      return;
    }

    req.organization = org;

    if (req.user) {
      const membership = await prisma.userMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: req.user.id
          }
        },
        include: { department: true }
      });

      if (membership) {
        req.membership = membership;
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve organization context.' });
  }
}

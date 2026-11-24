import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const reportRouter = Router();

// Tenant Analytics Overview
reportRouter.get('/overview', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN', 'DEPT_MANAGER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;

    // Filter by department if user is DEPT_MANAGER
    const deptId = req.membership?.role === 'DEPT_MANAGER' ? req.membership.departmentId : null;

    const [totalMembers, totalCourses, totalEnrollments, completedEnrollments, totalCertificates, departments] = await Promise.all([
      prisma.userMembership.count({
        where: {
          organizationId: orgId,
          ...(deptId ? { departmentId: deptId } : {})
        }
      }),
      prisma.course.count({
        where: { organizationId: orgId }
      }),
      prisma.enrollment.count({
        where: {
          organizationId: orgId,
          ...(deptId ? { user: { memberships: { some: { departmentId: deptId } } } } : {})
        }
      }),
      prisma.enrollment.count({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          ...(deptId ? { user: { memberships: { some: { departmentId: deptId } } } } : {})
        }
      }),
      prisma.certificate.count({
        where: { organizationId: orgId }
      }),
      prisma.department.findMany({
        where: { organizationId: orgId },
        include: {
          _count: { select: { memberships: true } }
        }
      })
    ]);

    const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

    // Recent certificates awarded
    const recentCertificates = await prisma.certificate.findMany({
      where: { organizationId: orgId },
      orderBy: { issueDate: 'desc' },
      take: 5
    });

    res.json({
      metrics: {
        totalMembers,
        totalCourses,
        totalEnrollments,
        completedEnrollments,
        inProgressEnrollments: totalEnrollments - completedEnrollments,
        completionRate,
        totalCertificates
      },
      departments,
      recentCertificates
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate analytics report.' });
  }
});

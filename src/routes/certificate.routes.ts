import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

export const certificateRouter = Router();

// Get current user's certificates in this organization
certificateRouter.get('/my', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const userId = req.user!.id;

    const certs = await prisma.certificate.findMany({
      where: {
        organizationId: orgId,
        userId: userId
      },
      include: {
        course: {
          select: { id: true, title: true, slug: true, category: true, estimatedHours: true }
        },
        organization: {
          select: { id: true, name: true, logoUrl: true, primaryColor: true }
        }
      },
      orderBy: { issueDate: 'desc' }
    });

    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve certificates.' });
  }
});

// PUBLIC: Verify certificate authenticity by verification code or certificate number
certificateRouter.get('/verify/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { verificationCode: code },
          { certificateNumber: code }
        ]
      },
      include: {
        course: {
          select: { title: true, category: true, estimatedHours: true }
        },
        organization: {
          select: { name: true, sector: true, logoUrl: true, primaryColor: true }
        },
        enrollment: {
          select: { enrolledAt: true, completedAt: true }
        }
      }
    });

    if (!certificate) {
      res.status(404).json({
        isValid: false,
        error: 'No authentic credential found matching this verification code or certificate number.'
      });
      return;
    }

    res.json({
      isValid: true,
      certificateNumber: certificate.certificateNumber,
      verificationCode: certificate.verificationCode,
      recipientName: certificate.recipientName,
      courseTitle: certificate.courseTitle,
      organizationName: certificate.organizationName,
      sector: certificate.organization.sector,
      logoUrl: certificate.organization.logoUrl,
      issueDate: certificate.issueDate,
      expiryDate: certificate.expiryDate,
      estimatedHours: certificate.course.estimatedHours
    });
  } catch (error) {
    res.status(500).json({ error: 'Certificate verification failure.' });
  }
});

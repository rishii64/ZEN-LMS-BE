import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const orgRouter = Router();

// Public/authenticated list of organizations (for tenant selection & platform overview)
orgRouter.get('/', optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await prisma.organization.findMany({
      where: req.user?.isSuperAdmin ? {} : { status: 'ACTIVE' },
      include: {
        settings: true,
        _count: {
          select: {
            courses: true,
            memberships: true,
            departments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list organizations.' });
  }
});

// Get organization by id or slug with branding & terminology settings
orgRouter.get('/:idOrSlug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idOrSlug } = req.params;
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }]
      },
      include: {
        settings: true,
        departments: true
      }
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json(org);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get organization.' });
  }
});

// Super Admin: Create new organization tenant
orgRouter.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super Admin privilege required to provision organizations.' });
      return;
    }

    const { name, slug, sector, logoUrl, primaryColor, secondaryColor, timezone, terminology } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required.' });
      return;
    }

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ error: 'Organization slug already in use.' });
      return;
    }

    // Default sector terminology mappings
    const defaultTerminologies: Record<string, any> = {
      EDUCATION: {
        learner: 'Student',
        learners: 'Students',
        instructor: 'Professor',
        instructors: 'Faculty',
        course: 'Course',
        courses: 'Courses',
        department: 'Academic Department',
        credential: 'Degree/Certificate'
      },
      CORPORATE: {
        learner: 'Employee',
        learners: 'Employees',
        instructor: 'Trainer',
        instructors: 'Trainers',
        course: 'Training Program',
        courses: 'Training Programs',
        department: 'Division / Team',
        credential: 'Certification'
      },
      GOVERNMENT: {
        learner: 'Officer / Trainee',
        learners: 'Officers',
        instructor: 'Senior Instructor',
        instructors: 'Instructors',
        course: 'Directive Course',
        courses: 'Directive Courses',
        department: 'Agency / Unit',
        credential: 'Official Qualification'
      },
      NON_PROFIT: {
        learner: 'Volunteer',
        learners: 'Volunteers',
        instructor: 'Program Lead',
        instructors: 'Mentors',
        course: 'Workshop',
        courses: 'Workshops',
        department: 'Field Project',
        credential: 'Recognition Certificate'
      }
    };

    const sectorType = sector || 'CORPORATE';
    const chosenTerminology = terminology 
      ? JSON.stringify(terminology) 
      : JSON.stringify(defaultTerminologies[sectorType] || defaultTerminologies.CORPORATE);

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        sector: sectorType,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || '#2563eb',
        secondaryColor: secondaryColor || '#1e40af',
        timezone: timezone || 'UTC',
        settings: {
          create: {
            terminology: chosenTerminology,
            allowSelfEnrollment: true,
            emailNotifications: true
          }
        },
        certTemplates: {
          create: {
            name: `${name} Official Certificate`,
            title: 'Certificate of Achievement',
            signerName: `${name} Academic Board`,
            signatureTitle: 'Director of Education & Quality'
          }
        }
      },
      include: { settings: true }
    });

    res.status(201).json(org);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create organization.' });
  }
});

// Update organization details & branding (Org Admin or Super Admin)
orgRouter.put('/:id', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logoUrl, primaryColor, secondaryColor, timezone, status } = req.body;

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        logoUrl: logoUrl !== undefined ? logoUrl : undefined,
        primaryColor: primaryColor !== undefined ? primaryColor : undefined,
        secondaryColor: secondaryColor !== undefined ? secondaryColor : undefined,
        timezone: timezone !== undefined ? timezone : undefined,
        status: status !== undefined && req.user?.isSuperAdmin ? status : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization.' });
  }
});

// Update organization settings & sector terminology (Org Admin)
orgRouter.put('/:id/settings', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { terminology, allowSelfEnrollment, emailNotifications, completionPolicy } = req.body;

    const settings = await prisma.organizationSetting.upsert({
      where: { organizationId: id },
      create: {
        organizationId: id,
        terminology: terminology ? JSON.stringify(terminology) : '{}',
        allowSelfEnrollment: allowSelfEnrollment !== undefined ? allowSelfEnrollment : true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
        completionPolicy: completionPolicy ? JSON.stringify(completionPolicy) : '{"requireAllLessons":true,"requirePassQuiz":true}'
      },
      update: {
        terminology: terminology ? (typeof terminology === 'string' ? terminology : JSON.stringify(terminology)) : undefined,
        allowSelfEnrollment: allowSelfEnrollment !== undefined ? allowSelfEnrollment : undefined,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : undefined,
        completionPolicy: completionPolicy ? (typeof completionPolicy === 'string' ? completionPolicy : JSON.stringify(completionPolicy)) : undefined
      }
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization settings.' });
  }
});

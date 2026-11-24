import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../lib/jwt.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

// Register user
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, isSuperAdmin } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'All fields (email, password, firstName, lastName) are required.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        isSuperAdmin: Boolean(isSuperAdmin)
      }
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login user
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, tenantSlug } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            organization: true,
            department: true
          }
        }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Determine active organization membership
    let activeMembership = user.memberships[0];
    if (tenantSlug) {
      const match = user.memberships.find(m => m.organization.slug === tenantSlug);
      if (match) activeMembership = match;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      activeOrgId: activeMembership?.organizationId,
      activeRole: activeMembership?.role
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin
      },
      memberships: user.memberships.map(m => ({
        id: m.id,
        role: m.role,
        title: m.title,
        status: m.status,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          sector: m.organization.sector,
          primaryColor: m.organization.primaryColor,
          logoUrl: m.organization.logoUrl
        },
        department: m.department ? { id: m.department.id, name: m.department.name } : null
      })),
      activeOrganization: activeMembership ? {
        id: activeMembership.organization.id,
        name: activeMembership.organization.name,
        slug: activeMembership.organization.slug,
        sector: activeMembership.organization.sector,
        primaryColor: activeMembership.organization.primaryColor,
        logoUrl: activeMembership.organization.logoUrl,
        role: activeMembership.role
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Login internal error.' });
  }
});

// Current user profile & organizations
authRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        memberships: {
          include: {
            organization: {
              include: { settings: true }
            },
            department: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin
      },
      memberships: user.memberships.map(m => ({
        id: m.id,
        role: m.role,
        title: m.title,
        status: m.status,
        organization: m.organization,
        department: m.department
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { requireRoles } from '../middleware/rbac.js';

export const subscriptionRouter = Router();

// Public / Authenticated: List all subscription plans
subscriptionRouter.get('/plans', async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isPublic: true },
      orderBy: { monthlyPrice: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list subscription plans.' });
  }
});

// Get active tenant subscription and usage analytics
subscriptionRouter.get('/current', authMiddleware, tenantMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;

    const subscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    // Compute live usage
    const [currentUsersCount, currentCoursesCount] = await Promise.all([
      prisma.userMembership.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      prisma.course.count({ where: { organizationId: orgId } })
    ]);

    const maxUsers = subscription?.plan?.maxUsers || 50;
    const maxCourses = subscription?.plan?.maxCourses || 20;

    res.json({
      subscription,
      usage: {
        currentUsersCount,
        maxUsers,
        userUtilizationPct: Math.round((currentUsersCount / maxUsers) * 100),
        currentCoursesCount,
        maxCourses,
        courseUtilizationPct: Math.round((currentCoursesCount / maxCourses) * 100),
        currentStorageGb: 1.2,
        maxStorageGb: subscription?.plan?.maxStorageGb || 10
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve subscription information.' });
  }
});

// Upgrade / Change subscription plan (Tenant Admin / Super Admin)
subscriptionRouter.post('/upgrade', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const { planId, billingCycle } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'planId is required.' });
      return;
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    const cycle = billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const amount = cycle === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;
    const periodDays = cycle === 'ANNUAL' ? 365 : 30;
    const periodEnd = new Date(Date.now() + periodDays * 86400000);

    // Update or create subscription
    const sub = await prisma.organizationSubscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: cycle,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd
      },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: cycle,
        currentPeriodEnd: periodEnd
      },
      include: { plan: true }
    });

    // Create an invoice record
    const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const invoice = await prisma.subscriptionInvoice.create({
      data: {
        organizationId: orgId,
        subscriptionId: sub.id,
        invoiceNumber,
        amount,
        currency: plan.currency,
        status: 'PAID',
        billingDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 86400000),
        paidAt: new Date()
      }
    });

    // Record payment transaction
    await prisma.paymentTransaction.create({
      data: {
        organizationId: orgId,
        invoiceId: invoice.id,
        paymentGateway: 'STRIPE',
        transactionReference: `txn_${crypto.randomBytes(8).toString('hex')}`,
        amount,
        currency: plan.currency,
        status: 'SUCCESS'
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: req.user?.id || null,
        action: 'SUBSCRIPTION_UPGRADED',
        entityType: 'OrganizationSubscription',
        entityId: sub.id,
        details: JSON.stringify({ planName: plan.name, billingCycle: cycle, amount })
      }
    });

    res.status(200).json({
      success: true,
      subscription: sub,
      invoice
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription.' });
  }
});

// List tenant invoices
subscriptionRouter.get('/invoices', authMiddleware, tenantMiddleware, requireRoles('SUPER_ADMIN', 'ORG_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!.id;
    const invoices = await prisma.subscriptionInvoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve invoices.' });
  }
});

// Payment Gateway Webhook Receiver with Idempotency Protection
subscriptionRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, eventType, organizationId, amount, transactionRef } = req.body;

    if (!transactionRef) {
      res.status(400).json({ error: 'transactionRef required for idempotency' });
      return;
    }

    // Check if this transaction was already processed (Idempotency)
    const existingTx = await prisma.paymentTransaction.findUnique({
      where: { transactionReference: transactionRef }
    });

    if (existingTx) {
      // Return 200 OK without re-processing
      res.status(200).json({ message: 'Event already processed (idempotent)', transactionId: existingTx.id });
      return;
    }

    // Process new event
    if (organizationId) {
      await prisma.paymentTransaction.create({
        data: {
          organizationId,
          transactionReference: transactionRef,
          amount: amount || 0,
          currency: 'USD',
          status: 'SUCCESS',
          webhookPayloadJson: JSON.stringify(req.body)
        }
      });
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

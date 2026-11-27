import crypto from 'node:crypto';
import {
  SubscriptionPlan,
  PlanFeature,
  OrganizationSubscription,
  SubscriptionInvoice,
  OrganizationModule,
  Organization,
  Course,
  OrganizationMembership,
  PaymentTransaction,
  SubscriptionEvent,
  withPlatformContext,
  withTenantContext
} from '../models/index.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { auditFromReq, recordAudit } from '../services/audit.service.js';

export class SubscriptionController {
  static async listPlans(_req, res, next) {
    try {
      const plans = await withPlatformContext(async (t) => {
        return SubscriptionPlan.findAll({
          where: { is_active: true, is_public: true },
          include: [{ model: PlanFeature, as: 'features' }],
          order: [['tier_order', 'ASC']],
          transaction: t
        });
      });
      return res.status(200).json({ data: plans });
    } catch (err) {
      next(err);
    }
  }

  static async getCurrent(req, res, next) {
    try {
      const details = await withTenantContext(req.organizationId, async (t) => {
        const usersCount = await OrganizationMembership.count({
          where: { organization_id: req.organizationId },
          transaction: t
        });
        const coursesCount = await Course.count({
          where: { organization_id: req.organizationId },
          transaction: t
        });

        const daysUntilRenewal = req.subscription?.current_period_end
          ? Math.ceil((new Date(req.subscription.current_period_end) - Date.now()) / 86400000)
          : null;

        const events = await SubscriptionEvent.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          limit: 20,
          transaction: t
        });

        return {
          subscription: req.subscription,
          entitlements: req.entitlements,
          renewalAlert: daysUntilRenewal !== null && daysUntilRenewal <= 14 ? { daysRemaining: daysUntilRenewal } : null,
          usage: {
            usersCount,
            coursesCount,
            storageBytes: Number(req.organization?.storage_used_bytes || 0)
          },
          events
        };
      });

      return res.status(200).json(details);
    } catch (err) {
      next(err);
    }
  }

  static async changePlan(req, res, next) {
    try {
      const { planId, billingCycle } = req.body;
      const result = await withPlatformContext(async (t) => {
        const plan = await SubscriptionPlan.findOne({
          where: { id: planId, is_active: true },
          transaction: t
        });
        if (!plan) throw new NotFoundError('Subscription Plan');

        const price = billingCycle === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
        const sub = await OrganizationSubscription.findOne({
          where: { organization_id: req.organizationId },
          transaction: t
        });
        if (!sub) throw new NotFoundError('Subscription');

        await sub.update(
          {
            plan_id: plan.id,
            billing_cycle: billingCycle,
            unit_price_cents: price,
            status: sub.status === 'trial' ? 'active' : sub.status
          },
          { transaction: t }
        );

        // Update module entitlements
        const features = await PlanFeature.findAll({ where: { plan_id: plan.id }, transaction: t });
        for (const f of features) {
          const existingMod = await OrganizationModule.findOne({
            where: { organization_id: req.organizationId, module_key: f.module_key },
            transaction: t
          });
          if (existingMod) {
            await existingMod.update({ is_enabled: f.is_enabled, source: 'plan' }, { transaction: t });
          } else {
            await OrganizationModule.create(
              {
                organization_id: req.organizationId,
                module_key: f.module_key,
                is_enabled: f.is_enabled,
                source: 'plan'
              },
              { transaction: t }
            );
          }
        }

        const invoiceNum = `INV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
        const invoice = await SubscriptionInvoice.create(
          {
            organization_id: req.organizationId,
            subscription_id: sub.id,
            invoice_number: invoiceNum,
            amount_cents: price,
            total_cents: price,
            currency: plan.currency,
            status: price === 0 ? 'paid' : 'open',
            due_date: new Date(Date.now() + 7 * 86400 * 1000),
            line_items: [{ description: `${plan.name} (${billingCycle})`, amountCents: price }]
          },
          { transaction: t }
        );

        await SubscriptionEvent.create(
          {
            organization_id: req.organizationId,
            subscription_id: sub.id,
            event_type: 'plan_changed',
            actor_user_id: req.user.id,
            payload: { planCode: plan.code, billingCycle }
          },
          { transaction: t }
        );

        return { subscription: sub, invoice, plan };
      });

      await auditFromReq(req, 'billing.plan_changed', 'subscription', result.subscription.id, {
        planCode: result.plan.code,
        billingCycle
      });

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listInvoices(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const invoices = await SubscriptionInvoice.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          transaction: t
        });
        const transactions = await PaymentTransaction.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          transaction: t
        });
        return { invoices, transactions };
      });
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async cancelSubscription(req, res, next) {
    try {
      const updated = await withPlatformContext(async (t) => {
        const sub = await OrganizationSubscription.findOne({
          where: { organization_id: req.organizationId },
          transaction: t
        });
        if (!sub) throw new NotFoundError('Subscription');
        await sub.update({ auto_renew: false, cancelled_at: new Date() }, { transaction: t });
        return sub;
      });

      await auditFromReq(req, 'billing.cancelled', 'subscription', updated.id);
      return res.status(200).json({ success: true, message: 'Subscription auto-renew cancelled' });
    } catch (err) {
      next(err);
    }
  }

  static async handleWebhook(req, res, next) {
    try {
      const provider = (req.params.provider || 'stripe').toLowerCase();
      if (!['stripe', 'razorpay'].includes(provider)) {
        throw new BadRequestError('Unsupported payment provider');
      }

      const rawBody = req.rawBody || JSON.stringify(req.body);
      const secret = provider === 'stripe' ? env.STRIPE_WEBHOOK_SECRET : env.RAZORPAY_WEBHOOK_SECRET;

      if (secret) {
        const sigHeader = provider === 'stripe' ? req.headers['stripe-signature'] : req.headers['x-razorpay-signature'];
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const sigBuf = Buffer.from(String(sigHeader || ''));
        const expBuf = Buffer.from(expected);
        if (!sigHeader || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          throw new ForbiddenError('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
        }
      } else if (env.isProd) {
        throw new ForbiddenError('Webhook secret is not configured');
      }

      const { eventId, eventType, organizationId, invoiceId, paymentId, amountCents, currency = 'USD' } = req.body;
      if (!eventId || !organizationId) {
        throw new BadRequestError('Webhook payload missing eventId or organizationId');
      }

      const result = await withPlatformContext(async (t) => {
        const existing = await PaymentTransaction.findOne({
          where: { provider, provider_event_id: eventId },
          transaction: t
        });

        if (existing) {
          return { idempotent: true, transaction: existing };
        }

        const status = eventType === 'payment.succeeded' || eventType === 'invoice.paid' ? 'succeeded' : 'failed';

        const tx = await PaymentTransaction.create(
          {
            organization_id: organizationId,
            invoice_id: invoiceId || null,
            provider,
            provider_payment_id: paymentId || eventId,
            provider_event_id: eventId,
            amount_cents: amountCents || 0,
            currency,
            status,
            raw_payload: req.body,
            processed_at: new Date()
          },
          { transaction: t }
        );

        if (status === 'succeeded' && invoiceId) {
          await SubscriptionInvoice.update(
            { status: 'paid', paid_at: new Date() },
            { where: { organization_id: organizationId, id: invoiceId }, transaction: t }
          );

          const sub = await OrganizationSubscription.findOne({
            where: { organization_id: organizationId },
            transaction: t
          });

          if (sub) {
            const periodEnd = sub.billing_cycle === 'annual'
              ? new Date(Date.now() + 365 * 86400 * 1000)
              : new Date(Date.now() + 30 * 86400 * 1000);

            await sub.update(
              {
                status: 'active',
                current_period_start: new Date(),
                current_period_end: periodEnd,
                grace_ends_at: null
              },
              { transaction: t }
            );
          }
        } else if (status === 'failed') {
          await OrganizationSubscription.update(
            {
              status: 'past_due',
              grace_ends_at: new Date(Date.now() + 7 * 86400 * 1000)
            },
            {
              where: { organization_id: organizationId },
              transaction: t
            }
          );
        }

        await SubscriptionEvent.create(
          {
            organization_id: organizationId,
            event_type: `webhook.${eventType || status}`,
            payload: { provider, eventId, invoiceId }
          },
          { transaction: t }
        );

        return { idempotent: false, transaction: tx };
      });

      await recordAudit({
        organizationId,
        action: `billing.webhook_${provider}`,
        resourceType: 'payment_transaction',
        resourceId: result.transaction.id,
        details: { idempotent: result.idempotent, eventId }
      });

      return res.status(200).json({ received: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async checkout(req, res, next) {
    try {
      const { invoiceId, provider = env.PAYMENT_DEFAULT_PROVIDER } = req.body;
      const invoice = await withTenantContext(req.organizationId, async (t) => {
        const inv = await SubscriptionInvoice.findOne({
          where: { organization_id: req.organizationId, id: invoiceId },
          transaction: t
        });
        if (!inv) throw new NotFoundError('Invoice');
        return inv;
      });

      const checkoutRef = `${provider}_chk_${crypto.randomBytes(10).toString('hex')}`;
      return res.status(200).json({
        provider,
        checkoutRef,
        invoiceId: invoice.id,
        amountCents: invoice.total_cents,
        currency: invoice.currency,
        configured: provider === 'stripe' ? Boolean(env.STRIPE_SECRET_KEY) : Boolean(env.RAZORPAY_KEY_ID)
      });
    } catch (err) {
      next(err);
    }
  }
}

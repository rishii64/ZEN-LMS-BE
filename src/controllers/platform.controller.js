import { Op, fn, col } from 'sequelize';
import {
  Organization,
  OrganizationSetting,
  OrganizationModule,
  OrganizationSubscription,
  SubscriptionPlan,
  PlanFeature,
  User,
  OrganizationMembership,
  Role,
  RolePermission,
  Permission,
  UserInvitation,
  PlatformSetting,
  PlatformAnnouncement,
  AuditLog,
  Course,
  Enrollment,
  withPlatformContext
} from '../models/index.js';
import { hashPassword, randomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import { auditFromReq } from '../services/audit.service.js';
import { emitAnnouncement } from '../services/socket.service.js';

export class PlatformController {
  static async getDashboard(_req, res, next) {
    try {
      const metrics = await withPlatformContext(async (t) => {
        const totalOrganizations = await Organization.count({ transaction: t });
        const activeTenants = await Organization.count({ where: { status: 'active' }, transaction: t });
        const suspendedTenants = await Organization.count({ where: { status: 'suspended' }, transaction: t });
        const pendingTenants = await Organization.count({ where: { status: 'pending_approval' }, transaction: t });
        const totalStorageBytes = (await Organization.sum('storage_used_bytes', { transaction: t })) || 0;

        const totalUsers = await User.count({ transaction: t });
        const activeUsers = await User.count({ where: { is_active: true }, transaction: t });

        const activeLearners = await Enrollment.count({
          where: { status: 'active' },
          distinct: true,
          col: 'membership_id',
          transaction: t
        });

        const totalCourses = await Course.count({ transaction: t });
        const publishedCourses = await Course.count({ where: { status: 'published' }, transaction: t });

        const activeSubscriptions = await OrganizationSubscription.count({
          where: { status: { [Op.in]: ['active', 'trial'] } },
          transaction: t
        });

        const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400 * 1000);
        const expiringSubscriptions = await OrganizationSubscription.count({
          where: {
            status: { [Op.in]: ['active', 'trial'] },
            current_period_end: { [Op.lte]: thirtyDaysFromNow }
          },
          transaction: t
        });

        const activeSubRows = await OrganizationSubscription.findAll({
          where: { status: { [Op.in]: ['active', 'trial'] } },
          attributes: ['id', 'billing_cycle', 'unit_price_cents', 'status'],
          transaction: t
        });
        const mrrCents = activeSubRows.reduce((sum, sub) => {
          const price = Number(sub.unit_price_cents) || 0;
          return sum + (sub.billing_cycle === 'annual' ? Math.round(price / 12) : price);
        }, 0);

        const plans = await SubscriptionPlan.findAll({
          include: [
            {
              model: OrganizationSubscription,
              as: 'subscriptions',
              required: false,
              where: { status: { [Op.in]: ['active', 'trial'] } }
            }
          ],
          order: [['tier_order', 'ASC']],
          transaction: t
        });

        const planDist = plans.map((p) => ({
          name: p.name,
          code: p.code,
          tenant_count: p.subscriptions?.length || 0
        }));

        const recentOrgs = await Organization.findAll({
          include: [
            {
              model: OrganizationSubscription,
              as: 'subscriptions',
              required: false,
              include: [{ model: SubscriptionPlan, as: 'plan', required: false }]
            }
          ],
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const orgIds = recentOrgs.map((o) => o.id);
        const [memCounts, courseCounts, enrCounts] = orgIds.length
          ? await Promise.all([
              OrganizationMembership.findAll({
                where: { organization_id: { [Op.in]: orgIds } },
                attributes: ['organization_id', [fn('COUNT', col('id')), 'cnt']],
                group: ['organization_id'],
                raw: true,
                transaction: t
              }),
              Course.findAll({
                where: { organization_id: { [Op.in]: orgIds } },
                attributes: ['organization_id', [fn('COUNT', col('id')), 'cnt']],
                group: ['organization_id'],
                raw: true,
                transaction: t
              }),
              Enrollment.findAll({
                where: { organization_id: { [Op.in]: orgIds } },
                attributes: ['organization_id', [fn('COUNT', col('id')), 'cnt']],
                group: ['organization_id'],
                raw: true,
                transaction: t
              })
            ])
          : [[], [], []];

        const memMap = new Map(memCounts.map((r) => [r.organization_id, Number(r.cnt)]));
        const courseMap = new Map(courseCounts.map((r) => [r.organization_id, Number(r.cnt)]));
        const enrMap = new Map(enrCounts.map((r) => [r.organization_id, Number(r.cnt)]));

        const tenantsData = recentOrgs.map((org) => {
          const currentSub = org.subscriptions?.[0] || null;
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            organization_type: org.organization_type,
            contact_email: org.contact_email,
            status: org.status,
            storage_used_bytes: Number(org.storage_used_bytes) || 0,
            plan_name: currentSub?.plan?.name || null,
            subscription_status: currentSub?.status || null,
            billing_cycle: currentSub?.billing_cycle || null,
            users_count: memMap.get(org.id) || 0,
            courses_count: courseMap.get(org.id) || 0,
            enrollments_count: enrMap.get(org.id) || 0,
            created_at: org.created_at
          };
        });

        const platformUsers = await User.findAll({
          attributes: [
            'id',
            'email',
            'phone',
            'full_name',
            'is_active',
            'is_platform_admin',
            'platform_role',
            'mfa_enabled',
            'last_login_at',
            'created_at'
          ],
          include: [
            {
              model: OrganizationMembership,
              as: 'memberships',
              required: false,
              attributes: ['id', 'organization_id', 'is_org_admin', 'status', 'job_title'],
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  attributes: ['id', 'name', 'slug'],
                  required: false
                }
              ]
            }
          ],
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const usersData = platformUsers.map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          full_name: u.full_name,
          is_active: u.is_active,
          is_platform_admin: u.is_platform_admin,
          platform_role: u.platform_role,
          mfa_enabled: u.mfa_enabled,
          last_login_at: u.last_login_at,
          created_at: u.created_at,
          organizations: (u.memberships || []).map((m) => ({
            organization_id: m.organization_id,
            organization_name: m.organization?.name || 'Unknown',
            organization_slug: m.organization?.slug || '',
            is_org_admin: m.is_org_admin,
            status: m.status,
            job_title: m.job_title
          }))
        }));

        const recentAudits = await AuditLog.findAll({
          include: [{ model: Organization, as: 'organization', attributes: ['name'], required: false }],
          order: [['created_at', 'DESC']],
          limit: 10,
          transaction: t
        });

        return {
          generatedAt: new Date().toISOString(),
          summary: {
            total_organizations: totalOrganizations,
            active_tenants: activeTenants,
            suspended_tenants: suspendedTenants,
            pending_tenants: pendingTenants,
            total_storage_bytes: Number(totalStorageBytes),
            total_users: totalUsers,
            active_users: activeUsers,
            active_learners: activeLearners,
            total_courses: totalCourses,
            published_courses: publishedCourses,
            active_subscriptions: activeSubscriptions,
            expiring_subscriptions: expiringSubscriptions,
            mrr_cents: mrrCents
          },
          subscriptionDistribution: planDist,
          recentRegistrations: tenantsData.slice(0, 6),
          tenants: tenantsData,
          users: usersData,
          recentActivities: recentAudits.map((a) => ({
            id: a.id,
            action: a.action,
            resource_type: a.resource_type,
            actor_email: a.actor_email,
            created_at: a.created_at,
            organization_name: a.organization?.name || null
          }))
        };
      });

      return res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }

  static async listOrganizations(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const statusFilter = req.query.status || null;

      const data = await withPlatformContext(async (t) => {
        const whereClause = {};
        if (statusFilter) whereClause.status = statusFilter;
        if (pg.search) {
          whereClause[Op.or] = [
            { name: { [Op.iLike]: `%${pg.search}%` } },
            { slug: { [Op.iLike]: `%${pg.search}%` } },
            { contact_email: { [Op.iLike]: `%${pg.search}%` } }
          ];
        }

        const { count, rows } = await Organization.findAndCountAll({
          where: whereClause,
          include: [
            {
              model: OrganizationSubscription,
              as: 'subscriptions',
              required: false,
              include: [{ model: SubscriptionPlan, as: 'plan', required: false }]
            }
          ],
          distinct: true,
          limit: pg.limit,
          offset: pg.offset,
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const orgIds = rows.map((o) => o.id);
        const [memCounts, courseCounts] = orgIds.length
          ? await Promise.all([
              OrganizationMembership.findAll({
                where: { organization_id: { [Op.in]: orgIds } },
                attributes: ['organization_id', [fn('COUNT', col('id')), 'cnt']],
                group: ['organization_id'],
                raw: true,
                transaction: t
              }),
              Course.findAll({
                where: { organization_id: { [Op.in]: orgIds } },
                attributes: ['organization_id', [fn('COUNT', col('id')), 'cnt']],
                group: ['organization_id'],
                raw: true,
                transaction: t
              })
            ])
          : [[], []];

        const memMap = new Map(memCounts.map((r) => [r.organization_id, Number(r.cnt)]));
        const courseMap = new Map(courseCounts.map((r) => [r.organization_id, Number(r.cnt)]));

        const formatted = rows.map((org) => {
          const currentSub = org.subscriptions?.[0] || null;
          return {
            ...org.toJSON(),
            plan_name: currentSub?.plan?.name || null,
            plan_code: currentSub?.plan?.code || null,
            subscription_status: currentSub?.status || null,
            current_period_end: currentSub?.current_period_end || null,
            users_count: memMap.get(org.id) || 0,
            courses_count: courseMap.get(org.id) || 0
          };
        });

        return paginatedResponse(formatted, count, pg);
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createOrganization(req, res, next) {
    try {
      const b = req.body;
      const result = await withPlatformContext(async (t) => {
        const plan = await SubscriptionPlan.findByPk(b.planId, { transaction: t });
        if (!plan) throw new NotFoundError('Subscription Plan');

        const orgStatus = b.activateImmediately ? 'active' : 'pending_approval';

        const org = await Organization.create(
          {
            slug: b.slug,
            name: b.name,
            legal_name: b.legalName || b.name,
            industry: b.industry || null,
            organization_type: b.organizationType,
            contact_email: b.contactEmail,
            contact_phone: b.contactPhone || null,
            country: b.country || null,
            status: orgStatus,
            approved_at: b.activateImmediately ? new Date() : null,
            approved_by: b.activateImmediately ? req.user.id : null
          },
          { transaction: t }
        );

        await OrganizationSetting.create({ organization_id: org.id }, { transaction: t });

        // Copy modules from plan_features
        const features = await PlanFeature.findAll({ where: { plan_id: plan.id }, transaction: t });
        for (const f of features) {
          await OrganizationModule.create(
            {
              organization_id: org.id,
              module_key: f.module_key,
              is_enabled: f.is_enabled,
              source: 'plan'
            },
            { transaction: t }
          );
        }

        const trialDays = b.trialDays ?? plan.trial_days;
        const unitPrice = b.billingCycle === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
        const subStatus = trialDays > 0 ? 'trial' : 'active';
        const periodDays = trialDays > 0 ? trialDays : b.billingCycle === 'annual' ? 365 : 30;
        const periodEnd = new Date(Date.now() + periodDays * 86400 * 1000);

        const sub = await OrganizationSubscription.create(
          {
            organization_id: org.id,
            plan_id: plan.id,
            status: subStatus,
            billing_cycle: b.billingCycle,
            currency: plan.currency,
            unit_price_cents: unitPrice,
            custom_max_users: b.customMaxUsers || null,
            custom_max_courses: b.customMaxCourses || null,
            custom_max_storage_bytes: b.customMaxStorageBytes || null,
            trial_ends_at: trialDays > 0 ? new Date(Date.now() + trialDays * 86400 * 1000) : null,
            current_period_end: periodEnd
          },
          { transaction: t }
        );

        // Copy global template roles into tenant scope
        const templateRoles = await Role.findAll({
          where: { organization_id: null, is_system_template: true },
          include: [{ model: RolePermission, as: 'rolePermissions' }],
          transaction: t
        });

        for (const tr of templateRoles) {
          const newRole = await Role.create(
            {
              organization_id: org.id,
              name: tr.name,
              slug: tr.slug,
              description: tr.description,
              is_system_template: true,
              created_by: req.user.id
            },
            { transaction: t }
          );

          for (const tp of tr.rolePermissions || []) {
            await RolePermission.create(
              {
                role_id: newRole.id,
                organization_id: org.id,
                permission_id: tp.permission_id,
                scope: tp.scope,
                allow: tp.allow
              },
              { transaction: t }
            );
          }
        }

        const inviteToken = randomToken(24);
        const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);
        await UserInvitation.create(
          {
            organization_id: org.id,
            email: b.adminEmail,
            full_name: b.adminFullName,
            token: inviteToken,
            is_org_admin: true,
            invited_by: req.user.id,
            expires_at: expiresAt
          },
          { transaction: t }
        );

        let initialAdminUser = null;
        if (b.adminTemporaryPassword) {
          const pwHash = await hashPassword(b.adminTemporaryPassword);
          const [adminUser] = await User.findOrCreate({
            where: { email: b.adminEmail.toLowerCase() },
            defaults: {
              email: b.adminEmail.toLowerCase(),
              full_name: b.adminFullName,
              password_hash: pwHash,
              email_verified_at: new Date(),
              is_active: true
            },
            transaction: t
          });

          await OrganizationMembership.findOrCreate({
            where: { organization_id: org.id, user_id: adminUser.id },
            defaults: {
              organization_id: org.id,
              user_id: adminUser.id,
              is_org_admin: true,
              status: 'active'
            },
            transaction: t
          });

          initialAdminUser = {
            id: adminUser.id,
            email: adminUser.email,
            fullName: adminUser.full_name
          };
        }

        return {
          organization: org,
          subscription: sub,
          inviteToken,
          invitationToken: inviteToken,
          adminUser: initialAdminUser
        };
      });

      await auditFromReq(req, 'organization.create', 'organization', result.organization.id, {
        slug: result.organization.slug,
        planId: b.planId
      });

      return res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOrganization(req, res, next) {
    try {
      const org = await withPlatformContext(async (t) => {
        const record = await Organization.findByPk(req.params.id, {
          include: [
            { model: OrganizationSetting, as: 'settings' },
            {
              model: OrganizationSubscription,
              as: 'subscriptions',
              include: [{ model: SubscriptionPlan, as: 'plan' }]
            }
          ],
          transaction: t
        });
        if (!record) throw new NotFoundError('Organization');
        return record;
      });

      return res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrganizationStatus(req, res, next) {
    try {
      const { status, suspensionReason } = req.body;
      const validStatuses = ['active', 'suspended', 'inactive', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const updated = await withPlatformContext(async (t) => {
        const org = await Organization.findByPk(req.params.id, { transaction: t });
        if (!org) throw new NotFoundError('Organization');

        const updates = { status };
        if (status === 'suspended') {
          updates.suspended_at = new Date();
          updates.suspension_reason = suspensionReason || 'Administrative suspension';
        } else if (status === 'active') {
          updates.suspended_at = null;
          updates.suspension_reason = null;
          if (!org.approved_at) {
            updates.approved_at = new Date();
            updates.approved_by = req.user.id;
          }
        }
        await org.update(updates, { transaction: t });
        return org;
      });

      await auditFromReq(req, 'organization.status_change', 'organization', updated.id, {
        status,
        suspensionReason
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async listPlans(_req, res, next) {
    try {
      const plans = await withPlatformContext(async (t) => {
        return SubscriptionPlan.findAll({
          include: [{ model: PlanFeature, as: 'features' }],
          order: [['tier_order', 'ASC']],
          transaction: t
        });
      });
      return res.status(200).json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  static async createPlan(req, res, next) {
    try {
      const b = req.body;
      const plan = await withPlatformContext(async (t) => {
        const newPlan = await SubscriptionPlan.create(
          {
            code: b.code,
            name: b.name,
            description: b.description,
            tier_order: b.tierOrder || 1,
            monthly_price_cents: b.monthlyPriceCents,
            annual_price_cents: b.annualPriceCents,
            currency: b.currency || 'USD',
            trial_days: b.trialDays ?? 14,
            grace_period_days: b.gracePeriodDays ?? 7,
            max_users: b.maxUsers,
            max_courses: b.maxCourses,
            max_storage_bytes: b.maxStorageBytes,
            max_custom_roles: b.maxCustomRoles ?? 10
          },
          { transaction: t }
        );

        if (Array.isArray(b.features)) {
          for (const f of b.features) {
            await PlanFeature.create(
              {
                plan_id: newPlan.id,
                module_key: f.moduleKey,
                is_enabled: f.isEnabled !== false,
                limit_value: f.limitValue || null
              },
              { transaction: t }
            );
          }
        }
        return newPlan;
      });

      await auditFromReq(req, 'plan.create', 'subscription_plan', plan.id, { code: plan.code });
      return res.status(201).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  static async listAuditLogs(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const data = await withPlatformContext(async (t) => {
        const whereClause = {};
        if (req.query.organizationId) whereClause.organization_id = req.query.organizationId;
        if (req.query.action) whereClause.action = req.query.action;

        const { count, rows } = await AuditLog.findAndCountAll({
          where: whereClause,
          limit: pg.limit,
          offset: pg.offset,
          order: [['created_at', 'DESC']],
          transaction: t
        });

        return paginatedResponse(rows, count, pg);
      });
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async listAnnouncements(_req, res, next) {
    try {
      const rows = await withPlatformContext(async (t) => {
        return PlatformAnnouncement.findAll({
          order: [['published_at', 'DESC']],
          limit: 50,
          transaction: t
        });
      });
      return res.status(200).json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async createAnnouncement(req, res, next) {
    try {
      const b = req.body;
      const ann = await withPlatformContext(async (t) => {
        return PlatformAnnouncement.create(
          {
            title: b.title,
            body: b.body,
            severity: b.severity || 'info',
            target_audience: b.targetAudience || 'all_tenants',
            expires_at: b.expiresAt || null,
            created_by: req.user.id
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'announcement.create', 'platform_announcement', ann.id);
      emitAnnouncement(ann.toJSON());
      return res.status(201).json({ success: true, data: ann });
    } catch (err) {
      next(err);
    }
  }

  static async getPlatformSettings(_req, res, next) {
    try {
      const settings = await withPlatformContext(async (t) => {
        return PlatformSetting.findAll({ transaction: t });
      });
      return res.status(200).json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  static async updatePlatformSetting(req, res, next) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      const [setting] = await withPlatformContext(async (t) => {
        return PlatformSetting.upsert(
          {
            key,
            value,
            description: description || null,
            updated_by: req.user.id
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'platform_setting.update', 'platform_setting', key);
      return res.status(200).json({ success: true, data: setting });
    } catch (err) {
      next(err);
    }
  }
}

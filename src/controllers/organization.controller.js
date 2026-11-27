import {
  Organization,
  OrganizationSetting,
  OrganizationDomain,
  CustomFieldDefinition,
  WorkflowDefinition,
  Course,
  OrganizationMembership,
  withTenantContext
} from '../models/index.js';
import { EntitlementError, NotFoundError } from '../utils/errors.js';
import { randomToken } from '../utils/crypto.js';
import { auditFromReq } from '../services/audit.service.js';

export class OrganizationController {
  static async getCurrent(req, res, next) {
    try {
      const details = await withTenantContext(req.organizationId, async (t) => {
        const domains = await OrganizationDomain.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          transaction: t
        });
        const customFields = await CustomFieldDefinition.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'ASC']],
          transaction: t
        });
        const workflows = await WorkflowDefinition.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'ASC']],
          transaction: t
        });
        const activeUsers = await OrganizationMembership.count({
          where: { organization_id: req.organizationId, status: 'active' },
          transaction: t
        });
        const coursesCount = await Course.count({
          where: { organization_id: req.organizationId },
          transaction: t
        });

        return {
          domains,
          customFields,
          workflows,
          usage: {
            active_users: activeUsers,
            courses_count: coursesCount,
            storageBytes: Number(req.organization?.storage_used_bytes || 0)
          }
        };
      });

      return res.status(200).json({
        organization: req.organization,
        subscription: req.subscription,
        entitlements: req.entitlements,
        ...details
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCurrent(req, res, next) {
    try {
      const b = req.body;
      const changingBranding = b.primaryColor !== undefined || b.secondaryColor !== undefined || b.logoUrl !== undefined;
      if (changingBranding && req.entitlements?.modules?.custom_branding === false) {
        throw new EntitlementError('custom_branding');
      }

      const updated = await withTenantContext(req.organizationId, async (t) => {
        const org = await Organization.findByPk(req.organizationId, { transaction: t });
        if (!org) throw new NotFoundError('Organization');

        const orgUpdates = {};
        if (b.name) orgUpdates.name = b.name;
        if (b.legalName) orgUpdates.legal_name = b.legalName;
        if (b.industry) orgUpdates.industry = b.industry;
        if (b.contactEmail) orgUpdates.contact_email = b.contactEmail;
        if (b.contactPhone) orgUpdates.contact_phone = b.contactPhone;
        if (b.country) orgUpdates.country = b.country;
        if (Object.keys(orgUpdates).length > 0) {
          await org.update(orgUpdates, { transaction: t });
        }

        const [settings] = await OrganizationSetting.findOrCreate({
          where: { organization_id: req.organizationId },
          defaults: { organization_id: req.organizationId },
          transaction: t
        });

        const settingUpdates = {};
        if (b.logoUrl !== undefined) settingUpdates.logo_url = b.logoUrl;
        if (b.primaryColor) settingUpdates.primary_color = b.primaryColor;
        if (b.secondaryColor) settingUpdates.secondary_color = b.secondaryColor;
        if (b.defaultLanguage) settingUpdates.default_language = b.defaultLanguage;
        if (b.timezone) settingUpdates.timezone = b.timezone;
        if (b.dateFormat) settingUpdates.date_format = b.dateFormat;
        if (b.timeFormat) settingUpdates.time_format = b.timeFormat;
        if (b.terminology) settingUpdates.terminology = { ...settings.terminology, ...b.terminology };
        if (b.completionPolicy) settingUpdates.completion_policy = { ...settings.completion_policy, ...b.completionPolicy };
        if (b.securityPolicy) settingUpdates.security_policy = { ...settings.security_policy, ...b.securityPolicy };
        if (b.retentionPolicy) settingUpdates.retention_policy = { ...settings.retention_policy, ...b.retentionPolicy };
        if (b.dashboardLayout) settingUpdates.dashboard_layout = { ...settings.dashboard_layout, ...b.dashboardLayout };

        if (Object.keys(settingUpdates).length > 0) {
          await settings.update(settingUpdates, { transaction: t });
        }

        return { ...org.toJSON(), settings: settings.toJSON() };
      });

      await auditFromReq(req, 'organization.update_settings', 'organization', req.organizationId, b);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async listDomains(req, res, next) {
    try {
      const domains = await withTenantContext(req.organizationId, async (t) => {
        return OrganizationDomain.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          transaction: t
        });
      });
      return res.status(200).json({ data: domains });
    } catch (err) {
      next(err);
    }
  }

  static async addDomain(req, res, next) {
    try {
      const { domain } = req.body;
      const token = randomToken(16);
      const row = await withTenantContext(req.organizationId, async (t) => {
        return OrganizationDomain.create(
          {
            organization_id: req.organizationId,
            domain: domain.toLowerCase().trim(),
            verification_token: token
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async verifyDomain(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const dom = await OrganizationDomain.findOne({
          where: { id, organization_id: req.organizationId },
          transaction: t
        });
        if (!dom) throw new NotFoundError('Domain');
        await dom.update({ is_verified: true, verified_at: new Date() }, { transaction: t });
        return dom;
      });
      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDomain(req, res, next) {
    try {
      const { id } = req.params;
      await withTenantContext(req.organizationId, async (t) => {
        await OrganizationDomain.destroy({
          where: { id, organization_id: req.organizationId },
          transaction: t
        });
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

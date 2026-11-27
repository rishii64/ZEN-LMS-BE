import { Op } from 'sequelize';
import {
  Role,
  RolePermission,
  Permission,
  MembershipRole,
  withTenantContext,
  withPlatformContext
} from '../models/index.js';
import { NotFoundError, QuotaExceededError, BadRequestError } from '../utils/errors.js';
import { auditFromReq } from '../services/audit.service.js';

export class RoleController {
  static async listPermissions(_req, res, next) {
    try {
      const rows = await withPlatformContext(async (t) => {
        return Permission.findAll({
          where: { is_platform_only: false },
          order: [
            ['module', 'ASC'],
            ['action', 'ASC']
          ],
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async listRoles(req, res, next) {
    try {
      const roles = await withTenantContext(req.organizationId, async (t) => {
        const records = await Role.findAll({
          where: { organization_id: req.organizationId },
          include: [
            {
              model: RolePermission,
              as: 'rolePermissions',
              include: [{ model: Permission, as: 'permission' }]
            }
          ],
          order: [['name', 'ASC']],
          transaction: t
        });

        const formatted = records.map((role) => ({
          ...role.toJSON(),
          permissions: (role.rolePermissions || []).map((rp) => ({
            role_id: rp.role_id,
            scope: rp.scope,
            allow: rp.allow,
            permission_id: rp.permission_id,
            module: rp.permission?.module,
            action: rp.permission?.action,
            description: rp.permission?.description
          }))
        }));

        return formatted;
      });

      return res.status(200).json({ data: roles });
    } catch (err) {
      next(err);
    }
  }

  static async createRole(req, res, next) {
    try {
      const b = req.body;
      const slug = b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const created = await withTenantContext(req.organizationId, async (t) => {
        const count = await Role.count({
          where: { organization_id: req.organizationId, is_system_template: false },
          transaction: t
        });

        const maxRoles = req.entitlements?.limits?.maxCustomRoles ?? 10;
        if (count >= maxRoles) {
          throw new QuotaExceededError(`Custom role limit (${maxRoles}) reached for your subscription plan.`);
        }

        const role = await Role.create(
          {
            organization_id: req.organizationId,
            name: b.name,
            slug,
            description: b.description || null,
            combination_rule: b.combinationRule || 'union_widest',
            created_by: req.user.id
          },
          { transaction: t }
        );

        if (Array.isArray(b.permissions)) {
          for (const perm of b.permissions) {
            let permId = perm.permissionId;
            if (!permId && perm.module && perm.action) {
              const p = await Permission.findOne({
                where: { module: perm.module, action: perm.action },
                transaction: t
              });
              permId = p?.id;
            }
            if (permId) {
              await RolePermission.upsert(
                {
                  role_id: role.id,
                  organization_id: req.organizationId,
                  permission_id: permId,
                  scope: perm.scope || 'organization',
                  allow: perm.allow !== false
                },
                { transaction: t }
              );
            }
          }
        }

        return role;
      });

      await auditFromReq(req, 'rbac.role_created', 'role', created.id, { name: created.name });
      return res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  }

  static async getRole(req, res, next) {
    try {
      const role = await withTenantContext(req.organizationId, async (t) => {
        const record = await Role.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          include: [
            {
              model: RolePermission,
              as: 'rolePermissions',
              include: [{ model: Permission, as: 'permission' }]
            }
          ],
          transaction: t
        });
        if (!record) throw new NotFoundError('Role');
        return record;
      });
      return res.status(200).json({ data: role });
    } catch (err) {
      next(err);
    }
  }

  static async updateRole(req, res, next) {
    try {
      const b = req.body;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const role = await Role.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!role) throw new NotFoundError('Role');

        const updates = {};
        if (b.name) updates.name = b.name;
        if (b.description !== undefined) updates.description = b.description;
        if (b.combinationRule) updates.combination_rule = b.combinationRule;
        if (b.isActive !== undefined) updates.is_active = b.isActive;

        await role.update(updates, { transaction: t });

        if (Array.isArray(b.permissions)) {
          await RolePermission.destroy({ where: { role_id: role.id }, transaction: t });
          for (const perm of b.permissions) {
            let permId = perm.permissionId;
            if (!permId && perm.module && perm.action) {
              const p = await Permission.findOne({
                where: { module: perm.module, action: perm.action },
                transaction: t
              });
              permId = p?.id;
            }
            if (permId) {
              await RolePermission.create(
                {
                  role_id: role.id,
                  organization_id: req.organizationId,
                  permission_id: permId,
                  scope: perm.scope || 'organization',
                  allow: perm.allow !== false
                },
                { transaction: t }
              );
            }
          }
        }
        return role;
      });

      await auditFromReq(req, 'rbac.role_updated', 'role', updated.id);
      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteRole(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        const role = await Role.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!role) throw new NotFoundError('Role');
        if (role.is_system_template) {
          throw new BadRequestError('Cannot delete system template role');
        }
        await role.destroy({ transaction: t });
      });

      await auditFromReq(req, 'rbac.role_deleted', 'role', req.params.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

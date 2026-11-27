import { Op } from 'sequelize';
import {
  User,
  OrganizationMembership,
  Department,
  Role,
  MembershipRole,
  UserInvitation,
  withTenantContext,
  withPlatformContext
} from '../models/index.js';
import { hashPassword, randomToken } from '../utils/crypto.js';
import { NotFoundError, QuotaExceededError, BadRequestError } from '../utils/errors.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import { auditFromReq } from '../services/audit.service.js';

export class UserController {
  static async listUsers(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const scope = req.permissionScope;
      const deptFilter = req.query.departmentId || null;
      const statusFilter = req.query.status || null;

      const data = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };

        if (scope?.scope === 'self') {
          whereClause.id = req.membership.id;
        } else if (scope?.scope === 'department') {
          const allowedDepts = [...new Set([...(scope.scopeEntities?.department || []), req.membership.primary_department_id].filter(Boolean))];
          if (allowedDepts.length === 0) return paginatedResponse([], 0, pg);
          whereClause.primary_department_id = { [Op.in]: allowedDepts };
        }

        if (deptFilter) whereClause.primary_department_id = deptFilter;
        if (statusFilter) whereClause.status = statusFilter;

        const userWhereClause = {};
        if (pg.search) {
          userWhereClause[Op.or] = [
            { full_name: { [Op.iLike]: `%${pg.search}%` } },
            { email: { [Op.iLike]: `%${pg.search}%` } }
          ];
        }

        const { count, rows } = await OrganizationMembership.findAndCountAll({
          where: whereClause,
          include: [
            {
              model: User,
              as: 'user',
              where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined
            },
            {
              model: MembershipRole,
              as: 'membershipRoles',
              include: [{ model: Role, as: 'role' }]
            }
          ],
          limit: pg.limit,
          offset: pg.offset,
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const formatted = rows.map((m) => ({
          membership_id: m.id,
          user_id: m.user_id,
          employee_code: m.employee_code,
          job_title: m.job_title,
          status: m.status,
          is_org_admin: m.is_org_admin,
          primary_department_id: m.primary_department_id,
          primary_location_id: m.primary_location_id,
          manager_membership_id: m.manager_membership_id,
          joined_at: m.joined_at,
          email: m.user?.email,
          phone: m.user?.phone,
          full_name: m.user?.full_name,
          avatar_url: m.user?.avatar_url,
          last_login_at: m.user?.last_login_at,
          department_name: null,
          roles: (m.membershipRoles || []).map((mr) => ({
            assignmentId: mr.id,
            roleId: mr.role_id,
            roleName: mr.role?.name,
            slug: mr.role?.slug,
            scopeEntityType: mr.scope_entity_type,
            scopeEntityId: mr.scope_entity_id
          }))
        }));

        return paginatedResponse(formatted, count, pg);
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req, res, next) {
    try {
      const b = req.body;
      const result = await withPlatformContext(async (t) => {
        const activeUsers = await OrganizationMembership.count({
          where: { organization_id: req.organizationId, status: 'active' },
          transaction: t
        });

        const maxUsers = req.entitlements?.limits?.maxUsers ?? 50;
        if (activeUsers >= maxUsers) {
          throw new QuotaExceededError(`Maximum user capacity (${maxUsers}) reached for your subscription.`);
        }

        const pwHash = await hashPassword(b.password || 'Temporary#2026!');
        const [user] = await User.findOrCreate({
          where: { email: b.email.toLowerCase().trim() },
          defaults: {
            email: b.email.toLowerCase().trim(),
            full_name: b.fullName,
            password_hash: pwHash,
            email_verified_at: new Date(),
            is_active: true
          },
          transaction: t
        });

        const [membership] = await OrganizationMembership.findOrCreate({
          where: { organization_id: req.organizationId, user_id: user.id },
          defaults: {
            organization_id: req.organizationId,
            user_id: user.id,
            employee_code: b.employeeCode || null,
            job_title: b.jobTitle || null,
            primary_department_id: b.departmentId || null,
            is_org_admin: Boolean(b.isOrgAdmin),
            status: 'active'
          },
          transaction: t
        });

        if (Array.isArray(b.roleIds)) {
          for (const roleId of b.roleIds) {
            await MembershipRole.findOrCreate({
              where: {
                organization_id: req.organizationId,
                membership_id: membership.id,
                role_id: roleId
              },
              defaults: {
                organization_id: req.organizationId,
                membership_id: membership.id,
                role_id: roleId,
                assigned_by: req.user.id
              },
              transaction: t
            });
          }
        }

        return { user, membership };
      });

      await auditFromReq(req, 'users.created', 'membership', result.membership.id, { email: b.email });
      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.full_name
          },
          membership: result.membership
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async inviteUser(req, res, next) {
    try {
      const b = req.body;
      const inviteToken = randomToken(32);
      const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);

      const invite = await withTenantContext(req.organizationId, async (t) => {
        return UserInvitation.create(
          {
            organization_id: req.organizationId,
            email: b.email.toLowerCase().trim(),
            full_name: b.fullName || null,
            token: inviteToken,
            role_ids: b.roleIds || [],
            department_id: b.departmentId || null,
            is_org_admin: Boolean(b.isOrgAdmin),
            invited_by: req.user.id,
            expires_at: expiresAt
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'users.invited', 'user_invitation', invite.id, { email: b.email });
      return res.status(201).json({
        success: true,
        message: 'Invitation generated',
        invitationToken: inviteToken,
        invitationId: invite.id
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUser(req, res, next) {
    try {
      const membership = await withTenantContext(req.organizationId, async (t) => {
        const mem = await OrganizationMembership.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          include: [
            { model: User, as: 'user' },
            {
              model: MembershipRole,
              as: 'membershipRoles',
              include: [{ model: Role, as: 'role' }]
            }
          ],
          transaction: t
        });
        if (!mem) throw new NotFoundError('User membership');
        return mem;
      });

      return res.status(200).json({ data: membership });
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const b = req.body;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const mem = await OrganizationMembership.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!mem) throw new NotFoundError('User membership');

        const updates = {};
        if (b.jobTitle !== undefined) updates.job_title = b.jobTitle;
        if (b.employeeCode !== undefined) updates.employee_code = b.employeeCode;
        if (b.departmentId !== undefined) updates.primary_department_id = b.departmentId;
        if (b.isOrgAdmin !== undefined) updates.is_org_admin = b.isOrgAdmin;
        if (b.status !== undefined) updates.status = b.status;

        await mem.update(updates, { transaction: t });
        return mem;
      });

      await auditFromReq(req, 'users.updated', 'membership', updated.id);
      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async assignRoles(req, res, next) {
    try {
      const { roleIds = [], scopeEntityType, scopeEntityId } = req.body;
      await withTenantContext(req.organizationId, async (t) => {
        for (const roleId of roleIds) {
          await MembershipRole.findOrCreate({
            where: {
              organization_id: req.organizationId,
              membership_id: req.params.id,
              role_id: roleId
            },
            defaults: {
              organization_id: req.organizationId,
              membership_id: req.params.id,
              role_id: roleId,
              scope_entity_type: scopeEntityType || null,
              scope_entity_id: scopeEntityId || null,
              assigned_by: req.user.id
            },
            transaction: t
          });
        }
      });

      await auditFromReq(req, 'users.roles_assigned', 'membership', req.params.id, { roleIds });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async revokeRole(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        await MembershipRole.destroy({
          where: {
            id: req.params.assignmentId,
            organization_id: req.organizationId,
            membership_id: req.params.id
          },
          transaction: t
        });
      });

      await auditFromReq(req, 'users.role_revoked', 'membership_role', req.params.assignmentId);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async deactivateUser(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        const mem = await OrganizationMembership.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!mem) throw new NotFoundError('User membership');
        await mem.update({ status: 'deactivated', deactivated_at: new Date() }, { transaction: t });
      });

      await auditFromReq(req, 'users.deactivated', 'membership', req.params.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

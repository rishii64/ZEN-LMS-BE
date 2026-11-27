import { Op } from 'sequelize';
import {
  User,
  Session,
  OrganizationMembership,
  Organization,
  OrganizationSetting,
  OrganizationModule,
  PlatformAnnouncement,
  Role,
  RolePermission,
  Permission,
  MembershipRole,
  UserInvitation,
  withPlatformContext,
  withTenantContext
} from '../models/index.js';
import { computeEffectivePermissions } from '../middleware/tenant.js';
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  hashPassword,
  randomToken,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
  verifyTotpCode
} from '../utils/crypto.js';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { auditFromReq, recordAudit } from '../services/audit.service.js';
import { sendPasswordResetEmail } from '../services/mail.service.js';
import { env } from '../config/env.js';
import { AuthView } from '../views/auth.view.js';
import { ApiView } from '../views/api.view.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const { identifier, password, organizationId, mfaCode } = req.body;
      const trimmed = identifier.trim();

      const result = await withPlatformContext(async (t) => {
        const user = await User.findOne({
          where: {
            [Op.or]: [{ email: trimmed }, { phone: trimmed }]
          },
          transaction: t
        });

        if (!user) throw new UnauthorizedError('Invalid credentials');
        if (!user.is_active) throw new ForbiddenError('Account is deactivated', 'ACCOUNT_DEACTIVATED');

        const validPw = await verifyPassword(password, user.password_hash);
        if (!validPw) throw new UnauthorizedError('Invalid credentials');

        const memberships = await OrganizationMembership.findAll({
          where: { user_id: user.id, status: 'active' },
          include: [
            {
              model: Organization,
              as: 'organization',
              where: { status: 'active' },
              attributes: ['id', 'name', 'slug', 'status']
            }
          ],
          order: [['created_at', 'ASC']],
          transaction: t
        });

        let activeOrgId = null;
        if (organizationId) {
          const match = memberships.find((m) => m.organization_id === organizationId);
          if (!match) throw new ForbiddenError('Not an active member of the requested organization');
          activeOrgId = organizationId;
        } else if (memberships.length > 0) {
          activeOrgId = memberships[0].organization_id;
        }

        if (user.mfa_enabled) {
          if (!mfaCode) {
            return { mfaRequired: true };
          }
          const secret = decryptSecret(user.mfa_secret_encrypted);
          if (!verifyTotpCode(secret, mfaCode)) {
            throw new UnauthorizedError('Invalid MFA verification code');
          }
        }

        const rawRefresh = randomToken(48);
        const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86400 * 1000);

        const session = await Session.create(
          {
            user_id: user.id,
            active_organization_id: activeOrgId,
            refresh_token_hash: sha256(rawRefresh),
            user_agent: req.headers['user-agent'] || null,
            ip_address: req.ip,
            mfa_verified: Boolean(user.mfa_enabled),
            expires_at: expiresAt
          },
          { transaction: t }
        );

        await user.update({ last_login_at: new Date() }, { transaction: t });

        const accessToken = signAccessToken({
          sub: user.id,
          sid: session.id,
          platformAdmin: user.is_platform_admin
        });
        const refreshToken = signRefreshToken({
          sub: user.id,
          sid: session.id,
          rt: rawRefresh
        });

        return {
          mfaRequired: false,
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.full_name,
            isPlatformAdmin: user.is_platform_admin,
            platformRole: user.platform_role,
            emailVerified: Boolean(user.email_verified_at),
            mfaEnabled: user.mfa_enabled,
            activeOrganizationId: activeOrgId
          },
          memberships: memberships.map((m) => ({
            membershipId: m.id,
            organizationId: m.organization_id,
            organizationName: m.organization?.name,
            organizationSlug: m.organization?.slug,
            isOrgAdmin: m.is_org_admin
          }))
        };
      });

      if (result.mfaRequired) {
        return res.status(200).json({ mfaRequired: true, message: 'MFA code required' });
      }

      await recordAudit({
        organizationId: result.user.activeOrganizationId,
        actorUserId: result.user.id,
        actorEmail: result.user.email,
        action: 'user.login',
        resourceType: 'session',
        resourceId: result.user.id,
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { method: 'password' }
      });

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) throw new BadRequestError('refreshToken is required');

      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      const result = await withPlatformContext(async (t) => {
        const session = await Session.findOne({
          where: {
            id: decoded.sid,
            user_id: decoded.sub,
            refresh_token_hash: sha256(decoded.rt),
            revoked_at: null,
            expires_at: { [Op.gt]: new Date() }
          },
          transaction: t
        });

        if (!session) throw new UnauthorizedError('Refresh token revoked or session expired');

        const user = await User.findOne({
          where: { id: decoded.sub, is_active: true },
          transaction: t
        });
        if (!user) throw new UnauthorizedError('User account not found or deactivated');

        const newRefreshRaw = randomToken(48);
        const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86400 * 1000);

        await session.update(
          {
            refresh_token_hash: sha256(newRefreshRaw),
            last_active_at: new Date(),
            expires_at: expiresAt
          },
          { transaction: t }
        );

        const newAccessToken = signAccessToken({
          sub: user.id,
          sid: session.id,
          platformAdmin: user.is_platform_admin
        });
        const newRefreshToken = signRefreshToken({
          sub: user.id,
          sid: session.id,
          rt: newRefreshRaw
        });

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      });

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      if (req.sessionId) {
        await withPlatformContext(async (t) => {
          await Session.update(
            { revoked_at: new Date() },
            { where: { id: req.sessionId }, transaction: t }
          );
        });
        await auditFromReq(req, 'user.logout', 'session', req.sessionId);
      }
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const user = req.user;

      const context = await withPlatformContext(async (t) => {
        const memberships = await OrganizationMembership.findAll({
          where: { user_id: user.id, status: 'active' },
          include: [
            {
              model: Organization,
              as: 'organization',
              where: { status: 'active' },
              attributes: ['id', 'name', 'slug', 'status', 'organization_type'],
              include: [
                {
                  model: OrganizationSetting,
                  as: 'settings',
                  required: false,
                  attributes: ['primary_color', 'secondary_color', 'terminology', 'logo_url']
                },
                {
                  model: OrganizationModule,
                  as: 'modules',
                  required: false,
                  attributes: ['module_key', 'is_enabled']
                }
              ]
            }
          ],
          transaction: t
        });

        const activeMembership =
          memberships.find((m) => m.organization_id === user.activeOrganizationId) ||
          (!user.isPlatformAdmin && memberships.length > 0 ? memberships[0] : null);

        const announcements = await PlatformAnnouncement.findAll({
          where: { is_active: true },
          order: [['published_at', 'DESC']],
          limit: 5,
          transaction: t
        });

        return { memberships, activeMembership, announcements };
      });

      let permissions = {};
      let roles = [];
      if (context.activeMembership) {
        if (context.activeMembership.is_org_admin) {
          permissions = { '*:*': { scope: 'organization', rank: 6 } };
          roles = [{ name: 'Tenant Admin', slug: 'tenant_admin' }];
        } else {
          const roleData = await withTenantContext(context.activeMembership.organization_id, async (t) => {
            const membershipRoles = await MembershipRole.findAll({
              where: {
                organization_id: context.activeMembership.organization_id,
                membership_id: context.activeMembership.id
              },
              include: [
                {
                  model: Role,
                  as: 'role',
                  where: { is_active: true },
                  include: [
                    {
                      model: RolePermission,
                      as: 'rolePermissions',
                      include: [{ model: Permission, as: 'permission' }]
                    }
                  ]
                }
              ],
              transaction: t
            });

            const rows = [];
            const roleList = [];
            for (const mr of membershipRoles) {
              if (mr.role) {
                roleList.push({ id: mr.role.id, name: mr.role.name, slug: mr.role.slug });
              }
              for (const rp of mr.role?.rolePermissions || []) {
                rows.push({
                  module: rp.permission?.module,
                  action: rp.permission?.action,
                  scope: rp.scope,
                  allow: rp.allow,
                  scope_entity_type: mr.scope_entity_type,
                  scope_entity_id: mr.scope_entity_id
                });
              }
            }
            return { rows, roleList };
          });
          permissions = computeEffectivePermissions(roleData.rows);
          roles = roleData.roleList;
        }
      }

      const activeOrgModel = context.activeMembership?.organization || null;
      const entitlements = {};
      if (activeOrgModel?.modules) {
        for (const mod of activeOrgModel.modules) {
          entitlements[mod.module_key] = Boolean(mod.is_enabled);
        }
      }

      const activeContext = context.activeMembership && activeOrgModel
        ? {
            organization: {
              id: activeOrgModel.id,
              name: activeOrgModel.name,
              slug: activeOrgModel.slug,
              status: activeOrgModel.status,
              organization_type: activeOrgModel.organization_type,
              primary_color: activeOrgModel.settings?.primary_color || '#2563eb',
              secondary_color: activeOrgModel.settings?.secondary_color || '#0f172a',
              logo_url: activeOrgModel.settings?.logo_url || null,
              terminology: activeOrgModel.settings?.terminology || {}
            },
            membership: {
              id: context.activeMembership.id,
              organization_id: context.activeMembership.organization_id,
              user_id: context.activeMembership.user_id,
              is_org_admin: context.activeMembership.is_org_admin,
              job_title: context.activeMembership.job_title,
              status: context.activeMembership.status
            },
            entitlements,
            permissions,
            roles
          }
        : null;

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          isPlatformAdmin: user.isPlatformAdmin,
          platformRole: user.platformRole,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          activeOrganizationId: activeOrgModel?.id || user.activeOrganizationId
        },
        activeContext,
        activeMembership: context.activeMembership
          ? {
              id: context.activeMembership.id,
              organizationId: context.activeMembership.organization_id,
              organizationName: activeOrgModel?.name,
              organizationSlug: activeOrgModel?.slug,
              isOrgAdmin: context.activeMembership.is_org_admin,
              jobTitle: context.activeMembership.job_title
            }
          : null,
        memberships: context.memberships.map((m) => ({
          membershipId: m.id,
          organizationId: m.organization_id,
          organization_id: m.organization_id,
          organizationName: m.organization?.name,
          organization_name: m.organization?.name,
          organizationSlug: m.organization?.slug,
          organization_slug: m.organization?.slug,
          isOrgAdmin: m.is_org_admin,
          is_org_admin: m.is_org_admin,
          jobTitle: m.job_title
        })),
        announcements: context.announcements,
        permissions
      });
    } catch (err) {
      next(err);
    }
  }

  static async switchOrganization(req, res, next) {
    try {
      const { organizationId } = req.body;
      if (!organizationId) throw new BadRequestError('organizationId is required');

      await withPlatformContext(async (t) => {
        const mem = await OrganizationMembership.findOne({
          where: { user_id: req.user.id, organization_id: organizationId, status: 'active' },
          transaction: t
        });
        if (!mem) throw new ForbiddenError('You are not an active member of this organization');

        await Session.update(
          { active_organization_id: organizationId },
          { where: { id: req.sessionId }, transaction: t }
        );
      });

      await auditFromReq(req, 'user.switch_organization', 'organization', organizationId);
      return res.status(200).json({ success: true, activeOrganizationId: organizationId });
    } catch (err) {
      next(err);
    }
  }

  static async acceptInvite(req, res, next) {
    try {
      const { token, fullName, password, phone } = req.body;

      const result = await withPlatformContext(async (t) => {
        const invite = await UserInvitation.findOne({
          where: {
            token,
            status: 'pending',
            expires_at: { [Op.gt]: new Date() }
          },
          transaction: t
        });

        if (!invite) throw new BadRequestError('Invalid or expired invitation token');

        let user = await User.findOne({
          where: { email: invite.email.toLowerCase() },
          transaction: t
        });

        if (user) {
          const updates = { email_verified_at: user.email_verified_at || new Date() };
          if (fullName) updates.full_name = fullName;
          if (phone) updates.phone = phone;
          await user.update(updates, { transaction: t });
        } else {
          const pwHash = await hashPassword(password);
          user = await User.create(
            {
              email: invite.email.toLowerCase(),
              phone: phone || null,
              password_hash: pwHash,
              full_name: fullName,
              email_verified_at: new Date(),
              is_active: true
            },
            { transaction: t }
          );
        }

        const [membership] = await OrganizationMembership.findOrCreate({
          where: { organization_id: invite.organization_id, user_id: user.id },
          defaults: {
            organization_id: invite.organization_id,
            user_id: user.id,
            is_org_admin: invite.is_org_admin,
            primary_department_id: invite.department_id || null,
            status: 'active'
          },
          transaction: t
        });

        if (invite.role_ids && invite.role_ids.length > 0) {
          for (const roleId of invite.role_ids) {
            await MembershipRole.findOrCreate({
              where: {
                organization_id: invite.organization_id,
                membership_id: membership.id,
                role_id: roleId
              },
              defaults: {
                organization_id: invite.organization_id,
                membership_id: membership.id,
                role_id: roleId
              },
              transaction: t
            });
          }
        }

        await invite.update({ status: 'accepted', accepted_at: new Date() }, { transaction: t });

        return { user, organizationId: invite.organization_id };
      });

      await recordAudit({
        organizationId: result.organizationId,
        actorUserId: result.user.id,
        actorEmail: result.user.email,
        action: 'invitation.accepted',
        resourceType: 'user_invitation',
        resourceId: result.user.id,
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({ success: true, message: 'Invitation accepted. Please log in.' });
    } catch (err) {
      next(err);
    }
  }

  static async setupMfa(req, res, next) {
    try {
      const secret = generateTotpSecret();
      const encrypted = encryptSecret(secret);

      await withPlatformContext(async (t) => {
        await User.update(
          { mfa_secret_encrypted: encrypted },
          { where: { id: req.user.id }, transaction: t }
        );
      });

      const otpauthUrl = `otpauth://totp/EnterpriseLMS:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=EnterpriseLMS`;
      return res.status(200).json({ secret, otpauthUrl });
    } catch (err) {
      next(err);
    }
  }

  static async verifyMfa(req, res, next) {
    try {
      const { code } = req.body;
      if (!code) throw new BadRequestError('code is required');

      await withPlatformContext(async (t) => {
        const user = await User.findByPk(req.user.id, { transaction: t });
        if (!user || !user.mfa_secret_encrypted) {
          throw new BadRequestError('MFA setup has not been initiated');
        }
        const secret = decryptSecret(user.mfa_secret_encrypted);
        if (!verifyTotpCode(secret, code)) {
          throw new BadRequestError('Invalid TOTP verification code');
        }
        await user.update({ mfa_enabled: true }, { transaction: t });
      });

      await auditFromReq(req, 'user.mfa_enabled', 'user', req.user.id);
      return res.status(200).json({ success: true, message: 'MFA enabled successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async listSessions(req, res, next) {
    try {
      const rows = await withPlatformContext(async (t) => {
        return Session.findAll({
          where: { user_id: req.user.id },
          attributes: ['id', 'ip_address', 'user_agent', 'last_active_at', 'expires_at', 'revoked_at', 'created_at'],
          order: [['last_active_at', 'DESC']],
          limit: 30,
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async revokeSession(req, res, next) {
    try {
      await withPlatformContext(async (t) => {
        const updated = await Session.update(
          { revoked_at: new Date() },
          { where: { id: req.params.id, user_id: req.user.id }, transaction: t }
        );
        if (!updated[0]) throw new NotFoundError('Session');
      });
      await auditFromReq(req, 'user.session_revoked', 'session', req.params.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async disableMfa(req, res, next) {
    try {
      const { code, password } = req.body;
      if (!code || !password) throw new BadRequestError('code and password are required');

      await withPlatformContext(async (t) => {
        const user = await User.findByPk(req.user.id, { transaction: t });
        const validPw = await verifyPassword(password, user.password_hash);
        if (!validPw) throw new UnauthorizedError('Invalid password');

        const secret = decryptSecret(user.mfa_secret_encrypted);
        if (!verifyTotpCode(secret, code)) {
          throw new BadRequestError('Invalid TOTP verification code');
        }
        await user.update({ mfa_enabled: false, mfa_secret_encrypted: null }, { transaction: t });
      });

      await auditFromReq(req, 'user.mfa_disabled', 'user', req.user.id);
      return res.status(200).json({ success: true, message: 'MFA disabled' });
    } catch (err) {
      next(err);
    }
  }

  static async requestPasswordReset(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError('email is required');

      const resetPayload = await withPlatformContext(async (t) => {
        const user = await User.findOne({
          where: { email: email.toLowerCase().trim(), is_active: true },
          transaction: t
        });
        if (!user) return null; // Silent prevention of email enumeration

        const resetToken = randomToken(32);
        const expiresAt = new Date(Date.now() + 3600 * 1000);

        await user.update(
          {
            password_reset_token: resetToken,
            password_reset_expires_at: expiresAt
          },
          { transaction: t }
        );

        return {
          userId: user.id,
          email: user.email,
          fullName: user.full_name,
          resetToken
        };
      });

      if (resetPayload) {
        const resetUrl = `${env.APP_BASE_URL}/forgot-password?token=${encodeURIComponent(resetPayload.resetToken)}`;
        await sendPasswordResetEmail({
          to: resetPayload.email,
          fullName: resetPayload.fullName,
          resetToken: resetPayload.resetToken,
          resetUrl
        });

        await recordAudit({
          actorUserId: resetPayload.userId,
          actorEmail: resetPayload.email,
          action: 'user.password_reset_requested',
          resourceType: 'user',
          resourceId: resetPayload.userId,
          requestId: req.requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword || newPassword.length < 8) {
        throw new BadRequestError('token and newPassword (min 8 chars) are required');
      }

      const updated = await withPlatformContext(async (t) => {
        const user = await User.findOne({
          where: {
            password_reset_token: token,
            password_reset_expires_at: { [Op.gt]: new Date() }
          },
          transaction: t
        });

        if (!user) throw new BadRequestError('Invalid or expired reset token');

        const hash = await hashPassword(newPassword);
        await user.update(
          {
            password_hash: hash,
            password_reset_token: null,
            password_reset_expires_at: null
          },
          { transaction: t }
        );

        // Revoke all existing sessions
        await Session.update(
          { revoked_at: new Date() },
          { where: { user_id: user.id }, transaction: t }
        );

        return user;
      });

      await recordAudit({
        actorUserId: updated.id,
        actorEmail: updated.email,
        action: 'user.password_reset',
        resourceType: 'user',
        resourceId: updated.id,
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({ success: true, message: 'Password updated. Please log in.' });
    } catch (err) {
      next(err);
    }
  }
}

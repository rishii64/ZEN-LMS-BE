import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class User extends Model {}
User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING(40), unique: true },
    password_hash: { type: DataTypes.TEXT, allowNull: false },
    full_name: { type: DataTypes.STRING(180), allowNull: false },
    avatar_url: { type: DataTypes.TEXT },
    is_platform_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    platform_role: { type: DataTypes.STRING(64) },
    email_verified_at: { type: DataTypes.DATE },
    phone_verified_at: { type: DataTypes.DATE },
    email_verification_token: { type: DataTypes.STRING(128) },
    password_reset_token: { type: DataTypes.STRING(128) },
    password_reset_expires_at: { type: DataTypes.DATE },
    mfa_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    mfa_secret_encrypted: { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_login_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'users', modelName: 'User' }
);

export class OrganizationMembership extends Model {}
OrganizationMembership.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    employee_code: { type: DataTypes.STRING(80) },
    job_title: { type: DataTypes.STRING(120) },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    is_org_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    primary_department_id: { type: DataTypes.UUID },
    primary_location_id: { type: DataTypes.UUID },
    manager_membership_id: { type: DataTypes.UUID },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    deactivated_at: { type: DataTypes.DATE },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'organization_memberships', modelName: 'OrganizationMembership' }
);

export class Permission extends Model {}
Permission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    module: { type: DataTypes.STRING(64), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    description: { type: DataTypes.TEXT },
    is_platform_only: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { sequelize, tableName: 'permissions', modelName: 'Permission', updatedAt: false }
);

export class Role extends Model {}
Role.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT },
    is_system_template: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    combination_rule: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'union_widest' },
    created_by: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'roles', modelName: 'Role' }
);

export class RolePermission extends Model {}
RolePermission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    role_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID },
    permission_id: { type: DataTypes.UUID, allowNull: false },
    scope: { type: DataTypes.STRING, allowNull: false, defaultValue: 'organization' },
    allow: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'role_permissions', modelName: 'RolePermission', updatedAt: false }
);

export class MembershipRole extends Model {}
MembershipRole.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: false },
    scope_entity_type: { type: DataTypes.STRING(40) },
    scope_entity_id: { type: DataTypes.UUID },
    assigned_by: { type: DataTypes.UUID },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'membership_roles', modelName: 'MembershipRole', createdAt: false, updatedAt: false }
);

export class UserInvitation extends Model {}
UserInvitation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    full_name: { type: DataTypes.STRING(180) },
    token: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    role_ids: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
    department_id: { type: DataTypes.UUID },
    is_org_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    invited_by: { type: DataTypes.UUID },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    accepted_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'user_invitations', modelName: 'UserInvitation', updatedAt: false }
);

export class Session extends Model {}
Session.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    active_organization_id: { type: DataTypes.UUID },
    refresh_token_hash: { type: DataTypes.TEXT, allowNull: false, unique: true },
    user_agent: { type: DataTypes.TEXT },
    ip_address: { type: DataTypes.STRING(64) },
    mfa_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE },
    last_active_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'sessions', modelName: 'Session', updatedAt: false }
);

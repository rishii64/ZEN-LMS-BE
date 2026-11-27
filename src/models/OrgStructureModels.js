import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class OrgUnit extends Model {}
OrgUnit.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    parent_unit_id: { type: DataTypes.UUID },
    unit_type: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    code: { type: DataTypes.STRING(64) },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'org_units', modelName: 'OrgUnit' }
);

export class Location extends Model {}
Location.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    org_unit_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(180), allowNull: false },
    code: { type: DataTypes.STRING(64) },
    address: { type: DataTypes.TEXT },
    city: { type: DataTypes.STRING(100) },
    country: { type: DataTypes.STRING(80) },
    timezone: { type: DataTypes.STRING(80) },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'locations', modelName: 'Location' }
);

export class Department extends Model {}
Department.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    parent_department_id: { type: DataTypes.UUID },
    org_unit_id: { type: DataTypes.UUID },
    location_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(180), allowNull: false },
    code: { type: DataTypes.STRING(64) },
    description: { type: DataTypes.TEXT },
    head_membership_id: { type: DataTypes.UUID },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'departments', modelName: 'Department' }
);

export class Team extends Model {}
Team.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    department_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(180), allowNull: false },
    description: { type: DataTypes.TEXT },
    lead_membership_id: { type: DataTypes.UUID },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'teams', modelName: 'Team' }
);

export class Group extends Model {}
Group.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    department_id: { type: DataTypes.UUID },
    team_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(180), allowNull: false },
    group_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'cohort' },
    description: { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'groups', modelName: 'Group' }
);

export class GroupMembership extends Model {}
GroupMembership.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    group_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    role_in_group: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'member' },
    added_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'group_memberships', modelName: 'GroupMembership', createdAt: false, updatedAt: false }
);

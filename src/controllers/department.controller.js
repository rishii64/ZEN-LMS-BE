import { Op } from 'sequelize';
import {
  Department,
  OrgUnit,
  Location,
  Team,
  Group,
  GroupMembership,
  OrganizationMembership,
  User,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { auditFromReq } from '../services/audit.service.js';

export class DepartmentController {
  static async getHierarchy(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const [units, locations, departments, teams, groups] = await Promise.all([
          OrgUnit.findAll({
            where: { organization_id: req.organizationId },
            order: [['name', 'ASC']],
            transaction: t
          }),
          Location.findAll({
            where: { organization_id: req.organizationId },
            order: [['name', 'ASC']],
            transaction: t
          }),
          Department.findAll({
            where: { organization_id: req.organizationId },
            order: [['name', 'ASC']],
            transaction: t
          }),
          Team.findAll({
            where: { organization_id: req.organizationId },
            order: [['name', 'ASC']],
            transaction: t
          }),
          Group.findAll({
            where: { organization_id: req.organizationId },
            order: [['name', 'ASC']],
            transaction: t
          })
        ]);

        return {
          orgUnits: units,
          locations,
          departments,
          teams,
          groups
        };
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async listDepartments(req, res, next) {
    try {
      const scope = req.permissionScope;
      const rows = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };
        if (scope?.scope === 'department') {
          const deptIds = [...new Set([...(scope.scopeEntities?.department || []), req.membership.primary_department_id].filter(Boolean))];
          if (deptIds.length === 0) return [];
          whereClause.id = { [Op.in]: deptIds };
        }

        return Department.findAll({
          where: whereClause,
          order: [['name', 'ASC']],
          transaction: t
        });
      });

      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async createDepartment(req, res, next) {
    try {
      const b = req.body;
      const dept = await withTenantContext(req.organizationId, async (t) => {
        return Department.create(
          {
            organization_id: req.organizationId,
            parent_department_id: b.parentDepartmentId || null,
            org_unit_id: b.orgUnitId || null,
            location_id: b.locationId || null,
            name: b.name,
            code: b.code || null,
            description: b.description || null,
            head_membership_id: b.headMembershipId || null
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'org_structure.department_created', 'department', dept.id, { name: dept.name });
      return res.status(201).json({ data: dept });
    } catch (err) {
      next(err);
    }
  }

  static async getDepartment(req, res, next) {
    try {
      const dept = await withTenantContext(req.organizationId, async (t) => {
        const record = await Department.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!record) throw new NotFoundError('Department');
        return record;
      });
      return res.status(200).json({ data: dept });
    } catch (err) {
      next(err);
    }
  }

  static async updateDepartment(req, res, next) {
    try {
      const b = req.body;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const record = await Department.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!record) throw new NotFoundError('Department');

        const updates = {};
        if (b.name) updates.name = b.name;
        if (b.code !== undefined) updates.code = b.code;
        if (b.description !== undefined) updates.description = b.description;
        if (b.parentDepartmentId !== undefined) updates.parent_department_id = b.parentDepartmentId;
        if (b.orgUnitId !== undefined) updates.org_unit_id = b.orgUnitId;
        if (b.locationId !== undefined) updates.location_id = b.locationId;
        if (b.headMembershipId !== undefined) updates.head_membership_id = b.headMembershipId;
        if (b.isActive !== undefined) updates.is_active = b.isActive;

        await record.update(updates, { transaction: t });
        return record;
      });

      await auditFromReq(req, 'org_structure.department_updated', 'department', updated.id);
      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDepartment(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        await Department.destroy({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
      });
      await auditFromReq(req, 'org_structure.department_deleted', 'department', req.params.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async createOrgUnit(req, res, next) {
    try {
      const b = req.body;
      const unit = await withTenantContext(req.organizationId, async (t) => {
        return OrgUnit.create(
          {
            organization_id: req.organizationId,
            parent_unit_id: b.parentUnitId || null,
            unit_type: b.unitType,
            name: b.name,
            code: b.code || null
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: unit });
    } catch (err) {
      next(err);
    }
  }

  static async createLocation(req, res, next) {
    try {
      const b = req.body;
      const loc = await withTenantContext(req.organizationId, async (t) => {
        return Location.create(
          {
            organization_id: req.organizationId,
            org_unit_id: b.orgUnitId || null,
            name: b.name,
            code: b.code || null,
            address: b.address || null,
            city: b.city || null,
            country: b.country || null,
            timezone: b.timezone || 'UTC'
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: loc });
    } catch (err) {
      next(err);
    }
  }

  static async createTeam(req, res, next) {
    try {
      const b = req.body;
      const team = await withTenantContext(req.organizationId, async (t) => {
        return Team.create(
          {
            organization_id: req.organizationId,
            department_id: b.departmentId || null,
            name: b.name,
            description: b.description || null,
            lead_membership_id: b.leadMembershipId || null
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: team });
    } catch (err) {
      next(err);
    }
  }

  static async createGroup(req, res, next) {
    try {
      const b = req.body;
      const group = await withTenantContext(req.organizationId, async (t) => {
        return Group.create(
          {
            organization_id: req.organizationId,
            department_id: b.departmentId || null,
            team_id: b.teamId || null,
            name: b.name,
            group_type: b.groupType || 'cohort',
            description: b.description || null
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: group });
    } catch (err) {
      next(err);
    }
  }

  static async addGroupMember(req, res, next) {
    try {
      const { membershipId, roleInGroup } = req.body;
      const added = await withTenantContext(req.organizationId, async (t) => {
        const [gm] = await GroupMembership.findOrCreate({
          where: {
            organization_id: req.organizationId,
            group_id: req.params.id,
            membership_id: membershipId
          },
          defaults: {
            organization_id: req.organizationId,
            group_id: req.params.id,
            membership_id: membershipId,
            role_in_group: roleInGroup || 'member'
          },
          transaction: t
        });
        return gm;
      });
      return res.status(201).json({ data: added });
    } catch (err) {
      next(err);
    }
  }

  static async removeGroupMember(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        await GroupMembership.destroy({
          where: {
            organization_id: req.organizationId,
            group_id: req.params.id,
            membership_id: req.params.membershipId
          },
          transaction: t
        });
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

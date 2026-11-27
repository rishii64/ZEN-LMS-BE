import express from 'express';
import { z } from 'zod';
import { DepartmentController } from '../controllers/department.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const departmentsRouter = express.Router();
departmentsRouter.use(requireAuth, resolveTenant);

const deptSchema = z.object({
  name: z.string().min(2).max(180),
  code: z.string().max(64).optional(),
  description: z.string().optional(),
  parentDepartmentId: z.string().uuid().nullable().optional(),
  orgUnitId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  headMembershipId: z.string().uuid().nullable().optional()
});

departmentsRouter.get('/hierarchy', requirePermission('departments', 'view'), DepartmentController.getHierarchy);
departmentsRouter.get('/', requirePermission('departments', 'view'), DepartmentController.listDepartments);
departmentsRouter.post('/', requirePermission('departments', 'create'), validate(deptSchema), DepartmentController.createDepartment);
departmentsRouter.get('/:id', requirePermission('departments', 'view'), DepartmentController.getDepartment);
departmentsRouter.patch('/:id', requirePermission('departments', 'edit'), DepartmentController.updateDepartment);
departmentsRouter.delete('/:id', requirePermission('departments', 'delete'), DepartmentController.deleteDepartment);

// Org Units, Locations, Teams, Groups
departmentsRouter.post('/units', requirePermission('departments', 'create'), DepartmentController.createOrgUnit);
departmentsRouter.post('/locations', requirePermission('departments', 'create'), DepartmentController.createLocation);
departmentsRouter.post('/teams', requirePermission('departments', 'create'), DepartmentController.createTeam);
departmentsRouter.post('/groups', requirePermission('departments', 'create'), DepartmentController.createGroup);
departmentsRouter.post('/groups/:id/members', requirePermission('departments', 'edit'), DepartmentController.addGroupMember);
departmentsRouter.delete('/groups/:id/members/:membershipId', requirePermission('departments', 'edit'), DepartmentController.removeGroupMember);

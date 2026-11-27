import express from 'express';
import { z } from 'zod';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const usersRouter = express.Router();
usersRouter.use(requireAuth, resolveTenant);

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(180),
  password: z.string().min(8).optional(),
  departmentId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  employeeCode: z.string().optional(),
  jobTitle: z.string().optional(),
  isOrgAdmin: z.boolean().default(false)
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(180).optional(),
  departmentId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  isOrgAdmin: z.boolean().default(false)
});

usersRouter.get('/', requirePermission('users', 'view'), UserController.listUsers);
usersRouter.post('/create', requirePermission('users', 'create'), validate(createUserSchema), UserController.createUser);
usersRouter.post('/invite', requirePermission('users', 'create'), validate(inviteUserSchema), UserController.inviteUser);
usersRouter.get('/:id', requirePermission('users', 'view'), UserController.getUser);
usersRouter.patch('/:id', requirePermission('users', 'edit'), UserController.updateUser);
usersRouter.post('/:id/roles', requirePermission('roles', 'manage'), UserController.assignRoles);
usersRouter.delete('/:id/roles/:assignmentId', requirePermission('roles', 'manage'), UserController.revokeRole);
usersRouter.post('/:id/deactivate', requirePermission('users', 'delete'), UserController.deactivateUser);

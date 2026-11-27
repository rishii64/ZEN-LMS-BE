import express from 'express';
import { z } from 'zod';
import { RoleController } from '../controllers/role.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

export const permissionsRouter = express.Router();
permissionsRouter.use(requireAuth);
permissionsRouter.get('/', RoleController.listPermissions);

export const rolesRouter = express.Router();
rolesRouter.use(requireAuth, resolveTenant);

const roleSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().optional(),
  combinationRule: z.enum(['union_widest', 'explicit_deny_first']).default('union_widest'),
  permissions: z.array(z.object({
    permissionId: z.string().uuid().optional(),
    module: z.string().optional(),
    action: z.string().optional(),
    scope: z.enum(['organization', 'department', 'branch', 'course', 'group', 'self']).default('organization'),
    allow: z.boolean().default(true)
  })).default([])
});

rolesRouter.get('/', requirePermission('roles', 'view'), RoleController.listRoles);
rolesRouter.post('/', requirePermission('roles', 'create'), validate(roleSchema), RoleController.createRole);
rolesRouter.get('/:id', requirePermission('roles', 'view'), RoleController.getRole);
rolesRouter.patch('/:id', requirePermission('roles', 'edit'), RoleController.updateRole);
rolesRouter.delete('/:id', requirePermission('roles', 'delete'), RoleController.deleteRole);

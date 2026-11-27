import express from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';

export const auditRouter = express.Router();
auditRouter.use(requireAuth, resolveTenant);

auditRouter.get('/', requirePermission('audit_logs', 'view'), AuditController.listLogs);

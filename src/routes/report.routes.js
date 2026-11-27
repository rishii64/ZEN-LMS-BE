import express from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/rbac.js';

export const reportsRouter = express.Router();
reportsRouter.use(requireAuth, resolveTenant);

reportsRouter.get('/dashboard', ReportController.getDashboard);
reportsRouter.get('/export', requirePermission('reports', 'export'), ReportController.exportReport);

import { authRouter } from './auth.routes.js';
import { platformRouter } from './platform.routes.js';
import { organizationsRouter } from './organization.routes.js';
import { departmentsRouter } from './department.routes.js';
import { permissionsRouter, rolesRouter } from './role.routes.js';
import { usersRouter } from './user.routes.js';
import { subscriptionsRouter, billingRouter } from './subscription.routes.js';
import { coursesRouter } from './course.routes.js';
import { learningPathsRouter } from './learningPath.routes.js';
import { enrollmentsRouter } from './enrollment.routes.js';
import { assessmentsRouter, attemptsRouter } from './assessment.routes.js';
import { progressRouter } from './progress.routes.js';
import { certificatesRouter } from './certificate.routes.js';
import { engagementRouter, notificationsRouter } from './engagement.routes.js';
import { complianceRouter } from './compliance.routes.js';
import { reportsRouter } from './report.routes.js';
import { integrationsRouter } from './integration.routes.js';
import { storageRouter } from './storage.routes.js';
import { auditRouter } from './audit.routes.js';

export function registerRoutes(app) {
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/platform', platformRouter);
  app.use('/api/v1/organizations', organizationsRouter);
  app.use('/api/v1/departments', departmentsRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/memberships', usersRouter);
  app.use('/api/v1/subscriptions', subscriptionsRouter);
  app.use('/api/v1/billing', billingRouter);
  app.use('/api/v1/courses', coursesRouter);
  app.use('/api/v1/learning-paths', learningPathsRouter);
  app.use('/api/v1/enrollments', enrollmentsRouter);
  app.use('/api/v1/assessments', assessmentsRouter);
  app.use('/api/v1/assessment-attempts', attemptsRouter);
  app.use('/api/v1/progress', progressRouter);
  app.use('/api/v1/certificates', certificatesRouter);
  app.use('/api/v1/engagement', engagementRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/compliance', complianceRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/integrations', integrationsRouter);
  app.use('/api/v1/storage', storageRouter);
  app.use('/api/v1/audit-logs', auditRouter);
}

export {
  authRouter,
  platformRouter,
  organizationsRouter,
  departmentsRouter,
  permissionsRouter,
  rolesRouter,
  usersRouter,
  subscriptionsRouter,
  billingRouter,
  coursesRouter,
  learningPathsRouter,
  enrollmentsRouter,
  assessmentsRouter,
  attemptsRouter,
  progressRouter,
  certificatesRouter,
  engagementRouter,
  notificationsRouter,
  complianceRouter,
  reportsRouter,
  integrationsRouter,
  storageRouter,
  auditRouter
};

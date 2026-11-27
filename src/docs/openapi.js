export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Multi-Tenant SaaS LMS API',
    version: '1.0.0',
    description: 'Shared-database multi-tenant Learning Management System SaaS REST API with dynamic scoped RBAC, subscription entitlements, RLS isolation, and full LMS lifecycle.'
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    parameters: {
      organizationHeader: {
        name: 'X-Organization-Id',
        in: 'header',
        required: false,
        schema: { type: 'string', format: 'uuid' },
        description: 'Active tenant organization UUID (verified against authenticated user membership)'
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': { post: { tags: ['Auth'], summary: 'Authenticate via email or phone + optional MFA' } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Get authenticated profile, memberships, entitlements, and effective RBAC permissions' } },
    '/auth/accept-invite': { post: { tags: ['Auth'], summary: 'Accept organization invitation and set password' } },
    '/platform/dashboard': { get: { tags: ['Platform Super Admin'], summary: 'Global SaaS metrics, MRR, active/suspended tenants, storage' } },
    '/platform/organizations': {
      get: { tags: ['Platform Super Admin'], summary: 'List all tenant organizations' },
      post: { tags: ['Platform Super Admin'], summary: 'Create and provision new tenant organization with plan & initial Tenant Admin' }
    },
    '/platform/plans': {
      get: { tags: ['Platform Super Admin'], summary: 'List subscription plans' },
      post: { tags: ['Platform Super Admin'], summary: 'Create subscription plan' }
    },
    '/organizations/current': {
      get: { tags: ['Organizations'], summary: 'Get active organization profile, branding, terminology, and usage' },
      patch: { tags: ['Organizations'], summary: 'Update organization branding, terminology, policies, and locale' }
    },
    '/departments': {
      get: { tags: ['Org Structure'], summary: 'List departments scoped to caller permissions' },
      post: { tags: ['Org Structure'], summary: 'Create department' }
    },
    '/roles': {
      get: { tags: ['RBAC'], summary: 'List custom organizational roles' },
      post: { tags: ['RBAC'], summary: 'Create dynamic custom role with scoped permissions' }
    },
    '/roles/assign': { post: { tags: ['RBAC'], summary: 'Assign role to a member with optional entity scope' } },
    '/users': { get: { tags: ['Users'], summary: 'List organization workforce/learners directory' } },
    '/users/invite': { post: { tags: ['Users'], summary: 'Invite user within subscription user quota' } },
    '/users/bulk-import': { post: { tags: ['Users'], summary: 'Queue background bulk user import job' } },
    '/subscriptions/current': { get: { tags: ['Subscriptions'], summary: 'Get tenant subscription, quotas, and module entitlements' } },
    '/billing/webhooks/{provider}': { post: { tags: ['Billing'], summary: 'Verified idempotent Stripe/Razorpay webhook handler' } },
    '/courses': {
      get: { tags: ['Courses'], summary: 'List courses' },
      post: { tags: ['Courses'], summary: 'Create course within plan course quota' }
    },
    '/courses/{id}/transition': { post: { tags: ['Courses'], summary: 'Transition course workflow (submit_review, approve, publish, archive)' } },
    '/learning-paths': {
      get: { tags: ['Learning Paths'], summary: 'List learning paths' },
      post: { tags: ['Learning Paths'], summary: 'Create learning path' }
    },
    '/enrollments': {
      get: { tags: ['Enrollments'], summary: 'List enrollments' },
      post: { tags: ['Enrollments'], summary: 'Enroll individual, bulk, department, or group' }
    },
    '/assessments': {
      get: { tags: ['Assessments'], summary: 'List assessments' },
      post: { tags: ['Assessments'], summary: 'Create assessment' }
    },
    '/assessment-attempts/start': { post: { tags: ['Assessments'], summary: 'Start timed assessment attempt' } },
    '/assessment-attempts/{attemptId}/submit': { post: { tags: ['Assessments'], summary: 'Submit & auto-grade assessment attempt' } },
    '/progress/lesson': { post: { tags: ['Progress'], summary: 'Record lesson progress & recalculate course completion' } },
    '/certificates': { get: { tags: ['Certificates'], summary: 'List issued certificates' } },
    '/certificates/{id}/pdf': { get: { tags: ['Certificates'], summary: 'Download PDF certificate with QR verification' } },
    '/certificates/verify/{code}': { get: { tags: ['Certificates'], summary: 'Publicly verify certificate authenticity' } },
    '/reports/dashboard': { get: { tags: ['Reports'], summary: 'Role-scoped live PostgreSQL dashboard analytics' } },
    '/reports/export': { get: { tags: ['Reports'], summary: 'Export report as CSV, XLSX, or PDF' } },
    '/audit-logs': { get: { tags: ['Audit'], summary: 'View organization audit trail' } }
  }
};

export function renderDocsHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Enterprise SaaS LMS — API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/v1/docs.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;
}

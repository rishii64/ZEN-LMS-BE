export interface SystemPermissionDef {
  code: string;
  module: string;
  action: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: SystemPermissionDef[] = [
  // Course & Curriculum
  { code: 'courses.view', module: 'COURSES', action: 'VIEW', description: 'View course catalog and syllabus' },
  { code: 'courses.create', module: 'COURSES', action: 'CREATE', description: 'Create draft courses and modules' },
  { code: 'courses.edit', module: 'COURSES', action: 'EDIT', description: 'Modify course content, lessons and resources' },
  { code: 'courses.delete', module: 'COURSES', action: 'DELETE', description: 'Archive or remove courses' },
  { code: 'courses.review', module: 'COURSES', action: 'APPROVE', description: 'Review course curriculum before publication' },
  { code: 'courses.publish', module: 'COURSES', action: 'PUBLISH', description: 'Publish courses live to organization learners' },

  // Users & Workforce
  { code: 'users.view', module: 'USERS', action: 'VIEW', description: 'View organization member directory' },
  { code: 'users.invite', module: 'USERS', action: 'CREATE', description: 'Invite new learners and workforce members' },
  { code: 'users.manage', module: 'USERS', action: 'MANAGE', description: 'Update user profiles, departments and status' },
  { code: 'roles.manage', module: 'USERS', action: 'MANAGE', description: 'Create custom roles and assign permissions' },

  // Assessments & Grading
  { code: 'assessments.view', module: 'ASSESSMENTS', action: 'VIEW', description: 'Take or view quizzes and assessments' },
  { code: 'assessments.create', module: 'ASSESSMENTS', action: 'CREATE', description: 'Author quizzes and exam questions' },
  { code: 'assessments.grade', module: 'ASSESSMENTS', action: 'APPROVE', description: 'Grade submissions and inspect answer sheets' },

  // Certificates & Badges
  { code: 'certificates.view', module: 'CERTIFICATES', action: 'VIEW', description: 'View earned credentials' },
  { code: 'certificates.issue', module: 'CERTIFICATES', action: 'PUBLISH', description: 'Manually issue verifiable credentials' },
  { code: 'certificates.revoke', module: 'CERTIFICATES', action: 'DELETE', description: 'Revoke compromised certificates' },

  // Analytics & Compliance
  { code: 'reports.view', module: 'REPORTS', action: 'VIEW', description: 'View learning progress and completion metrics' },
  { code: 'reports.export', module: 'REPORTS', action: 'EXPORT', description: 'Download CSV and Excel compliance reports' },
  { code: 'compliance.manage', module: 'REPORTS', action: 'MANAGE', description: 'Manage mandatory compliance training policies' },

  // Settings & Tenancy
  { code: 'settings.branding', module: 'SETTINGS', action: 'EDIT', description: 'Configure organization logo and brand colors' },
  { code: 'settings.terminology', module: 'SETTINGS', action: 'EDIT', description: 'Customize sector terminology dictionary' },
  { code: 'hierarchy.manage', module: 'SETTINGS', action: 'MANAGE', description: 'Create departments, branches, and teams' },

  // Billing & Subscriptions
  { code: 'billing.view', module: 'BILLING', action: 'VIEW', description: 'View subscription plan, usage, and invoices' },
  { code: 'billing.manage', module: 'BILLING', action: 'MANAGE', description: 'Upgrade subscription plans and manage payment' }
];

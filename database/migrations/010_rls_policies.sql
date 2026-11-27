-- 010_rls_policies.sql
-- PostgreSQL Row-Level Security (RLS) defense-in-depth for all tenant-owned tables

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'organization_settings',
    'organization_domains',
    'organization_modules',
    'organization_subscriptions',
    'subscription_invoices',
    'payment_transactions',
    'subscription_events',
    'usage_records',
    'organization_memberships',
    'role_permissions',
    'membership_roles',
    'user_invitations',
    'org_units',
    'locations',
    'departments',
    'teams',
    'groups',
    'group_memberships',
    'categories',
    'tags',
    'content_assets',
    'courses',
    'course_tags',
    'course_versions',
    'modules',
    'lessons',
    'learning_paths',
    'learning_path_items',
    'course_offerings',
    'enrollments',
    'learning_sessions',
    'attendance',
    'rubrics',
    'assessments',
    'questions',
    'question_options',
    'assessment_attempts',
    'answers',
    'grades',
    'learning_progress',
    'learning_events',
    'completion_records',
    'competencies',
    'certificate_templates',
    'certificates',
    'digital_badges',
    'badge_awards',
    'custom_field_definitions',
    'custom_field_values',
    'workflow_definitions',
    'workflow_instances',
    'policies',
    'policy_acknowledgements',
    'evidence_records',
    'forum_threads',
    'forum_posts',
    'surveys',
    'survey_responses',
    'gamification_points',
    'saved_reports',
    'scheduled_reports',
    'integration_connections',
    'webhook_deliveries'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I
       USING (
         current_setting(''app.is_platform_admin'', true) = ''true''
         OR organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')::uuid
       )
       WITH CHECK (
         current_setting(''app.is_platform_admin'', true) = ''true''
         OR organization_id = NULLIF(current_setting(''app.current_organization_id'', true), '''')::uuid
       )',
      tbl
    );
  END LOOP;
END $$;

-- Special policy for roles (allows global templates where organization_id IS NULL to be read)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_isolation_policy ON roles;
CREATE POLICY roles_isolation_policy ON roles
  FOR SELECT
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR organization_id IS NULL
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
  );

DROP POLICY IF EXISTS roles_write_policy ON roles;
CREATE POLICY roles_write_policy ON roles
  FOR ALL
  USING (
    current_setting('app.is_platform_admin', true) = 'true'
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform_admin', true) = 'true'
    OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
  );

-- Optional non-superuser role for strict RLS enforcement tests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app_user') THEN
    CREATE ROLE lms_app_user NOLOGIN NOBYPASSRLS;
  END IF;
  GRANT USAGE ON SCHEMA public TO lms_app_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lms_app_user;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

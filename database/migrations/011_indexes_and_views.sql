-- 011_indexes_and_views.sql
-- Performance indexes across multi-tenant queries, audit logs, and LMS entities

CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON organization_memberships (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_dept ON organization_memberships (organization_id, primary_department_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_status ON organization_memberships (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_courses_org_status ON courses (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_org_cat ON courses (organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_modules_org_course ON modules (organization_id, course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_org_module ON lessons (organization_id, module_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_enrollments_org_member ON enrollments (organization_id, membership_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_org_course ON enrollments (organization_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments (organization_id, due_date) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_attempts_org_assess ON assessment_attempts (organization_id, assessment_id, membership_id);
CREATE INDEX IF NOT EXISTS idx_progress_org_enroll ON learning_progress (organization_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_certs_org_member ON certificates (organization_id, membership_id);
CREATE INDEX IF NOT EXISTS idx_certs_verify ON certificates (verification_code);

CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_status_period ON organization_subscriptions (status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON background_job_records (status, queue_name, created_at);

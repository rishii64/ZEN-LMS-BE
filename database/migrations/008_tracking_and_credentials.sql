-- 008_tracking_and_credentials.sql
-- Learning Progress, Learning Events, Completion Records, Competencies, Certificates, Badges

CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  last_position_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, enrollment_id, lesson_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, enrollment_id) REFERENCES enrollments(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, lesson_id) REFERENCES lessons(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL,
  course_id UUID,
  lesson_id UUID,
  event_type VARCHAR(80) NOT NULL, -- lesson_viewed | lesson_completed | quiz_submitted | video_heartbeat | course_completed
  duration_seconds INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  course_id UUID NOT NULL,
  completed_units INT NOT NULL DEFAULT 0,
  total_required_units INT NOT NULL DEFAULT 0,
  completion_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  assessment_passed BOOLEAN,
  is_course_completed BOOLEAN NOT NULL DEFAULT FALSE,
  total_learning_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, enrollment_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, enrollment_id) REFERENCES enrollments(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(64),
  description TEXT,
  framework VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  title_text VARCHAR(220) NOT NULL DEFAULT 'Certificate of Completion',
  subtitle_text VARCHAR(255) NOT NULL DEFAULT 'This certifies that',
  body_template TEXT NOT NULL DEFAULT 'has successfully completed {{course_title}} on {{issued_date}}.',
  signature_name VARCHAR(150),
  signature_title VARCHAR(150),
  accent_color VARCHAR(20) DEFAULT '#2563eb',
  validity_days INT, -- NULL means non-expiring
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID,
  membership_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_id UUID,
  certificate_number VARCHAR(80) NOT NULL UNIQUE,
  verification_code VARCHAR(100) NOT NULL UNIQUE,
  recipient_name VARCHAR(180) NOT NULL,
  course_title VARCHAR(250) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  pdf_asset_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, template_id) REFERENCES certificate_templates(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, enrollment_id) REFERENCES enrollments(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, pdf_asset_id) REFERENCES content_assets(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS digital_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  criteria TEXT,
  icon_name VARCHAR(80) DEFAULT 'award',
  color VARCHAR(20) DEFAULT '#eab308',
  course_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, badge_id, membership_id),
  FOREIGN KEY (organization_id, badge_id) REFERENCES digital_badges(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE
);

CREATE TRIGGER trg_learning_progress_updated BEFORE UPDATE ON learning_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_completion_records_updated BEFORE UPDATE ON completion_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cert_templates_updated BEFORE UPDATE ON certificate_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

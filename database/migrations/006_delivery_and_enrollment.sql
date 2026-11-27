-- 006_delivery_and_enrollment.sql
-- Learning Paths, Course Offerings (Cohorts/Batches), Enrollments, Live Sessions, Attendance

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  status course_status NOT NULL DEFAULT 'draft',
  estimated_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_by_membership_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_by_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS learning_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learning_path_id UUID NOT NULL,
  course_id UUID NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, learning_path_id, course_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, learning_path_id) REFERENCES learning_paths(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  cohort_name VARCHAR(180) NOT NULL,
  delivery_mode delivery_mode NOT NULL DEFAULT 'self_paced',
  instructor_membership_id UUID,
  capacity INT,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, instructor_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  offering_id UUID,
  membership_id UUID NOT NULL,
  assigned_by_membership_id UUID,
  assignment_source VARCHAR(40) NOT NULL DEFAULT 'self', -- self | admin | department | group | learning_path | mandatory
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  status enrollment_status NOT NULL DEFAULT 'active',
  waitlist_position INT,
  due_date TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by_membership_id UUID,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, offering_id) REFERENCES course_offerings(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, assigned_by_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_enrollment
  ON enrollments (organization_id, course_id, membership_id, COALESCE(offering_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status NOT IN ('dropped', 'rejected');

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  offering_id UUID,
  instructor_membership_id UUID,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  session_type VARCHAR(40) NOT NULL DEFAULT 'virtual_live', -- virtual_live | classroom
  meeting_url TEXT,
  location_name VARCHAR(180),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- scheduled | rescheduled | completed | cancelled
  rescheduled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, offering_id) REFERENCES course_offerings(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, instructor_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'present', -- present | absent | late | excused
  check_in_at TIMESTAMPTZ,
  notes TEXT,
  recorded_by_membership_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, session_id, membership_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES learning_sessions(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE
);

CREATE TRIGGER trg_learning_paths_updated BEFORE UPDATE ON learning_paths FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offerings_updated BEFORE UPDATE ON course_offerings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enrollments_updated BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_learning_sessions_updated BEFORE UPDATE ON learning_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

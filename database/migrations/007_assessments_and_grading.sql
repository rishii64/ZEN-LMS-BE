-- 007_assessments_and_grading.sql
-- Assessments, Rubrics, Question Banks, Attempts, Answers, and Grades

CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id, title, max_points, levels:[{label, points, description}]}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  module_id UUID,
  rubric_id UUID,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  assessment_type VARCHAR(40) NOT NULL DEFAULT 'quiz', -- quiz | exam | assignment | survey_eval
  time_limit_minutes INT,
  max_attempts INT NOT NULL DEFAULT 3,
  passing_score_percent NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  question_draw_count INT,
  allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_membership_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, module_id) REFERENCES modules(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, rubric_id) REFERENCES rubrics(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID, -- NULL allows reusable question bank items
  category_id UUID,
  question_type question_type NOT NULL,
  prompt TEXT NOT NULL,
  explanation TEXT,
  points NUMERIC(8,2) NOT NULL DEFAULT 1.00,
  correct_answer JSONB, -- for true_false, short_answer keywords, or matching pairs
  sort_order INT NOT NULL DEFAULT 1,
  is_bank_item BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, assessment_id) REFERENCES assessments(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, category_id) REFERENCES categories(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  option_text TEXT NOT NULL,
  match_target TEXT, -- used for matching questions
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 1,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, question_id) REFERENCES questions(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  status attempt_status NOT NULL DEFAULT 'in_progress',
  question_order UUID[] NOT NULL DEFAULT '{}'::uuid[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  score_earned NUMERIC(8,2),
  score_possible NUMERIC(8,2),
  percentage NUMERIC(5,2),
  passed BOOLEAN,
  graded_at TIMESTAMPTZ,
  graded_by_membership_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, assessment_id, membership_id, attempt_number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, assessment_id) REFERENCES assessments(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, enrollment_id) REFERENCES enrollments(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_option_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  text_response TEXT,
  matching_response JSONB,
  file_asset_id UUID,
  is_correct BOOLEAN,
  points_awarded NUMERIC(8,2) NOT NULL DEFAULT 0,
  grader_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, attempt_id, question_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, attempt_id) REFERENCES assessment_attempts(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, question_id) REFERENCES questions(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, file_asset_id) REFERENCES content_assets(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  course_id UUID NOT NULL,
  rubric_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  passed BOOLEAN NOT NULL,
  feedback TEXT,
  graded_by_membership_id UUID,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, attempt_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, attempt_id) REFERENCES assessment_attempts(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE
);

CREATE TRIGGER trg_rubrics_updated BEFORE UPDATE ON rubrics FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_answers_updated BEFORE UPDATE ON answers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

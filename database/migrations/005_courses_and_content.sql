-- 005_courses_and_content.sql
-- Categories, Tags, Content Assets, Courses, Versions, Modules, Lessons

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, parent_id) REFERENCES categories(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  asset_kind VARCHAR(40) NOT NULL, -- pdf | document | presentation | image | audio | video | caption | attachment
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64),
  scan_status asset_scan_status NOT NULL DEFAULT 'clean',
  is_reusable BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID,
  code VARCHAR(64),
  title VARCHAR(250) NOT NULL,
  slug VARCHAR(250) NOT NULL,
  summary TEXT,
  description TEXT,
  thumbnail_asset_id UUID,
  delivery_mode delivery_mode NOT NULL DEFAULT 'self_paced',
  status course_status NOT NULL DEFAULT 'draft',
  language VARCHAR(20) NOT NULL DEFAULT 'en',
  estimated_minutes INT NOT NULL DEFAULT 60,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  prerequisite_course_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  completion_policy JSONB NOT NULL DEFAULT '{"require_all_required_lessons":true,"require_assessment_pass":false}'::jsonb,
  created_by_membership_id UUID,
  approved_by_membership_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, category_id) REFERENCES categories(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, thumbnail_asset_id) REFERENCES content_assets(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, created_by_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, approved_by_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_tags (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (organization_id, course_id, tag_id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, tag_id) REFERENCES tags(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  title VARCHAR(250) NOT NULL,
  changelog TEXT,
  status course_status NOT NULL DEFAULT 'draft',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_membership_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, course_id, version_number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  course_version_id UUID NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_version_id) REFERENCES course_versions(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  module_id UUID NOT NULL,
  title VARCHAR(220) NOT NULL,
  content_type VARCHAR(40) NOT NULL DEFAULT 'text', -- text | pdf | document | presentation | image | audio | video | external_link
  body_markdown TEXT,
  external_url TEXT,
  asset_id UUID,
  caption_asset_id UUID,
  transcript TEXT,
  language VARCHAR(20) NOT NULL DEFAULT 'en',
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_minutes INT NOT NULL DEFAULT 10,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, module_id) REFERENCES modules(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, asset_id) REFERENCES content_assets(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, caption_asset_id) REFERENCES content_assets(organization_id, id) ON DELETE SET NULL
);

CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

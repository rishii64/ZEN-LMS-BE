-- 004_org_structure.sql
-- Configurable Organizational Hierarchy: Units, Departments, Locations, Teams, Groups

CREATE TABLE IF NOT EXISTS org_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_unit_id UUID,
  unit_type VARCHAR(50) NOT NULL, -- parent_org | subsidiary | campus | branch | division
  name VARCHAR(180) NOT NULL,
  code VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, parent_unit_id) REFERENCES org_units(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_unit_id UUID,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(64),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(80),
  timezone VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, org_unit_id) REFERENCES org_units(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_department_id UUID,
  org_unit_id UUID,
  location_id UUID,
  name VARCHAR(180) NOT NULL,
  code VARCHAR(64),
  description TEXT,
  head_membership_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, parent_department_id) REFERENCES departments(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, org_unit_id) REFERENCES org_units(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, location_id) REFERENCES locations(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, head_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

ALTER TABLE organization_memberships
  ADD CONSTRAINT fk_membership_dept FOREIGN KEY (organization_id, primary_department_id) REFERENCES departments(organization_id, id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_membership_loc FOREIGN KEY (organization_id, primary_location_id) REFERENCES locations(organization_id, id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_membership_mgr FOREIGN KEY (organization_id, manager_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  lead_membership_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, department_id) REFERENCES departments(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, lead_membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID,
  team_id UUID,
  name VARCHAR(180) NOT NULL,
  group_type VARCHAR(40) NOT NULL DEFAULT 'cohort', -- cohort | learning_group | compliance_group | custom
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, department_id) REFERENCES departments(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  role_in_group VARCHAR(40) NOT NULL DEFAULT 'member', -- member | lead
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, group_id, membership_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, group_id) REFERENCES groups(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_memberships(organization_id, id) ON DELETE CASCADE
);

CREATE TRIGGER trg_org_units_updated BEFORE UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

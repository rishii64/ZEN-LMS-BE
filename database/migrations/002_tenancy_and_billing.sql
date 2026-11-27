-- 002_tenancy_and_billing.sql
-- Tenancy, Subscription Plans, Invoices, Payments, and Usage Tracking

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  tier_order INT NOT NULL DEFAULT 1,
  monthly_price_cents BIGINT NOT NULL DEFAULT 0,
  annual_price_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  trial_days INT NOT NULL DEFAULT 14,
  grace_period_days INT NOT NULL DEFAULT 7,
  max_users INT NOT NULL DEFAULT 50,
  max_courses INT NOT NULL DEFAULT 25,
  max_storage_bytes BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB
  max_custom_roles INT NOT NULL DEFAULT 10,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  module_key VARCHAR(64) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  limit_value BIGINT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, module_key)
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  industry VARCHAR(100),
  organization_type VARCHAR(80) NOT NULL DEFAULT 'corporate', -- educational, corporate, government, nonprofit, training_institute, other
  contact_email CITEXT NOT NULL,
  contact_phone VARCHAR(40),
  country VARCHAR(80),
  status organization_status NOT NULL DEFAULT 'pending_approval',
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
  secondary_color VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  default_language VARCHAR(20) NOT NULL DEFAULT 'en',
  timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
  date_format VARCHAR(40) NOT NULL DEFAULT 'YYYY-MM-DD',
  time_format VARCHAR(40) NOT NULL DEFAULT 'HH:mm',
  terminology JSONB NOT NULL DEFAULT '{"learner":"Learner","learners":"Learners","instructor":"Instructor","instructors":"Instructors","department":"Department","departments":"Departments","course":"Course","courses":"Courses","branch":"Branch","branches":"Branches"}'::jsonb,
  completion_policy JSONB NOT NULL DEFAULT '{"require_assessment_pass":false,"allow_self_enrollment":true,"auto_issue_certificate":true}'::jsonb,
  security_policy JSONB NOT NULL DEFAULT '{"require_mfa_privileged":false,"session_timeout_minutes":1440,"password_min_length":8}'::jsonb,
  dashboard_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy JSONB NOT NULL DEFAULT '{"audit_days":365,"inactive_archive_days":730}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS organization_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token VARCHAR(128),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key VARCHAR(64) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(30) NOT NULL DEFAULT 'plan', -- plan | override
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_key),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  custom_max_users INT,
  custom_max_courses INT,
  custom_max_storage_bytes BIGINT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  grace_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  provider VARCHAR(40) DEFAULT 'stripe',
  provider_customer_id VARCHAR(150),
  provider_subscription_id VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL,
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  amount_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'open', -- draft | open | paid | past_due | void
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, subscription_id) REFERENCES organization_subscriptions(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID,
  provider VARCHAR(40) NOT NULL, -- stripe | razorpay | manual
  provider_payment_id VARCHAR(180),
  provider_event_id VARCHAR(180),
  amount_cents BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | succeeded | failed | refunded
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (provider, provider_event_id),
  FOREIGN KEY (organization_id, invoice_id) REFERENCES subscription_invoices(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID,
  event_type VARCHAR(80) NOT NULL,
  actor_user_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (organization_id, subscription_id) REFERENCES organization_subscriptions(organization_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_key VARCHAR(64) NOT NULL, -- active_users | total_users | storage_bytes | courses_count
  metric_value BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id)
);

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_org_subs_updated BEFORE UPDATE ON organization_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

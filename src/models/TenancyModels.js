import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class SubscriptionPlan extends Model { }
SubscriptionPlan.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT },
    tier_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    monthly_price_cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    annual_price_cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    trial_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    grace_period_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
    max_users: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    max_courses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 25 },
    max_storage_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 5368709120 },
    max_custom_roles: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'subscription_plans', modelName: 'SubscriptionPlan' }
);

export class PlanFeature extends Model { }
PlanFeature.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_id: { type: DataTypes.UUID, allowNull: false },
    module_key: { type: DataTypes.STRING(64), allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    limit_value: { type: DataTypes.BIGINT },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'plan_features', modelName: 'PlanFeature', updatedAt: false }
);

export class Organization extends Model { }
Organization.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    legal_name: { type: DataTypes.STRING(200) },
    industry: { type: DataTypes.STRING(100) },
    organization_type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'corporate' },
    contact_email: { type: DataTypes.STRING, allowNull: false },
    contact_phone: { type: DataTypes.STRING(40) },
    country: { type: DataTypes.STRING(80) },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending_approval' },
    storage_used_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    approved_at: { type: DataTypes.DATE },
    approved_by: { type: DataTypes.UUID },
    suspended_at: { type: DataTypes.DATE },
    suspension_reason: { type: DataTypes.TEXT },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'organizations', modelName: 'Organization' }
);

export class OrganizationSetting extends Model { }
OrganizationSetting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    logo_url: { type: DataTypes.TEXT },
    favicon_url: { type: DataTypes.TEXT },
    primary_color: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#2563eb' },
    secondary_color: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#0f172a' },
    default_language: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'en' },
    timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'UTC' },
    date_format: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'YYYY-MM-DD' },
    time_format: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'HH:mm' },
    terminology: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    completion_policy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    security_policy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    dashboard_layout: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    retention_policy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'organization_settings', modelName: 'OrganizationSetting' }
);

export class OrganizationDomain extends Model { }
OrganizationDomain.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    verification_token: { type: DataTypes.STRING(128) },
    verified_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'organization_domains', modelName: 'OrganizationDomain', updatedAt: false }
);

export class OrganizationModule extends Model { }
OrganizationModule.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    module_key: { type: DataTypes.STRING(64), allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    source: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'plan' },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'organization_modules', modelName: 'OrganizationModule', createdAt: false }
);

export class OrganizationSubscription extends Model { }
OrganizationSubscription.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    plan_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'trial' },
    billing_cycle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'monthly' },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    unit_price_cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    custom_max_users: { type: DataTypes.INTEGER },
    custom_max_courses: { type: DataTypes.INTEGER },
    custom_max_storage_bytes: { type: DataTypes.BIGINT },
    starts_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    trial_ends_at: { type: DataTypes.DATE },
    current_period_start: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    current_period_end: { type: DataTypes.DATE, allowNull: false },
    grace_ends_at: { type: DataTypes.DATE },
    cancelled_at: { type: DataTypes.DATE },
    auto_renew: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    provider: { type: DataTypes.STRING(40), defaultValue: 'stripe' },
    provider_customer_id: { type: DataTypes.STRING(150) },
    provider_subscription_id: { type: DataTypes.STRING(150) }
  },
  { sequelize, tableName: 'organization_subscriptions', modelName: 'OrganizationSubscription' }
);

export class SubscriptionInvoice extends Model { }
SubscriptionInvoice.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    subscription_id: { type: DataTypes.UUID, allowNull: false },
    invoice_number: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    amount_cents: { type: DataTypes.BIGINT, allowNull: false },
    tax_cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    total_cents: { type: DataTypes.BIGINT, allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'open' },
    due_date: { type: DataTypes.DATE, allowNull: false },
    paid_at: { type: DataTypes.DATE },
    line_items: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
  },
  { sequelize, tableName: 'subscription_invoices', modelName: 'SubscriptionInvoice', updatedAt: false }
);

export class PaymentTransaction extends Model { }
PaymentTransaction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    invoice_id: { type: DataTypes.UUID },
    provider: { type: DataTypes.STRING(40), allowNull: false },
    provider_payment_id: { type: DataTypes.STRING(180) },
    provider_event_id: { type: DataTypes.STRING(180) },
    amount_cents: { type: DataTypes.BIGINT, allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    raw_payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    processed_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'payment_transactions', modelName: 'PaymentTransaction', updatedAt: false }
);

export class SubscriptionEvent extends Model { }
SubscriptionEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    subscription_id: { type: DataTypes.UUID },
    event_type: { type: DataTypes.STRING(80), allowNull: false },
    actor_user_id: { type: DataTypes.UUID },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'subscription_events', modelName: 'SubscriptionEvent', updatedAt: false }
);

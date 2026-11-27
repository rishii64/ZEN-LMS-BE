import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class CustomFieldDefinition extends Model {}
CustomFieldDefinition.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: false },
    field_key: { type: DataTypes.STRING(80), allowNull: false },
    label: { type: DataTypes.STRING(150), allowNull: false },
    field_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'text' },
    options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'custom_field_definitions', modelName: 'CustomFieldDefinition', updatedAt: false }
);

export class CustomFieldValue extends Model {}
CustomFieldValue.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    definition_id: { type: DataTypes.UUID, allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: false },
    value_json: { type: DataTypes.JSONB, allowNull: false }
  },
  { sequelize, tableName: 'custom_field_values', modelName: 'CustomFieldValue', createdAt: false }
);

export class WorkflowDefinition extends Model {}
WorkflowDefinition.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    workflow_type: { type: DataTypes.STRING(60), allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    steps: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'workflow_definitions', modelName: 'WorkflowDefinition' }
);

export class WorkflowInstance extends Model {}
WorkflowInstance.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    workflow_definition_id: { type: DataTypes.UUID, allowNull: false },
    entity_type: { type: DataTypes.STRING(50), allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: false },
    current_step: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    history: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
  },
  { sequelize, tableName: 'workflow_instances', modelName: 'WorkflowInstance' }
);

export class FeatureFlag extends Model {}
FeatureFlag.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID },
    flag_key: { type: DataTypes.STRING(100), allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'feature_flags', modelName: 'FeatureFlag', createdAt: false }
);

export class Policy extends Model {}
Policy.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(220), allowNull: false },
    version: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '1.0' },
    content: { type: DataTypes.TEXT, allowNull: false },
    is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    renewal_days: { type: DataTypes.INTEGER },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'policies', modelName: 'Policy', updatedAt: false }
);

export class PolicyAcknowledgement extends Model {}
PolicyAcknowledgement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    policy_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    acknowledged_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE },
    ip_address: { type: DataTypes.STRING(64) }
  },
  { sequelize, tableName: 'policy_acknowledgements', modelName: 'PolicyAcknowledgement', createdAt: false, updatedAt: false }
);

export class EvidenceRecord extends Model {}
EvidenceRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID },
    course_id: { type: DataTypes.UUID },
    title: { type: DataTypes.STRING(220), allowNull: false },
    description: { type: DataTypes.TEXT },
    asset_id: { type: DataTypes.UUID },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'submitted' },
    verified_by_membership_id: { type: DataTypes.UUID },
    verified_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'evidence_records', modelName: 'EvidenceRecord', updatedAt: false }
);

export class ForumThread extends Model {}
ForumThread.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID },
    author_membership_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(220), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    is_pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { sequelize, tableName: 'forum_threads', modelName: 'ForumThread' }
);

export class ForumPost extends Model {}
ForumPost.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    thread_id: { type: DataTypes.UUID, allowNull: false },
    author_membership_id: { type: DataTypes.UUID, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false }
  },
  { sequelize, tableName: 'forum_posts', modelName: 'ForumPost', updatedAt: false }
);

export class Survey extends Model {}
Survey.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID },
    title: { type: DataTypes.STRING(200), allowNull: false },
    questions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'surveys', modelName: 'Survey', updatedAt: false }
);

export class SurveyResponse extends Model {}
SurveyResponse.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    survey_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    rating: { type: DataTypes.INTEGER },
    submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'survey_responses', modelName: 'SurveyResponse', createdAt: false, updatedAt: false }
);

export class GamificationPoint extends Model {}
GamificationPoint.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(150), allowNull: false }
  },
  { sequelize, tableName: 'gamification_points', modelName: 'GamificationPoint', updatedAt: false }
);

export class SavedReport extends Model {}
SavedReport.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    created_by_membership_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(180), allowNull: false },
    report_type: { type: DataTypes.STRING(60), allowNull: false },
    definition: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'saved_reports', modelName: 'SavedReport', updatedAt: false }
);

export class ScheduledReport extends Model {}
ScheduledReport.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    saved_report_id: { type: DataTypes.UUID, allowNull: false },
    cron_expression: { type: DataTypes.STRING(64), allowNull: false },
    recipients: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    export_format: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'csv' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_run_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'scheduled_reports', modelName: 'ScheduledReport', updatedAt: false }
);

export class Notification extends Model {}
Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID },
    user_id: { type: DataTypes.UUID, allowNull: false },
    channel: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'in_app' },
    title: { type: DataTypes.STRING(220), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    action_url: { type: DataTypes.TEXT },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_at: { type: DataTypes.DATE },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'notifications', modelName: 'Notification', updatedAt: false }
);

export class PlatformAnnouncement extends Model {}
PlatformAnnouncement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(220), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    severity: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'info' },
    target_audience: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'all_tenants' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    published_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE },
    created_by: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'platform_announcements', modelName: 'PlatformAnnouncement', timestamps: false }
);

export class PlatformSetting extends Model {}
PlatformSetting.init(
  {
    key: { type: DataTypes.STRING(100), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.TEXT },
    updated_by: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'platform_settings', modelName: 'PlatformSetting', createdAt: false }
);

export class AuditLog extends Model {}
AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID },
    actor_user_id: { type: DataTypes.UUID },
    actor_email: { type: DataTypes.STRING(255) },
    action: { type: DataTypes.STRING(120), allowNull: false },
    resource_type: { type: DataTypes.STRING(80), allowNull: false },
    resource_id: { type: DataTypes.STRING(120) },
    request_id: { type: DataTypes.STRING(100) },
    ip_address: { type: DataTypes.STRING(64) },
    user_agent: { type: DataTypes.TEXT },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'audit_logs', modelName: 'AuditLog', updatedAt: false }
);

export class IntegrationConnection extends Model {}
IntegrationConnection.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.STRING(60), allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    secret_hash: { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'integration_connections', modelName: 'IntegrationConnection' }
);

export class WebhookDelivery extends Model {}
WebhookDelivery.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    integration_id: { type: DataTypes.UUID, allowNull: false },
    event_type: { type: DataTypes.STRING(100), allowNull: false },
    idempotency_key: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    payload: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    response_status: { type: DataTypes.INTEGER },
    response_body: { type: DataTypes.TEXT },
    next_retry_at: { type: DataTypes.DATE },
    delivered_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'webhook_deliveries', modelName: 'WebhookDelivery', updatedAt: false }
);

export class BackgroundJobRecord extends Model {}
BackgroundJobRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID },
    queue_name: { type: DataTypes.STRING(80), allowNull: false },
    job_type: { type: DataTypes.STRING(80), allowNull: false },
    idempotency_key: { type: DataTypes.STRING(160), unique: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'queued' },
    result: { type: DataTypes.JSONB },
    error_message: { type: DataTypes.TEXT },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by_user_id: { type: DataTypes.UUID },
    started_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'background_job_records', modelName: 'BackgroundJobRecord', updatedAt: false }
);

import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class LearningProgress extends Model {}
LearningProgress.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    enrollment_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    lesson_id: { type: DataTypes.UUID, allowNull: false },
    is_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    progress_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    time_spent_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_position_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completed_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'learning_progress', modelName: 'LearningProgress', createdAt: false }
);

export class LearningEvent extends Model {}
LearningEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID },
    lesson_id: { type: DataTypes.UUID },
    event_type: { type: DataTypes.STRING(80), allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'learning_events', modelName: 'LearningEvent', updatedAt: false }
);

export class CompletionRecord extends Model {}
CompletionRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    enrollment_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    completed_units: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_required_units: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completion_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    assessment_passed: { type: DataTypes.BOOLEAN },
    is_course_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    total_learning_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completed_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'completion_records', modelName: 'CompletionRecord', createdAt: false }
);

export class Competency extends Model {}
Competency.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    code: { type: DataTypes.STRING(64) },
    description: { type: DataTypes.TEXT },
    framework: { type: DataTypes.STRING(100) }
  },
  { sequelize, tableName: 'competencies', modelName: 'Competency', updatedAt: false }
);

export class CertificateTemplate extends Model {}
CertificateTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    title_text: { type: DataTypes.STRING(220), allowNull: false, defaultValue: 'Certificate of Completion' },
    subtitle_text: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'This certifies that' },
    body_template: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'has successfully completed {{course_title}} on {{issued_date}}.' },
    signature_name: { type: DataTypes.STRING(150) },
    signature_title: { type: DataTypes.STRING(150) },
    accent_color: { type: DataTypes.STRING(20), defaultValue: '#2563eb' },
    validity_days: { type: DataTypes.INTEGER },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { sequelize, tableName: 'certificate_templates', modelName: 'CertificateTemplate' }
);

export class Certificate extends Model {}
Certificate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    template_id: { type: DataTypes.UUID },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    enrollment_id: { type: DataTypes.UUID },
    certificate_number: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    verification_code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    recipient_name: { type: DataTypes.STRING(180), allowNull: false },
    course_title: { type: DataTypes.STRING(250), allowNull: false },
    issued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE },
    revoked_at: { type: DataTypes.DATE },
    revocation_reason: { type: DataTypes.TEXT },
    pdf_asset_id: { type: DataTypes.UUID },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'certificates', modelName: 'Certificate', updatedAt: false }
);

export class DigitalBadge extends Model {}
DigitalBadge.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT },
    criteria: { type: DataTypes.TEXT },
    icon_name: { type: DataTypes.STRING(80), defaultValue: 'award' },
    color: { type: DataTypes.STRING(20), defaultValue: '#eab308' },
    course_id: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'digital_badges', modelName: 'DigitalBadge', updatedAt: false }
);

export class BadgeAward extends Model {}
BadgeAward.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    badge_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    awarded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'badge_awards', modelName: 'BadgeAward', createdAt: false, updatedAt: false }
);

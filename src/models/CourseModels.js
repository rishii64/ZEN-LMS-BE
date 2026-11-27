import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class Category extends Model {}
Category.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    parent_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT }
  },
  { sequelize, tableName: 'categories', modelName: 'Category', updatedAt: false }
);

export class Tag extends Model {}
Tag.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false }
  },
  { sequelize, tableName: 'tags', modelName: 'Tag', updatedAt: false }
);

export class ContentAsset extends Model {}
ContentAsset.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    uploaded_by: { type: DataTypes.UUID },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    storage_key: { type: DataTypes.TEXT, allowNull: false },
    mime_type: { type: DataTypes.STRING(150), allowNull: false },
    asset_kind: { type: DataTypes.STRING(40), allowNull: false },
    size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    checksum_sha256: { type: DataTypes.STRING(64) },
    scan_status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'clean' },
    is_reusable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
  },
  { sequelize, tableName: 'content_assets', modelName: 'ContentAsset', updatedAt: false }
);

export class Course extends Model {}
Course.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    category_id: { type: DataTypes.UUID },
    code: { type: DataTypes.STRING(64) },
    title: { type: DataTypes.STRING(250), allowNull: false },
    slug: { type: DataTypes.STRING(250), allowNull: false },
    summary: { type: DataTypes.TEXT },
    description: { type: DataTypes.TEXT },
    thumbnail_asset_id: { type: DataTypes.UUID },
    delivery_mode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'self_paced' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    language: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'en' },
    estimated_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    is_template: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    prerequisite_course_ids: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
    completion_policy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_by_membership_id: { type: DataTypes.UUID },
    approved_by_membership_id: { type: DataTypes.UUID },
    published_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'courses', modelName: 'Course' }
);

export class CourseTag extends Model {}
CourseTag.init(
  {
    organization_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    course_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    tag_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
  },
  { sequelize, tableName: 'course_tags', modelName: 'CourseTag', createdAt: false, updatedAt: false }
);

export class CourseVersion extends Model {}
CourseVersion.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    version_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    title: { type: DataTypes.STRING(250), allowNull: false },
    changelog: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by_membership_id: { type: DataTypes.UUID },
    published_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'course_versions', modelName: 'CourseVersion', updatedAt: false }
);

export class Module extends Model {}
Module.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    course_version_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(220), allowNull: false },
    description: { type: DataTypes.TEXT },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  },
  { sequelize, tableName: 'modules', modelName: 'Module' }
);

export class Lesson extends Model {}
Lesson.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    module_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(220), allowNull: false },
    content_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'text' },
    body_markdown: { type: DataTypes.TEXT },
    external_url: { type: DataTypes.TEXT },
    asset_id: { type: DataTypes.UUID },
    caption_asset_id: { type: DataTypes.UUID },
    transcript: { type: DataTypes.TEXT },
    language: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'en' },
    translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  },
  { sequelize, tableName: 'lessons', modelName: 'Lesson' }
);

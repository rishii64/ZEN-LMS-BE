import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class LearningPath extends Model {}
LearningPath.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(220), allowNull: false },
    description: { type: DataTypes.TEXT },
    is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    estimated_hours: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    created_by_membership_id: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'learning_paths', modelName: 'LearningPath' }
);

export class LearningPathItem extends Model {}
LearningPathItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    learning_path_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'learning_path_items', modelName: 'LearningPathItem', createdAt: false, updatedAt: false }
);

export class CourseOffering extends Model {}
CourseOffering.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    cohort_name: { type: DataTypes.STRING(180), allowNull: false },
    delivery_mode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'self_paced' },
    instructor_membership_id: { type: DataTypes.UUID },
    capacity: { type: DataTypes.INTEGER },
    waitlist_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requires_approval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    starts_at: { type: DataTypes.DATE },
    ends_at: { type: DataTypes.DATE },
    due_date: { type: DataTypes.DATE },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  { sequelize, tableName: 'course_offerings', modelName: 'CourseOffering' }
);

export class Enrollment extends Model {}
Enrollment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    offering_id: { type: DataTypes.UUID },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    assigned_by_membership_id: { type: DataTypes.UUID },
    assignment_source: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'self' },
    is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    waitlist_position: { type: DataTypes.INTEGER },
    due_date: { type: DataTypes.DATE },
    enrolled_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    approved_at: { type: DataTypes.DATE },
    approved_by_membership_id: { type: DataTypes.UUID },
    completed_at: { type: DataTypes.DATE },
    last_activity_at: { type: DataTypes.DATE }
  },
  { sequelize, tableName: 'enrollments', modelName: 'Enrollment' }
);

export class LearningSession extends Model {}
LearningSession.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    offering_id: { type: DataTypes.UUID },
    instructor_membership_id: { type: DataTypes.UUID },
    title: { type: DataTypes.STRING(220), allowNull: false },
    description: { type: DataTypes.TEXT },
    session_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'virtual_live' },
    meeting_url: { type: DataTypes.TEXT },
    location_name: { type: DataTypes.STRING(180) },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'scheduled' },
    rescheduled_reason: { type: DataTypes.TEXT }
  },
  { sequelize, tableName: 'learning_sessions', modelName: 'LearningSession' }
);

export class Attendance extends Model {}
Attendance.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    session_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'present' },
    check_in_at: { type: DataTypes.DATE },
    notes: { type: DataTypes.TEXT },
    recorded_by_membership_id: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'attendance', modelName: 'Attendance', updatedAt: false }
);

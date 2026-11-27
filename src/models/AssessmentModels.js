import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class Rubric extends Model {}
Rubric.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(180), allowNull: false },
    description: { type: DataTypes.TEXT },
    criteria: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
  },
  { sequelize, tableName: 'rubrics', modelName: 'Rubric' }
);

export class Assessment extends Model {}
Assessment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    module_id: { type: DataTypes.UUID },
    rubric_id: { type: DataTypes.UUID },
    title: { type: DataTypes.STRING(220), allowNull: false },
    description: { type: DataTypes.TEXT },
    assessment_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'quiz' },
    time_limit_minutes: { type: DataTypes.INTEGER },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    passing_score_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 70.0 },
    randomize_questions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    question_draw_count: { type: DataTypes.INTEGER },
    allow_resubmission: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by_membership_id: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'assessments', modelName: 'Assessment' }
);

export class Question extends Model {}
Question.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    assessment_id: { type: DataTypes.UUID },
    category_id: { type: DataTypes.UUID },
    question_type: { type: DataTypes.STRING, allowNull: false },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    explanation: { type: DataTypes.TEXT },
    points: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1.0 },
    correct_answer: { type: DataTypes.JSONB },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    is_bank_item: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  },
  { sequelize, tableName: 'questions', modelName: 'Question' }
);

export class QuestionOption extends Model {}
QuestionOption.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    question_id: { type: DataTypes.UUID, allowNull: false },
    option_text: { type: DataTypes.TEXT, allowNull: false },
    match_target: { type: DataTypes.TEXT },
    is_correct: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  },
  { sequelize, tableName: 'question_options', modelName: 'QuestionOption', createdAt: false, updatedAt: false }
);

export class AssessmentAttempt extends Model {}
AssessmentAttempt.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    assessment_id: { type: DataTypes.UUID, allowNull: false },
    enrollment_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    attempt_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'in_progress' },
    question_order: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    submitted_at: { type: DataTypes.DATE },
    expires_at: { type: DataTypes.DATE },
    score_earned: { type: DataTypes.DECIMAL(8, 2) },
    score_possible: { type: DataTypes.DECIMAL(8, 2) },
    percentage: { type: DataTypes.DECIMAL(5, 2) },
    passed: { type: DataTypes.BOOLEAN },
    graded_at: { type: DataTypes.DATE },
    graded_by_membership_id: { type: DataTypes.UUID }
  },
  { sequelize, tableName: 'assessment_attempts', modelName: 'AssessmentAttempt', updatedAt: false }
);

export class Answer extends Model {}
Answer.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    attempt_id: { type: DataTypes.UUID, allowNull: false },
    question_id: { type: DataTypes.UUID, allowNull: false },
    selected_option_ids: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
    text_response: { type: DataTypes.TEXT },
    matching_response: { type: DataTypes.JSONB },
    file_asset_id: { type: DataTypes.UUID },
    is_correct: { type: DataTypes.BOOLEAN },
    points_awarded: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    grader_feedback: { type: DataTypes.TEXT }
  },
  { sequelize, tableName: 'answers', modelName: 'Answer' }
);

export class Grade extends Model {}
Grade.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    attempt_id: { type: DataTypes.UUID, allowNull: false },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    course_id: { type: DataTypes.UUID, allowNull: false },
    rubric_scores: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    total_score: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    max_score: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    passed: { type: DataTypes.BOOLEAN, allowNull: false },
    feedback: { type: DataTypes.TEXT },
    graded_by_membership_id: { type: DataTypes.UUID },
    graded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: 'grades', modelName: 'Grade', createdAt: false, updatedAt: false }
);

import { sequelize, withTenantContext, withPlatformContext, testConnection } from '../db/sequelize.js';

import {
  SubscriptionPlan,
  PlanFeature,
  Organization,
  OrganizationSetting,
  OrganizationDomain,
  OrganizationModule,
  OrganizationSubscription,
  SubscriptionInvoice,
  PaymentTransaction,
  SubscriptionEvent
} from './TenancyModels.js';

import {
  User,
  OrganizationMembership,
  Permission,
  Role,
  RolePermission,
  MembershipRole,
  UserInvitation,
  Session
} from './IdentityModels.js';

import {
  OrgUnit,
  Location,
  Department,
  Team,
  Group,
  GroupMembership
} from './OrgStructureModels.js';

import {
  Category,
  Tag,
  ContentAsset,
  Course,
  CourseTag,
  CourseVersion,
  Module,
  Lesson
} from './CourseModels.js';

import {
  LearningPath,
  LearningPathItem,
  CourseOffering,
  Enrollment,
  LearningSession,
  Attendance
} from './DeliveryModels.js';

import {
  Rubric,
  Assessment,
  Question,
  QuestionOption,
  AssessmentAttempt,
  Answer,
  Grade
} from './AssessmentModels.js';

import {
  LearningProgress,
  LearningEvent,
  CompletionRecord,
  Competency,
  CertificateTemplate,
  Certificate,
  DigitalBadge,
  BadgeAward
} from './TrackingModels.js';

import {
  CustomFieldDefinition,
  CustomFieldValue,
  WorkflowDefinition,
  WorkflowInstance,
  FeatureFlag,
  Policy,
  PolicyAcknowledgement,
  EvidenceRecord,
  ForumThread,
  ForumPost,
  Survey,
  SurveyResponse,
  GamificationPoint,
  SavedReport,
  ScheduledReport,
  Notification,
  PlatformAnnouncement,
  PlatformSetting,
  AuditLog,
  IntegrationConnection,
  WebhookDelivery,
  BackgroundJobRecord
} from './EngagementOpsModels.js';

// --- Associations ---

// Tenancy & Subscriptions
Organization.hasOne(OrganizationSetting, { foreignKey: 'organization_id', as: 'settings' });
OrganizationSetting.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(OrganizationDomain, { foreignKey: 'organization_id', as: 'domains' });
OrganizationDomain.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(OrganizationModule, { foreignKey: 'organization_id', as: 'modules' });
OrganizationModule.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

SubscriptionPlan.hasMany(PlanFeature, { foreignKey: 'plan_id', as: 'features' });
PlanFeature.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });

Organization.hasMany(OrganizationSubscription, { foreignKey: 'organization_id', as: 'subscriptions' });
OrganizationSubscription.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
SubscriptionPlan.hasMany(OrganizationSubscription, { foreignKey: 'plan_id', as: 'subscriptions' });
OrganizationSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });

OrganizationSubscription.hasMany(SubscriptionInvoice, { foreignKey: 'subscription_id', as: 'invoices' });
SubscriptionInvoice.belongsTo(OrganizationSubscription, { foreignKey: 'subscription_id', as: 'subscription' });

// Identity & Memberships
User.hasMany(OrganizationMembership, { foreignKey: 'user_id', as: 'memberships' });
OrganizationMembership.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Organization.hasMany(OrganizationMembership, { foreignKey: 'organization_id', as: 'memberships' });
OrganizationMembership.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Organization.hasMany(Role, { foreignKey: 'organization_id', as: 'roles' });
Role.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Role.hasMany(RolePermission, { foreignKey: 'role_id', as: 'rolePermissions' });
RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });

OrganizationMembership.hasMany(MembershipRole, { foreignKey: 'membership_id', as: 'membershipRoles' });
MembershipRole.belongsTo(OrganizationMembership, { foreignKey: 'membership_id', as: 'membership' });
MembershipRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

Organization.hasMany(UserInvitation, { foreignKey: 'organization_id', as: 'invitations' });
UserInvitation.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Org Structure
Organization.hasMany(Department, { foreignKey: 'organization_id', as: 'departments' });
Department.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Department.hasMany(Team, { foreignKey: 'department_id', as: 'teams' });
Team.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

OrganizationMembership.belongsTo(Department, { foreignKey: 'primary_department_id', as: 'department' });
Department.hasMany(OrganizationMembership, { foreignKey: 'primary_department_id', as: 'members' });

// Courses & Content
Organization.hasMany(Course, { foreignKey: 'organization_id', as: 'courses' });
Course.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
Course.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Course.hasMany(CourseVersion, { foreignKey: 'course_id', as: 'versions' });
CourseVersion.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Module, { foreignKey: 'course_id', as: 'modules' });
Module.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Module.hasMany(Lesson, { foreignKey: 'module_id', as: 'lessons' });
Lesson.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });

// Delivery & Enrollments
Course.hasMany(Enrollment, { foreignKey: 'course_id', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Enrollment.belongsTo(OrganizationMembership, { foreignKey: 'membership_id', as: 'membership' });
Enrollment.belongsTo(CourseOffering, { foreignKey: 'offering_id', as: 'offering' });

LearningPath.hasMany(LearningPathItem, { foreignKey: 'learning_path_id', as: 'items' });
LearningPathItem.belongsTo(LearningPath, { foreignKey: 'learning_path_id', as: 'learningPath' });
LearningPathItem.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(CourseOffering, { foreignKey: 'course_id', as: 'offerings' });
CourseOffering.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Assessments
Course.hasMany(Assessment, { foreignKey: 'course_id', as: 'assessments' });
Assessment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Assessment.hasMany(Question, { foreignKey: 'assessment_id', as: 'questions' });
Question.belongsTo(Assessment, { foreignKey: 'assessment_id', as: 'assessment' });

Question.hasMany(QuestionOption, { foreignKey: 'question_id', as: 'options' });
QuestionOption.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

Assessment.hasMany(AssessmentAttempt, { foreignKey: 'assessment_id', as: 'attempts' });
AssessmentAttempt.belongsTo(Assessment, { foreignKey: 'assessment_id', as: 'assessment' });
AssessmentAttempt.belongsTo(Enrollment, { foreignKey: 'enrollment_id', as: 'enrollment' });
AssessmentAttempt.belongsTo(OrganizationMembership, { foreignKey: 'membership_id', as: 'membership' });

AssessmentAttempt.hasMany(Answer, { foreignKey: 'attempt_id', as: 'answers' });
Answer.belongsTo(AssessmentAttempt, { foreignKey: 'attempt_id', as: 'attempt' });

AssessmentAttempt.hasOne(Grade, { foreignKey: 'attempt_id', as: 'grade' });
Grade.belongsTo(AssessmentAttempt, { foreignKey: 'attempt_id', as: 'attempt' });

// Tracking & Credentials
Enrollment.hasMany(LearningProgress, { foreignKey: 'enrollment_id', as: 'progress' });
LearningProgress.belongsTo(Enrollment, { foreignKey: 'enrollment_id', as: 'enrollment' });

Enrollment.hasOne(CompletionRecord, { foreignKey: 'enrollment_id', as: 'completion' });
CompletionRecord.belongsTo(Enrollment, { foreignKey: 'enrollment_id', as: 'enrollment' });

Course.hasMany(Certificate, { foreignKey: 'course_id', as: 'certificates' });
Certificate.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Certificate.belongsTo(OrganizationMembership, { foreignKey: 'membership_id', as: 'membership' });
Certificate.belongsTo(CertificateTemplate, { foreignKey: 'template_id', as: 'template' });
Certificate.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// Ops & Engagement
Organization.hasMany(AuditLog, { foreignKey: 'organization_id', as: 'auditLogs' });
AuditLog.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

Organization.hasMany(Notification, { foreignKey: 'organization_id', as: 'notifications' });
Notification.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

export {
  sequelize,
  withTenantContext,
  withPlatformContext,
  testConnection,
  // Models
  SubscriptionPlan,
  PlanFeature,
  Organization,
  OrganizationSetting,
  OrganizationDomain,
  OrganizationModule,
  OrganizationSubscription,
  SubscriptionInvoice,
  PaymentTransaction,
  SubscriptionEvent,
  User,
  OrganizationMembership,
  Permission,
  Role,
  RolePermission,
  MembershipRole,
  UserInvitation,
  Session,
  OrgUnit,
  Location,
  Department,
  Team,
  Group,
  GroupMembership,
  Category,
  Tag,
  ContentAsset,
  Course,
  CourseTag,
  CourseVersion,
  Module,
  Lesson,
  LearningPath,
  LearningPathItem,
  CourseOffering,
  Enrollment,
  LearningSession,
  Attendance,
  Rubric,
  Assessment,
  Question,
  QuestionOption,
  AssessmentAttempt,
  Answer,
  Grade,
  LearningProgress,
  LearningEvent,
  CompletionRecord,
  Competency,
  CertificateTemplate,
  Certificate,
  DigitalBadge,
  BadgeAward,
  CustomFieldDefinition,
  CustomFieldValue,
  WorkflowDefinition,
  WorkflowInstance,
  FeatureFlag,
  Policy,
  PolicyAcknowledgement,
  EvidenceRecord,
  ForumThread,
  ForumPost,
  Survey,
  SurveyResponse,
  GamificationPoint,
  SavedReport,
  ScheduledReport,
  Notification,
  PlatformAnnouncement,
  PlatformSetting,
  AuditLog,
  IntegrationConnection,
  WebhookDelivery,
  BackgroundJobRecord
};

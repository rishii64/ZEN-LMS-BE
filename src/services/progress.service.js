import crypto from 'node:crypto';
import {
  Enrollment,
  Course,
  OrganizationMembership,
  User,
  Lesson,
  LearningProgress,
  AssessmentAttempt,
  CompletionRecord,
  OrganizationModule,
  Certificate,
  CertificateTemplate,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';

export class ProgressService {
  /**
   * Recalculates course completion strictly using:
   *   Completed required learning units / Total required learning units * 100
   * Tracks learning completion independently from assessment pass/fail status
   * unless the course/org completion_policy sets require_assessment_pass = true.
   */
  static async recalculateEnrollmentCompletion(organizationId, enrollmentId, transaction = null) {
    const runner = async (t) => {
      const enr = await Enrollment.findOne({
        where: { id: enrollmentId, organization_id: organizationId },
        include: [
          { model: Course, as: 'course' },
          {
            model: OrganizationMembership,
            as: 'membership',
            include: [{ model: User, as: 'user' }]
          }
        ],
        transaction: t
      });

      if (!enr) throw new NotFoundError('Enrollment');

      const requiredLessons = await Lesson.findAll({
        where: { organization_id: organizationId, course_id: enr.course_id, is_required: true },
        transaction: t
      });
      const totalRequired = requiredLessons.length;

      const completedProgress = await LearningProgress.findAll({
        where: {
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          is_completed: true
        },
        transaction: t
      });

      const requiredLessonIds = new Set(requiredLessons.map((l) => l.id));
      const completedRequired = completedProgress.filter((p) => requiredLessonIds.has(p.lesson_id)).length;

      const allProgress = await LearningProgress.findAll({
        where: { organization_id: organizationId, enrollment_id: enrollmentId },
        transaction: t
      });
      const totalSeconds = allProgress.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

      const pct = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 10000) / 100 : 100;

      // Check assessment attempts
      const attempts = await AssessmentAttempt.findAll({
        where: { organization_id: organizationId, enrollment_id: enrollmentId, status: 'graded' },
        transaction: t
      });
      const assessmentPassed = attempts.length > 0 ? attempts.some((a) => a.passed === true) : null;

      const completionPolicy = enr.course?.completion_policy || {};
      const requireAssessmentPass = Boolean(completionPolicy.require_assessment_pass);
      const unitsDone = totalRequired === 0 || completedRequired >= totalRequired;
      const isCompleted = unitsDone && (!requireAssessmentPass || assessmentPassed === true);

      const existingCr = await CompletionRecord.findOne({
        where: { organization_id: organizationId, enrollment_id: enrollmentId },
        transaction: t
      });

      let record;
      if (existingCr) {
        record = await existingCr.update(
          {
            completed_units: completedRequired,
            total_required_units: totalRequired,
            completion_percent: pct,
            assessment_passed: assessmentPassed,
            is_course_completed: isCompleted,
            total_learning_seconds: totalSeconds,
            completed_at: isCompleted ? (existingCr.completed_at || new Date()) : null
          },
          { transaction: t }
        );
      } else {
        record = await CompletionRecord.create(
          {
            organization_id: organizationId,
            enrollment_id: enrollmentId,
            membership_id: enr.membership_id,
            course_id: enr.course_id,
            completed_units: completedRequired,
            total_required_units: totalRequired,
            completion_percent: pct,
            assessment_passed: assessmentPassed,
            is_course_completed: isCompleted,
            total_learning_seconds: totalSeconds,
            completed_at: isCompleted ? new Date() : null
          },
          { transaction: t }
        );
      }

      if (isCompleted && enr.status !== 'completed') {
        await enr.update(
          {
            status: 'completed',
            completed_at: new Date(),
            last_activity_at: new Date()
          },
          { transaction: t }
        );

        // Auto-issue certificate if module is enabled and no active certificate exists
        const certModule = await OrganizationModule.findOne({
          where: { organization_id: organizationId, module_key: 'certificates', is_enabled: true },
          transaction: t
        });

        if (certModule) {
          const existingCert = await Certificate.findOne({
            where: { organization_id: organizationId, enrollment_id: enrollmentId, revoked_at: null },
            transaction: t
          });

          if (!existingCert) {
            const tpl = await CertificateTemplate.findOne({
              where: { organization_id: organizationId },
              order: [
                ['is_default', 'DESC'],
                ['created_at', 'ASC']
              ],
              transaction: t
            });

            const expiresAt = tpl?.validity_days
              ? new Date(Date.now() + tpl.validity_days * 86400000)
              : null;
            const certNum = `CERT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const verifyCode = crypto.randomBytes(12).toString('hex');

            await Certificate.create(
              {
                organization_id: organizationId,
                template_id: tpl?.id || null,
                membership_id: enr.membership_id,
                course_id: enr.course_id,
                enrollment_id: enrollmentId,
                certificate_number: certNum,
                verification_code: verifyCode,
                recipient_name: enr.membership?.user?.full_name || 'Learner',
                course_title: enr.course?.title || 'Course',
                expires_at: expiresAt
              },
              { transaction: t }
            );
          }
        }
      }

      return record;
    };

    if (transaction) {
      return runner(transaction);
    }
    return withTenantContext(organizationId, runner);
  }
}

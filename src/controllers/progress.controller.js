import {
  LearningProgress,
  LearningEvent,
  CompletionRecord,
  Lesson,
  Enrollment,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { ProgressService } from '../services/progress.service.js';
import { auditFromReq } from '../services/audit.service.js';

export class ProgressController {
  static async getEnrollmentProgress(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const enr = await Enrollment.findOne({
          where: { id: req.params.enrollmentId, organization_id: req.organizationId },
          transaction: t
        });
        if (!enr) throw new NotFoundError('Enrollment');

        const lessons = await Lesson.findAll({
          where: { organization_id: req.organizationId, course_id: enr.course_id },
          order: [['sort_order', 'ASC']],
          transaction: t
        });

        const progressRecords = await LearningProgress.findAll({
          where: { organization_id: req.organizationId, enrollment_id: req.params.enrollmentId },
          transaction: t
        });

        const completion = await CompletionRecord.findOne({
          where: { organization_id: req.organizationId, enrollment_id: req.params.enrollmentId },
          transaction: t
        });

        const lessonsWithProgress = lessons.map((l) => {
          const lp = progressRecords.find((p) => p.lesson_id === l.id);
          return {
            ...l.toJSON(),
            is_completed: lp?.is_completed || false,
            time_spent_seconds: lp?.time_spent_seconds || 0,
            last_position_seconds: lp?.last_position_seconds || 0,
            completed_at: lp?.completed_at || null
          };
        });

        return {
          enrollment: enr,
          completion: completion || { completion_percent: 0, is_course_completed: false },
          lessons: lessonsWithProgress
        };
      });

      return res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async recordEvent(req, res, next) {
    try {
      const b = req.body;
      const result = await withTenantContext(req.organizationId, async (t) => {
        const lesson = await Lesson.findOne({
          where: { id: req.params.lessonId, organization_id: req.organizationId },
          transaction: t
        });
        if (!lesson) throw new NotFoundError('Lesson');

        await LearningEvent.create(
          {
            organization_id: req.organizationId,
            membership_id: req.membership.id,
            course_id: lesson.course_id,
            lesson_id: lesson.id,
            event_type: b.eventType,
            duration_seconds: b.durationSeconds || 0,
            metadata: b.metadata || {}
          },
          { transaction: t }
        );

        const [lp] = await LearningProgress.findOrCreate({
          where: {
            organization_id: req.organizationId,
            enrollment_id: b.enrollmentId,
            lesson_id: lesson.id
          },
          defaults: {
            organization_id: req.organizationId,
            enrollment_id: b.enrollmentId,
            membership_id: req.membership.id,
            course_id: lesson.course_id,
            lesson_id: lesson.id,
            time_spent_seconds: b.durationSeconds || 0,
            last_position_seconds: b.positionSeconds || 0,
            is_completed: Boolean(b.isCompleted),
            completed_at: b.isCompleted ? new Date() : null
          },
          transaction: t
        });

        const updates = {
          time_spent_seconds: (lp.time_spent_seconds || 0) + (b.durationSeconds || 0)
        };
        if (b.positionSeconds !== undefined) updates.last_position_seconds = b.positionSeconds;
        if (b.isCompleted && !lp.is_completed) {
          updates.is_completed = true;
          updates.completed_at = new Date();
        }

        await lp.update(updates, { transaction: t });

        // Recalculate completion
        const completion = await ProgressService.recalculateEnrollmentCompletion(req.organizationId, b.enrollmentId, t);
        return { progress: lp, completion };
      });

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async recordLessonProgress(req, res, next) {
    try {
      const b = req.body;
      const result = await withTenantContext(req.organizationId, async (t) => {
        const lesson = await Lesson.findOne({
          where: { id: b.lessonId, organization_id: req.organizationId },
          transaction: t
        });
        if (!lesson) throw new NotFoundError('Lesson');

        await LearningEvent.create(
          {
            organization_id: req.organizationId,
            membership_id: req.membership.id,
            course_id: lesson.course_id,
            lesson_id: lesson.id,
            event_type: 'lesson_progress',
            duration_seconds: b.timeSpentSeconds || b.durationSeconds || 0,
            metadata: b.metadata || {}
          },
          { transaction: t }
        );

        let lp = await LearningProgress.findOne({
          where: {
            organization_id: req.organizationId,
            enrollment_id: b.enrollmentId,
            lesson_id: lesson.id
          },
          transaction: t
        });

        const isCompleted = b.isCompleted !== undefined ? Boolean(b.isCompleted) : true;
        const timeSpent = b.timeSpentSeconds || b.durationSeconds || 0;

        if (!lp) {
          lp = await LearningProgress.create(
            {
              organization_id: req.organizationId,
              enrollment_id: b.enrollmentId,
              membership_id: req.membership.id,
              course_id: lesson.course_id,
              lesson_id: lesson.id,
              time_spent_seconds: timeSpent,
              last_position_seconds: b.positionSeconds || 0,
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date() : null
            },
            { transaction: t }
          );
        } else {
          const updates = {
            time_spent_seconds: (lp.time_spent_seconds || 0) + timeSpent
          };
          if (b.positionSeconds !== undefined) updates.last_position_seconds = b.positionSeconds;
          if (isCompleted && !lp.is_completed) {
            updates.is_completed = true;
            updates.completed_at = new Date();
          }
          await lp.update(updates, { transaction: t });
        }

        // Recalculate completion
        const completion = await ProgressService.recalculateEnrollmentCompletion(req.organizationId, b.enrollmentId, t);
        return { progress: lp, completion };
      });

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async completeCourse(req, res, next) {
    try {
      const { enrollmentId } = req.body;
      const completion = await withTenantContext(req.organizationId, async (t) => {
        return ProgressService.recalculateEnrollmentCompletion(req.organizationId, enrollmentId, t);
      });

      await auditFromReq(req, 'course.completed_check', 'completion_record', completion.id, {
        isCompleted: completion.is_course_completed
      });

      return res.status(200).json({ success: true, data: completion });
    } catch (err) {
      next(err);
    }
  }
}

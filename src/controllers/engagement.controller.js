import {
  ForumThread,
  ForumPost,
  Notification,
  Survey,
  SurveyResponse,
  GamificationPoint,
  OrganizationMembership,
  User,
  Course,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';

export class EngagementController {
  static async listForums(req, res, next) {
    try {
      const courseId = req.query.courseId || null;
      const threads = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };
        if (courseId) whereClause.course_id = courseId;

        const records = await ForumThread.findAll({
          where: whereClause,
          include: [
            {
              model: OrganizationMembership,
              as: 'author',
              include: [{ model: User, as: 'user', attributes: ['full_name'] }]
            },
            { model: Course, as: 'course', attributes: ['title'] }
          ],
          order: [
            ['is_pinned', 'DESC'],
            ['created_at', 'DESC']
          ],
          transaction: t
        });

        return records.map((ft) => ({
          ...ft.toJSON(),
          author_name: ft.author?.user?.full_name,
          course_title: ft.course?.title,
          reply_count: 0
        }));
      });

      return res.status(200).json({ data: threads });
    } catch (err) {
      next(err);
    }
  }

  static async createForumThread(req, res, next) {
    try {
      const row = await withTenantContext(req.organizationId, async (t) => {
        return ForumThread.create(
          {
            organization_id: req.organizationId,
            course_id: req.body.courseId || null,
            author_membership_id: req.membership.id,
            title: req.body.title,
            body: req.body.body
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async listNotifications(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        return Notification.findAll({
          where: { organization_id: req.organizationId, user_id: req.user.id },
          order: [['created_at', 'DESC']],
          limit: 50,
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async markNotificationRead(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        await Notification.update(
          { is_read: true, read_at: new Date() },
          {
            where: { id: req.params.id, organization_id: req.organizationId, user_id: req.user.id },
            transaction: t
          }
        );
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async listSurveys(req, res, next) {
    try {
      const surveys = await withTenantContext(req.organizationId, async (t) => {
        return Survey.findAll({
          where: { organization_id: req.organizationId, is_active: true },
          order: [['created_at', 'DESC']],
          transaction: t
        });
      });
      return res.status(200).json({ data: surveys });
    } catch (err) {
      next(err);
    }
  }

  static async submitSurvey(req, res, next) {
    try {
      const { answers, rating } = req.body;
      const resp = await withTenantContext(req.organizationId, async (t) => {
        const [record] = await SurveyResponse.upsert(
          {
            organization_id: req.organizationId,
            survey_id: req.params.id,
            membership_id: req.membership.id,
            answers: answers || {},
            rating: rating || null
          },
          { transaction: t }
        );
        return record;
      });
      return res.status(200).json({ success: true, data: resp });
    } catch (err) {
      next(err);
    }
  }
}

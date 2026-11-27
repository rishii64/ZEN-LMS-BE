import { Op } from 'sequelize';
import {
  Course,
  CourseVersion,
  Module,
  Lesson,
  Category,
  Tag,
  CourseTag,
  Enrollment,
  withTenantContext
} from '../models/index.js';
import { BadRequestError, NotFoundError, QuotaExceededError } from '../utils/errors.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import { auditFromReq } from '../services/audit.service.js';

export class CourseController {
  static async listCategories(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        return Category.findAll({
          where: { organization_id: req.organizationId },
          order: [['name', 'ASC']],
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const b = req.body;
      const slug = b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const row = await withTenantContext(req.organizationId, async (t) => {
        return Category.create(
          {
            organization_id: req.organizationId,
            parent_id: b.parentId || null,
            name: b.name,
            slug,
            description: b.description || null
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async listCourses(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const scope = req.permissionScope;
      const statusFilter = req.query.status || null;
      const categoryId = req.query.categoryId || null;

      const data = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };

        if (scope?.scope === 'course') {
          const courseIds = scope.scopeEntities?.course || [];
          whereClause[Op.or] = [
            { id: { [Op.in]: courseIds } },
            { created_by_membership_id: req.membership.id },
            { status: 'published' }
          ];
        }

        if (statusFilter) whereClause.status = statusFilter;
        if (categoryId) whereClause.category_id = categoryId;

        if (pg.search) {
          whereClause[Op.or] = [
            { title: { [Op.iLike]: `%${pg.search}%` } },
            { code: { [Op.iLike]: `%${pg.search}%` } },
            { summary: { [Op.iLike]: `%${pg.search}%` } }
          ];
        }

        const { count, rows } = await Course.findAndCountAll({
          where: whereClause,
          include: [{ model: Category, as: 'category', required: false }],
          limit: pg.limit,
          offset: pg.offset,
          order: [['updated_at', 'DESC']],
          transaction: t
        });

        const formatted = rows.map((c) => ({
          ...c.toJSON(),
          category_name: c.category?.name || null,
          lessons_count: 0,
          enrolled_count: 0
        }));

        return paginatedResponse(formatted, count, pg);
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createCourse(req, res, next) {
    try {
      const b = req.body;
      const slug = b.slug || b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      const result = await withTenantContext(req.organizationId, async (t) => {
        const courseCount = await Course.count({
          where: { organization_id: req.organizationId },
          transaction: t
        });
        const maxCourses = req.entitlements?.limits?.maxCourses ?? 25;
        if (courseCount >= maxCourses) {
          throw new QuotaExceededError(`Maximum course allocation (${maxCourses}) reached for your subscription.`);
        }

        const course = await Course.create(
          {
            organization_id: req.organizationId,
            category_id: b.categoryId || null,
            code: b.code || null,
            title: b.title,
            slug,
            summary: b.summary || null,
            description: b.description || null,
            delivery_mode: b.deliveryMode || 'self_paced',
            status: 'draft',
            language: b.language || 'en',
            estimated_minutes: b.estimatedMinutes || 60,
            is_template: Boolean(b.isTemplate),
            is_mandatory: Boolean(b.isMandatory),
            prerequisite_course_ids: b.prerequisiteCourseIds || [],
            completion_policy: b.completionPolicy || { require_all_required_lessons: true, require_assessment_pass: false },
            created_by_membership_id: req.membership.id
          },
          { transaction: t }
        );

        const version = await CourseVersion.create(
          {
            organization_id: req.organizationId,
            course_id: course.id,
            version_number: 1,
            title: b.title,
            status: 'draft',
            is_current: true,
            created_by_membership_id: req.membership.id
          },
          { transaction: t }
        );

        const defaultModule = await Module.create(
          {
            organization_id: req.organizationId,
            course_id: course.id,
            course_version_id: version.id,
            title: 'Module 1: Getting Started',
            sort_order: 1
          },
          { transaction: t }
        );

        return { course, version, defaultModule };
      });

      await auditFromReq(req, 'courses.created', 'course', result.course.id, { title: b.title });
      return res.status(201).json({
        success: true,
        data: {
          ...result.course.toJSON(),
          defaultModuleId: result.defaultModule.id,
          versionId: result.version.id
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCourse(req, res, next) {
    try {
      const course = await withTenantContext(req.organizationId, async (t) => {
        const record = await Course.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          include: [
            { model: Category, as: 'category' },
            {
              model: Module,
              as: 'modules',
              include: [{ model: Lesson, as: 'lessons' }]
            }
          ],
          order: [
            [{ model: Module, as: 'modules' }, 'sort_order', 'ASC'],
            [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'sort_order', 'ASC']
          ],
          transaction: t
        });
        if (!record) throw new NotFoundError('Course');
        return record;
      });

      return res.status(200).json({ data: course });
    } catch (err) {
      next(err);
    }
  }

  static async updateCourse(req, res, next) {
    try {
      const b = req.body;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const course = await Course.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!course) throw new NotFoundError('Course');

        const updates = {};
        if (b.title) updates.title = b.title;
        if (b.code !== undefined) updates.code = b.code;
        if (b.categoryId !== undefined) updates.category_id = b.categoryId;
        if (b.summary !== undefined) updates.summary = b.summary;
        if (b.description !== undefined) updates.description = b.description;
        if (b.deliveryMode) updates.delivery_mode = b.deliveryMode;
        if (b.estimatedMinutes) updates.estimated_minutes = b.estimatedMinutes;
        if (b.isMandatory !== undefined) updates.is_mandatory = b.isMandatory;
        if (b.completionPolicy) updates.completion_policy = b.completionPolicy;

        await course.update(updates, { transaction: t });
        return course;
      });

      await auditFromReq(req, 'courses.updated', 'course', updated.id);
      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async transitionCourse(req, res, next) {
    try {
      const { action, changelog } = req.body;
      const statusMap = {
        submit_review: 'in_review',
        approve: 'approved',
        publish: 'published',
        archive: 'archived',
        revert_draft: 'draft'
      };
      const newStatus = statusMap[action];
      if (!newStatus) throw new BadRequestError('Invalid transition action');

      const updated = await withTenantContext(req.organizationId, async (t) => {
        const course = await Course.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!course) throw new NotFoundError('Course');

        if (action === 'publish') {
          const lessonsCount = await Lesson.count({
            where: { organization_id: req.organizationId, course_id: course.id },
            transaction: t
          });
          if (lessonsCount === 0) {
            throw new BadRequestError('Course cannot be published without at least one lesson');
          }
        }

        const updates = { status: newStatus };
        if (action === 'publish') {
          updates.published_at = new Date();
          updates.approved_by_membership_id = req.membership.id;
        } else if (action === 'approve') {
          updates.approved_by_membership_id = req.membership.id;
        }
        await course.update(updates, { transaction: t });

        await CourseVersion.update(
          {
            status: newStatus,
            published_at: action === 'publish' ? new Date() : undefined,
            changelog: changelog || undefined
          },
          { where: { course_id: course.id, is_current: true }, transaction: t }
        );

        return course;
      });

      await auditFromReq(req, `course.transition_${action}`, 'course', updated.id);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async publishCourse(req, res, next) {
    try {
      const published = await withTenantContext(req.organizationId, async (t) => {
        const course = await Course.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!course) throw new NotFoundError('Course');

        const lessonsCount = await Lesson.count({
          where: { organization_id: req.organizationId, course_id: course.id },
          transaction: t
        });
        if (lessonsCount === 0) {
          throw new BadRequestError('Course cannot be published without at least one lesson');
        }

        await course.update(
          {
            status: 'published',
            published_at: new Date(),
            approved_by_membership_id: req.membership.id
          },
          { transaction: t }
        );

        await CourseVersion.update(
          { status: 'published', published_at: new Date() },
          { where: { course_id: course.id, is_current: true }, transaction: t }
        );

        return course;
      });

      await auditFromReq(req, 'courses.published', 'course', published.id);
      return res.status(200).json({ success: true, message: 'Course published', data: published });
    } catch (err) {
      next(err);
    }
  }

  static async addModule(req, res, next) {
    try {
      const b = req.body;
      const mod = await withTenantContext(req.organizationId, async (t) => {
        const currentVersion = await CourseVersion.findOne({
          where: { course_id: req.params.id, organization_id: req.organizationId, is_current: true },
          transaction: t
        });
        if (!currentVersion) throw new NotFoundError('Course Version');

        return Module.create(
          {
            organization_id: req.organizationId,
            course_id: req.params.id,
            course_version_id: currentVersion.id,
            title: b.title,
            description: b.description || null,
            sort_order: b.sortOrder || 1
          },
          { transaction: t }
        );
      });

      return res.status(201).json({ data: mod });
    } catch (err) {
      next(err);
    }
  }

  static async addLesson(req, res, next) {
    try {
      const b = req.body;
      const lesson = await withTenantContext(req.organizationId, async (t) => {
        return Lesson.create(
          {
            organization_id: req.organizationId,
            course_id: req.params.id,
            module_id: req.params.moduleId,
            title: b.title,
            content_type: b.contentType || 'text',
            body_markdown: b.bodyMarkdown || null,
            external_url: b.externalUrl || null,
            asset_id: b.assetId || null,
            duration_minutes: b.durationMinutes || 10,
            is_required: b.isRequired !== false,
            sort_order: b.sortOrder || 1
          },
          { transaction: t }
        );
      });

      return res.status(201).json({ data: lesson });
    } catch (err) {
      next(err);
    }
  }

  static async updateLesson(req, res, next) {
    try {
      const b = req.body;
      const updated = await withTenantContext(req.organizationId, async (t) => {
        const lesson = await Lesson.findOne({
          where: { id: req.params.lessonId, organization_id: req.organizationId, course_id: req.params.id },
          transaction: t
        });
        if (!lesson) throw new NotFoundError('Lesson');

        const updates = {};
        if (b.title) updates.title = b.title;
        if (b.contentType) updates.content_type = b.contentType;
        if (b.bodyMarkdown !== undefined) updates.body_markdown = b.bodyMarkdown;
        if (b.externalUrl !== undefined) updates.external_url = b.externalUrl;
        if (b.durationMinutes !== undefined) updates.duration_minutes = b.durationMinutes;
        if (b.isRequired !== undefined) updates.is_required = b.isRequired;
        if (b.sortOrder !== undefined) updates.sort_order = b.sortOrder;

        await lesson.update(updates, { transaction: t });
        return lesson;
      });

      return res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteLesson(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        await Lesson.destroy({
          where: { id: req.params.lessonId, organization_id: req.organizationId, course_id: req.params.id },
          transaction: t
        });
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

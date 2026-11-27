import {
  LearningPath,
  LearningPathItem,
  Course,
  Enrollment,
  OrganizationMembership,
  withTenantContext
} from '../models/index.js';
import { NotFoundError } from '../utils/errors.js';
import { auditFromReq } from '../services/audit.service.js';

export class LearningPathController {
  static async listLearningPaths(req, res, next) {
    try {
      const paths = await withTenantContext(req.organizationId, async (t) => {
        const records = await LearningPath.findAll({
          where: { organization_id: req.organizationId },
          include: [
            {
              model: LearningPathItem,
              as: 'items',
              include: [{ model: Course, as: 'course', attributes: ['title', 'status', 'estimated_minutes'] }]
            }
          ],
          order: [
            ['created_at', 'DESC'],
            [{ model: LearningPathItem, as: 'items' }, 'sort_order', 'ASC']
          ],
          transaction: t
        });

        return records.map((p) => ({
          ...p.toJSON(),
          items: (p.items || []).map((i) => ({
            ...i.toJSON(),
            course_title: i.course?.title,
            course_status: i.course?.status,
            estimated_minutes: i.course?.estimated_minutes
          }))
        }));
      });

      return res.status(200).json({ data: paths });
    } catch (err) {
      next(err);
    }
  }

  static async createLearningPath(req, res, next) {
    try {
      const b = req.body;
      const slug = `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.floor(Math.random() * 9000 + 1000)}`;

      const pathRow = await withTenantContext(req.organizationId, async (t) => {
        const lp = await LearningPath.create(
          {
            organization_id: req.organizationId,
            title: b.title,
            slug,
            description: b.description || null,
            is_mandatory: Boolean(b.isMandatory),
            status: b.status || 'published',
            estimated_hours: b.estimatedHours || 0,
            created_by_membership_id: req.membership.id
          },
          { transaction: t }
        );

        if (Array.isArray(b.courseIds)) {
          let order = 1;
          for (const courseId of b.courseIds) {
            await LearningPathItem.create(
              {
                organization_id: req.organizationId,
                learning_path_id: lp.id,
                course_id: courseId,
                sort_order: order++,
                is_required: true
              },
              { transaction: t }
            );
          }
        }

        return lp;
      });

      await auditFromReq(req, 'learning_path.created', 'learning_path', pathRow.id, { title: pathRow.title });
      return res.status(201).json({ data: pathRow });
    } catch (err) {
      next(err);
    }
  }

  static async enrollLearningPath(req, res, next) {
    try {
      const enrolledCount = await withTenantContext(req.organizationId, async (t) => {
        const items = await LearningPathItem.findAll({
          where: { organization_id: req.organizationId, learning_path_id: req.params.id },
          order: [['sort_order', 'ASC']],
          transaction: t
        });

        if (items.length === 0) throw new NotFoundError('Learning Path or items');

        let targetMembers = req.body.membershipIds || [];
        if (req.body.departmentId) {
          const mems = await OrganizationMembership.findAll({
            where: {
              organization_id: req.organizationId,
              primary_department_id: req.body.departmentId,
              status: 'active'
            },
            attributes: ['id'],
            transaction: t
          });
          targetMembers = [...new Set([...targetMembers, ...mems.map((r) => r.id)])];
        }
        if (targetMembers.length === 0) targetMembers = [req.membership.id];

        let count = 0;
        for (const mId of targetMembers) {
          for (const item of items) {
            const [enr, created] = await Enrollment.findOrCreate({
              where: {
                organization_id: req.organizationId,
                course_id: item.course_id,
                membership_id: mId
              },
              defaults: {
                organization_id: req.organizationId,
                course_id: item.course_id,
                membership_id: mId,
                assigned_by_membership_id: req.membership.id,
                assignment_source: 'learning_path',
                status: 'active'
              },
              transaction: t
            });
            if (created) count++;
          }
        }
        return count;
      });

      return res.status(200).json({ success: true, enrolledCount });
    } catch (err) {
      next(err);
    }
  }
}

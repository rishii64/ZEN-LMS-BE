import { Op } from 'sequelize';
import {
  Enrollment,
  Course,
  CourseOffering,
  OrganizationMembership,
  User,
  Department,
  CompletionRecord,
  LearningSession,
  Attendance,
  withTenantContext
} from '../models/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import { auditFromReq } from '../services/audit.service.js';

export class EnrollmentController {
  static async listEnrollments(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const scope = req.permissionScope;
      const courseId = req.query.courseId || null;
      const statusFilter = req.query.status || null;
      const mine = req.query.mine === 'true';

      const data = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };

        if (mine || scope?.scope === 'self') {
          whereClause.membership_id = req.membership.id;
        } else if (scope?.scope === 'department') {
          const depts = [...new Set([...(scope.scopeEntities?.department || []), req.membership.primary_department_id].filter(Boolean))];
          if (depts.length === 0) return paginatedResponse([], 0, pg);
        }

        if (courseId) whereClause.course_id = courseId;
        if (statusFilter) whereClause.status = statusFilter;

        const { count, rows } = await Enrollment.findAndCountAll({
          where: whereClause,
          include: [
            { model: Course, as: 'course', attributes: ['id', 'title', 'delivery_mode', 'estimated_minutes'] },
            {
              model: OrganizationMembership,
              as: 'membership',
              include: [{ model: User, as: 'user', attributes: ['full_name', 'email'] }]
            },
            { model: CompletionRecord, as: 'completion', required: false }
          ],
          limit: pg.limit,
          offset: pg.offset,
          order: [['created_at', 'DESC']],
          transaction: t
        });

        const formatted = rows.map((e) => ({
          ...e.toJSON(),
          course_title: e.course?.title,
          delivery_mode: e.course?.delivery_mode,
          estimated_minutes: e.course?.estimated_minutes,
          learner_name: e.membership?.user?.full_name,
          learner_email: e.membership?.user?.email,
          completion_percent: e.completion?.completion_percent || 0,
          completed_units: e.completion?.completed_units || 0,
          total_required_units: e.completion?.total_required_units || 0,
          assessment_passed: e.completion?.assessment_passed
        }));

        return paginatedResponse(formatted, count, pg);
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createOffering(req, res, next) {
    try {
      const b = req.body;
      const row = await withTenantContext(req.organizationId, async (t) => {
        return CourseOffering.create(
          {
            organization_id: req.organizationId,
            course_id: b.courseId,
            cohort_name: b.cohortName,
            delivery_mode: b.deliveryMode || 'self_paced',
            instructor_membership_id: b.instructorMembershipId || null,
            capacity: b.capacity || null,
            waitlist_enabled: b.waitlistEnabled !== false,
            requires_approval: Boolean(b.requiresApproval),
            starts_at: b.startsAt || null,
            ends_at: b.endsAt || null,
            due_date: b.dueDate || null
          },
          { transaction: t }
        );
      });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async enroll(req, res, next) {
    try {
      const b = req.body;
      const created = await withTenantContext(req.organizationId, async (t) => {
        const course = await Course.findOne({
          where: { organization_id: req.organizationId, id: b.courseId },
          transaction: t
        });
        if (!course) throw new NotFoundError('Course');

        let offering = null;
        if (b.offeringId) {
          offering = await CourseOffering.findOne({
            where: { organization_id: req.organizationId, id: b.offeringId },
            transaction: t
          });
          if (!offering) throw new NotFoundError('Course Offering');
        }

        let targets = b.membershipIds ? [...b.membershipIds] : [];
        let source = targets.length > 1 ? 'admin' : 'self';

        if (b.departmentId) {
          source = 'department';
          const mems = await OrganizationMembership.findAll({
            where: {
              organization_id: req.organizationId,
              primary_department_id: b.departmentId,
              status: 'active'
            },
            attributes: ['id'],
            transaction: t
          });
          targets.push(...mems.map((m) => m.id));
        }

        targets = [...new Set(targets)];
        if (targets.length === 0) targets = [req.membership.id];

        const inserted = [];
        for (const mId of targets) {
          let status = 'active';
          let waitlistPos = null;

          if (offering?.requires_approval && mId === req.membership.id && !req.membership.is_org_admin) {
            status = 'pending_approval';
          } else if (offering?.capacity) {
            const activeCount = await Enrollment.count({
              where: { organization_id: req.organizationId, offering_id: offering.id, status: 'active' },
              transaction: t
            });
            if (activeCount >= offering.capacity) {
              if (!offering.waitlist_enabled) {
                throw new BadRequestError('Course offering capacity reached');
              }
              status = 'waitlisted';
              const wlCount = await Enrollment.count({
                where: { organization_id: req.organizationId, offering_id: offering.id, status: 'waitlisted' },
                transaction: t
              });
              waitlistPos = wlCount + 1;
            }
          }

          const [enr] = await Enrollment.findOrCreate({
            where: {
              organization_id: req.organizationId,
              course_id: b.courseId,
              membership_id: mId
            },
            defaults: {
              organization_id: req.organizationId,
              course_id: b.courseId,
              offering_id: b.offeringId || null,
              membership_id: mId,
              assigned_by_membership_id: req.membership.id,
              assignment_source: source,
              is_mandatory: Boolean(b.isMandatory),
              status,
              waitlist_position: waitlistPos,
              due_date: b.dueDate || offering?.due_date || null
            },
            transaction: t
          });

          await CompletionRecord.findOrCreate({
            where: { organization_id: req.organizationId, enrollment_id: enr.id },
            defaults: {
              organization_id: req.organizationId,
              enrollment_id: enr.id,
              membership_id: mId,
              course_id: b.courseId
            },
            transaction: t
          });

          inserted.push(enr);
        }

        return inserted;
      });

      await auditFromReq(req, 'enrollments.created', 'course', b.courseId, { enrolledCount: created.length });
      return res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  }

  static async dropEnrollment(req, res, next) {
    try {
      await withTenantContext(req.organizationId, async (t) => {
        const enr = await Enrollment.findOne({
          where: { id: req.params.id, organization_id: req.organizationId },
          transaction: t
        });
        if (!enr) throw new NotFoundError('Enrollment');
        await enr.update({ status: 'dropped' }, { transaction: t });
      });

      await auditFromReq(req, 'enrollments.dropped', 'enrollment', req.params.id);
      return res.status(200).json({ success: true, message: 'Enrollment dropped' });
    } catch (err) {
      next(err);
    }
  }
}

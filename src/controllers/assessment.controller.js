import { Op } from 'sequelize';
import {
  Assessment,
  Question,
  QuestionOption,
  AssessmentAttempt,
  Answer,
  Grade,
  Course,
  Enrollment,
  OrganizationMembership,
  User,
  withTenantContext
} from '../models/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { ProgressService } from '../services/progress.service.js';
import { auditFromReq } from '../services/audit.service.js';

export class AssessmentController {
  static async listAssessments(req, res, next) {
    try {
      const courseId = req.query.courseId || null;
      const rows = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };
        if (courseId) whereClause.course_id = courseId;

        const records = await Assessment.findAll({
          where: whereClause,
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'] }],
          order: [['created_at', 'DESC']],
          transaction: t
        });

        return records.map((a) => ({
          ...a.toJSON(),
          course_title: a.course?.title,
          question_count: 0
        }));
      });

      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async createAssessment(req, res, next) {
    try {
      const b = req.body;
      const row = await withTenantContext(req.organizationId, async (t) => {
        return Assessment.create(
          {
            organization_id: req.organizationId,
            course_id: b.courseId,
            module_id: b.moduleId || null,
            title: b.title,
            description: b.description || null,
            assessment_type: b.assessmentType || 'quiz',
            time_limit_minutes: b.timeLimitMinutes || null,
            max_attempts: b.maxAttempts ?? 3,
            passing_score_percent: b.passingScorePercent ?? 70,
            randomize_questions: Boolean(b.randomizeQuestions),
            question_draw_count: b.questionDrawCount || null,
            allow_resubmission: b.allowResubmission !== false,
            created_by_membership_id: req.membership.id
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'assessment.created', 'assessment', row.id, { title: row.title });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }

  static async getAssessment(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const assessment = await Assessment.findOne({
          where: { organization_id: req.organizationId, id: req.params.id },
          include: [
            {
              model: Question,
              as: 'questions',
              include: [{ model: QuestionOption, as: 'options' }]
            }
          ],
          order: [
            [{ model: Question, as: 'questions' }, 'sort_order', 'ASC'],
            [{ model: Question, as: 'questions' }, { model: QuestionOption, as: 'options' }, 'sort_order', 'ASC']
          ],
          transaction: t
        });
        if (!assessment) throw new NotFoundError('Assessment');
        return assessment;
      });

      return res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async addQuestion(req, res, next) {
    try {
      const b = req.body;
      const question = await withTenantContext(req.organizationId, async (t) => {
        const maxSortOrder = (await Question.max('sort_order', {
          where: { organization_id: req.organizationId, assessment_id: req.params.id },
          transaction: t
        })) || 0;

        const q = await Question.create(
          {
            organization_id: req.organizationId,
            assessment_id: req.params.id,
            question_type: b.questionType,
            prompt: b.prompt,
            explanation: b.explanation || null,
            points: b.points ?? 1,
            correct_answer: b.correctAnswer !== undefined ? b.correctAnswer : null,
            sort_order: maxSortOrder + 1,
            is_bank_item: Boolean(b.isBankItem)
          },
          { transaction: t }
        );

        const options = [];
        if (Array.isArray(b.options)) {
          let optOrder = 1;
          for (const opt of b.options) {
            const createdOpt = await QuestionOption.create(
              {
                organization_id: req.organizationId,
                question_id: q.id,
                option_text: opt.optionText,
                match_target: opt.matchTarget || null,
                is_correct: Boolean(opt.isCorrect),
                sort_order: optOrder++
              },
              { transaction: t }
            );
            options.push(createdOpt.toJSON());
          }
        }

        return { ...q.toJSON(), options };
      });

      return res.status(201).json({ data: question });
    } catch (err) {
      next(err);
    }
  }

  // Attempts
  static async listAttempts(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        const whereClause = { organization_id: req.organizationId };
        if (req.permissionScope?.scope === 'self') {
          whereClause.membership_id = req.membership.id;
        }
        if (req.query.status) whereClause.status = req.query.status;

        const records = await AssessmentAttempt.findAll({
          where: whereClause,
          include: [
            { model: Assessment, as: 'assessment', attributes: ['id', 'title', 'passing_score_percent'] },
            {
              model: OrganizationMembership,
              as: 'membership',
              include: [{ model: User, as: 'user', attributes: ['full_name'] }]
            }
          ],
          order: [['created_at', 'DESC']],
          transaction: t
        });

        return records.map((att) => ({
          ...att.toJSON(),
          assessment_title: att.assessment?.title,
          passing_score_percent: att.assessment?.passing_score_percent,
          learner_name: att.membership?.user?.full_name
        }));
      });

      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async startAttempt(req, res, next) {
    try {
      const { assessmentId, enrollmentId } = req.body;
      const data = await withTenantContext(req.organizationId, async (t) => {
        const assessment = await Assessment.findOne({
          where: { organization_id: req.organizationId, id: assessmentId },
          transaction: t
        });
        if (!assessment) throw new NotFoundError('Assessment');

        const enr = await Enrollment.findOne({
          where: { organization_id: req.organizationId, id: enrollmentId, membership_id: req.membership.id },
          transaction: t
        });
        if (!enr) throw new NotFoundError('Enrollment');

        const prevCount = await AssessmentAttempt.count({
          where: { organization_id: req.organizationId, assessment_id: assessmentId, membership_id: req.membership.id },
          transaction: t
        });
        const attemptNum = prevCount + 1;
        if (attemptNum > assessment.max_attempts) {
          throw new BadRequestError(`Maximum attempts (${assessment.max_attempts}) reached for this assessment.`);
        }

        const questions = await Question.findAll({
          where: { organization_id: req.organizationId, assessment_id: assessmentId },
          include: [
            {
              model: QuestionOption,
              as: 'options',
              attributes: ['id', 'question_id', 'option_text', 'match_target', 'sort_order']
            }
          ],
          order: [['sort_order', 'ASC']],
          transaction: t
        });

        let qList = [...questions];
        if (assessment.randomize_questions) {
          qList.sort(() => Math.random() - 0.5);
        }
        if (assessment.question_draw_count && assessment.question_draw_count < qList.length) {
          qList = qList.slice(0, assessment.question_draw_count);
        }

        const expiresAt = assessment.time_limit_minutes
          ? new Date(Date.now() + assessment.time_limit_minutes * 60000)
          : null;

        const attempt = await AssessmentAttempt.create(
          {
            organization_id: req.organizationId,
            assessment_id: assessmentId,
            enrollment_id: enrollmentId,
            membership_id: req.membership.id,
            attempt_number: attemptNum,
            status: 'in_progress',
            question_order: qList.map((q) => q.id),
            expires_at: expiresAt
          },
          { transaction: t }
        );

        return {
          attempt,
          questions: qList
        };
      });

      return res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async submitAttempt(req, res, next) {
    try {
      const result = await withTenantContext(req.organizationId, async (t) => {
        const attempt = await AssessmentAttempt.findOne({
          where: { organization_id: req.organizationId, id: req.params.attemptId },
          include: [{ model: Assessment, as: 'assessment' }],
          transaction: t
        });

        if (!attempt) throw new NotFoundError('Assessment attempt');
        if (attempt.membership_id !== req.membership.id && !req.membership.is_org_admin) {
          throw new BadRequestError('Cannot submit another user attempt');
        }
        if (attempt.expires_at && new Date(attempt.expires_at) < new Date()) {
          throw new BadRequestError('Assessment time limit expired');
        }

        const questions = await Question.findAll({
          where: { organization_id: req.organizationId, assessment_id: attempt.assessment_id },
          include: [{ model: QuestionOption, as: 'options' }],
          transaction: t
        });

        let earned = 0;
        let possible = 0;

        for (const q of questions) {
          if (attempt.question_order?.length && !attempt.question_order.includes(q.id)) continue;
          const pts = Number(q.points);
          possible += pts;

          const submitted = req.body.answers.find((a) => a.questionId === q.id);
          const qOpts = q.options || [];
          let isCorrect = null;
          let awarded = 0;

          if (q.question_type === 'mcq_single') {
            const correctOpt = qOpts.find((o) => o.is_correct);
            const userChoice = submitted?.selectedOptionIds?.[0];
            isCorrect = Boolean(correctOpt && userChoice === correctOpt.id);
            awarded = isCorrect ? pts : 0;
          } else if (q.question_type === 'mcq_multi') {
            const correctIds = new Set(qOpts.filter((o) => o.is_correct).map((o) => o.id));
            const userIds = new Set(submitted?.selectedOptionIds || []);
            isCorrect = correctIds.size === userIds.size && [...correctIds].every((id) => userIds.has(id));
            awarded = isCorrect ? pts : 0;
          } else if (q.question_type === 'true_false') {
            const userChoice = submitted?.selectedOptionIds?.[0];
            const correctOpt = qOpts.find((o) => o.is_correct);
            isCorrect = Boolean(correctOpt && userChoice === correctOpt.id);
            awarded = isCorrect ? pts : 0;
          } else {
            isCorrect = true;
            awarded = pts;
          }

          earned += awarded;

          if (submitted) {
            const existingAns = await Answer.findOne({
              where: {
                organization_id: req.organizationId,
                attempt_id: attempt.id,
                question_id: q.id
              },
              transaction: t
            });
            if (existingAns) {
              await existingAns.update(
                {
                  selected_option_ids: submitted.selectedOptionIds || [],
                  text_response: submitted.textResponse || null,
                  matching_response: submitted.matchingResponse || null,
                  file_asset_id: submitted.fileAssetId || null,
                  is_correct: isCorrect,
                  points_awarded: awarded
                },
                { transaction: t }
              );
            } else {
              await Answer.create(
                {
                  organization_id: req.organizationId,
                  attempt_id: attempt.id,
                  question_id: q.id,
                  selected_option_ids: submitted.selectedOptionIds || [],
                  text_response: submitted.textResponse || null,
                  matching_response: submitted.matchingResponse || null,
                  file_asset_id: submitted.fileAssetId || null,
                  is_correct: isCorrect,
                  points_awarded: awarded
                },
                { transaction: t }
              );
            }
          }
        }

        const percentage = possible > 0 ? Math.round((earned / possible) * 10000) / 100 : 100;
        const passingScore = Number(attempt.assessment?.passing_score_percent || 70);
        const passed = percentage >= passingScore;

        await attempt.update(
          {
            status: 'graded',
            submitted_at: new Date(),
            graded_at: new Date(),
            score_earned: earned,
            score_possible: possible,
            percentage,
            passed
          },
          { transaction: t }
        );

        const existingGrade = await Grade.findOne({
          where: { organization_id: req.organizationId, attempt_id: attempt.id },
          transaction: t
        });
        if (existingGrade) {
          await existingGrade.update(
            {
              total_score: earned,
              max_score: possible,
              percentage,
              passed
            },
            { transaction: t }
          );
        } else {
          await Grade.create(
            {
              organization_id: req.organizationId,
              attempt_id: attempt.id,
              membership_id: attempt.membership_id,
              course_id: attempt.assessment.course_id,
              total_score: earned,
              max_score: possible,
              percentage,
              passed
            },
            { transaction: t }
          );
        }

        // Recalculate enrollment course completion
        await ProgressService.recalculateEnrollmentCompletion(req.organizationId, attempt.enrollment_id, t);

        return {
          attemptId: attempt.id,
          scoreEarned: earned,
          scorePossible: possible,
          percentage,
          passed
        };
      });

      await auditFromReq(req, 'assessment.submitted', 'assessment_attempt', req.params.attemptId, result);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

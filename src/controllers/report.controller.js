import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import {
  OrganizationMembership,
  Department,
  Course,
  Enrollment,
  Grade,
  Certificate,
  AuditLog,
  User,
  CompletionRecord,
  withTenantContext
} from '../models/index.js';
import { auditFromReq } from '../services/audit.service.js';

export class ReportController {
  static async getDashboard(req, res, next) {
    try {
      const orgId = req.organizationId;

      const data = await withTenantContext(orgId, async (t) => {
        const totalUsers = await OrganizationMembership.count({
          where: { organization_id: orgId, status: 'active' },
          transaction: t
        });
        const activeLearners = await Enrollment.count({
          where: { organization_id: orgId, status: 'active' },
          distinct: true,
          col: 'membership_id',
          transaction: t
        });
        const departmentsCount = await Department.count({
          where: { organization_id: orgId, is_active: true },
          transaction: t
        });
        const totalCourses = await Course.count({
          where: { organization_id: orgId },
          transaction: t
        });
        const publishedCourses = await Course.count({
          where: { organization_id: orgId, status: 'published' },
          transaction: t
        });
        const totalEnrollments = await Enrollment.count({
          where: { organization_id: orgId },
          transaction: t
        });
        const completedEnrollments = await Enrollment.count({
          where: { organization_id: orgId, status: 'completed' },
          transaction: t
        });
        const issuedCertificates = await Certificate.count({
          where: { organization_id: orgId, revoked_at: null },
          transaction: t
        });

        const recentActivity = await AuditLog.findAll({
          where: { organization_id: orgId },
          order: [['created_at', 'DESC']],
          limit: 8,
          transaction: t
        });

        return {
          organizationMetrics: {
            total_users: totalUsers,
            active_learners: activeLearners,
            departments_count: departmentsCount,
            total_courses: totalCourses,
            published_courses: publishedCourses,
            total_enrollments: totalEnrollments,
            completed_enrollments: completedEnrollments,
            issued_certificates: issuedCertificates,
            completion_rate_percent: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
          },
          recentActivities: recentActivity
        };
      });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async exportReport(req, res, next) {
    try {
      const reportType = String(req.query.type || 'enrollments');
      const format = String(req.query.format || 'csv').toLowerCase();

      const rows = await withTenantContext(req.organizationId, async (t) => {
        if (reportType === 'completions' || reportType === 'enrollments') {
          const enrollments = await Enrollment.findAll({
            where: { organization_id: req.organizationId },
            include: [
              {
                model: OrganizationMembership,
                as: 'membership',
                include: [
                  { model: User, as: 'user', attributes: ['full_name', 'email'] },
                  { model: Department, as: 'department', attributes: ['name'] }
                ]
              },
              { model: Course, as: 'course', attributes: ['title'] },
              { model: CompletionRecord, as: 'completion', attributes: ['completion_percent'] }
            ],
            order: [['created_at', 'DESC']],
            limit: 500,
            transaction: t
          });

          return enrollments.map((e) => ({
            learner_name: e.membership?.user?.full_name || '',
            email: e.membership?.user?.email || '',
            department: e.membership?.department?.name || '',
            course: e.course?.title || '',
            status: e.status,
            is_mandatory: e.is_mandatory,
            completion_percent: e.completion?.completion_percent || 0,
            due_date: e.due_date,
            enrolled_at: e.enrolled_at,
            completed_at: e.completed_at
          }));
        }

        if (reportType === 'certificates') {
          const certs = await Certificate.findAll({
            where: { organization_id: req.organizationId },
            order: [['issued_at', 'DESC']],
            limit: 500,
            transaction: t
          });
          return certs.map((c) => ({
            certificate_number: c.certificate_number,
            recipient_name: c.recipient_name,
            course_title: c.course_title,
            issued_at: c.issued_at,
            expires_at: c.expires_at,
            revoked_at: c.revoked_at
          }));
        }

        return [];
      });

      await auditFromReq(req, 'report.exported', 'report', reportType, { format, rowCount: rows.length });

      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, reportType);
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.xlsx"`);
        return res.send(buf);
      }

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.pdf"`);
        doc.pipe(res);
        doc.fontSize(18).text(`${req.organization?.name || 'Enterprise LMS'} — ${reportType.toUpperCase()} REPORT`);
        doc.fontSize(10).fillColor('#64748b').text(`Generated: ${new Date().toISOString()} | Rows: ${rows.length}`);
        doc.moveDown();
        doc.fillColor('#0f172a').fontSize(9);
        for (const row of rows.slice(0, 80)) {
          doc.text(Object.entries(row).map(([k, v]) => `${k}: ${v ?? '-'}`).join(' | '));
          doc.moveDown(0.3);
        }
        doc.end();
        return;
      }

      // Default CSV
      const headers = rows.length ? Object.keys(rows[0]) : ['empty'];
      const csvLines = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
      return res.send(csvLines.join('\n'));
    } catch (err) {
      next(err);
    }
  }
}

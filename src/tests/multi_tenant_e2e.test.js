import crypto from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool, withPlatformContext } from '../db/pool.js';
import { sequelize } from '../db/sequelize.js';
import { runMigrations } from '../../database/scripts/migrate.js';
import { runSeeds } from '../../database/seeds/run_seeds.js';
import { enqueueJob } from '../config/queue.js';

let dbAvailable = false;
try {
  await pool.query('SELECT 1');
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const describeWithDb = dbAvailable ? describe : describe.skip;

describeWithDb('Multi-Tenant SaaS LMS End-to-End Integration & Security Isolation', () => {
  const app = createApp();
  let superToken = '';
  let starterPlanId = '';
  let enterprisePlanId = '';

  let orgA = null;
  let orgB = null;
  let adminAToken = '';
  let adminBToken = '';
  let learnerAToken = '';
  let learnerAMembershipId = '';
  let deptAId = '';
  let courseAId = '';
  let lessonAId = '';
  let assessmentAId = '';
  let enrollmentAId = '';
  let certA = null;

  beforeAll(async () => {
    await runMigrations();
    await runSeeds();

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: process.env.SEED_SUPER_ADMIN_EMAIL || 'saptarsi.mitra@zentelex.com',
      password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin#2026!'
    });
    expect(loginRes.status).toBe(200);
    superToken = loginRes.body.accessToken;

    const plansRes = await request(app).get('/api/v1/platform/plans').set('Authorization', `Bearer ${superToken}`);
    starterPlanId = plansRes.body.data.find((p) => p.code === 'starter').id;
    enterprisePlanId = plansRes.body.data.find((p) => p.code === 'enterprise').id;
  });

  afterAll(async () => {
    await sequelize.close();
    await pool.end();
  });

  it('1-2. Super Admin creates two independent organizations with distinct Tenant Admins & plans', async () => {
    const suffix = Date.now().toString(36);
    const resA = await request(app)
      .post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Tenant Alpha ${suffix}`,
        slug: `alpha-${suffix}`,
        organizationType: 'corporate',
        contactEmail: `contact-a-${suffix}@test.local`,
        planId: starterPlanId,
        customMaxUsers: 3,
        adminEmail: `admin-a-${suffix}@test.local`,
        adminFullName: 'Admin Alpha',
        adminTemporaryPassword: 'Password#123'
      });
    expect(resA.status).toBe(201);
    orgA = resA.body.organization;

    const resB = await request(app)
      .post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Tenant Beta ${suffix}`,
        slug: `beta-${suffix}`,
        organizationType: 'educational',
        contactEmail: `contact-b-${suffix}@test.local`,
        planId: enterprisePlanId,
        adminEmail: `admin-b-${suffix}@test.local`,
        adminFullName: 'Admin Beta',
        adminTemporaryPassword: 'Password#123'
      });
    expect(resB.status).toBe(201);
    orgB = resB.body.organization;

    const loginA = await request(app).post('/api/v1/auth/login').send({
      identifier: `admin-a-${suffix}@test.local`,
      password: 'Password#123'
    });
    adminAToken = loginA.body.accessToken;

    const loginB = await request(app).post('/api/v1/auth/login').send({
      identifier: `admin-b-${suffix}@test.local`,
      password: 'Password#123'
    });
    adminBToken = loginB.body.accessToken;
    expect(adminAToken).toBeTruthy();
    expect(adminBToken).toBeTruthy();
  });

  it('3-5. Creates departments, custom roles, scoped permissions, and enforces user limits', async () => {
    const deptRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Operations', code: 'OPS' });
    expect(deptRes.status).toBe(201);
    deptAId = deptRes.body.data.id;

    // Create custom role in Org A
    const roleRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        name: 'Dept Viewer',
        permissions: [
          { module: 'courses', action: 'view', scope: 'organization', allow: true },
          { module: 'enrollments', action: 'view', scope: 'self', allow: true },
          { module: 'enrollments', action: 'create', scope: 'self', allow: true },
          { module: 'assessments', action: 'view', scope: 'self', allow: true },
          { module: 'progress', action: 'view', scope: 'self', allow: true },
          { module: 'certificates', action: 'view', scope: 'self', allow: true }
        ]
      });
    expect(roleRes.status).toBe(201);
    const customRoleId = roleRes.body.data.id;

    const suffix = Date.now().toString(36);
    const u1 = await request(app)
      .post('/api/v1/users/create')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: `learner-a-${suffix}@test.local`,
        fullName: 'Learner Alpha',
        password: 'Password#123',
        departmentId: deptAId,
        roleIds: [customRoleId]
      });
    expect(u1.status).toBe(201);
    learnerAMembershipId = u1.body.data.membership.id;

    const u2 = await request(app)
      .post('/api/v1/users/create')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: `learner-a2-${suffix}@test.local`,
        fullName: 'Learner Alpha 2',
        password: 'Password#123'
      });
    expect(u2.status).toBe(201);

    // 4th user exceeds customMaxUsers = 3!
    const u4 = await request(app)
      .post('/api/v1/users/create')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: `learner-a4-${suffix}@test.local`,
        fullName: 'Learner Over Quota',
        password: 'Password#123'
      });
    expect(u4.status).toBe(403);
    expect(u4.body.error.code).toBe('QUOTA_EXCEEDED');

    const learnerLogin = await request(app).post('/api/v1/auth/login').send({
      identifier: `learner-a-${suffix}@test.local`,
      password: 'Password#123'
    });
    learnerAToken = learnerLogin.body.accessToken;
  });

  it('6. Blocks cross-tenant API access via X-Organization-Id spoofing and guessed resource IDs', async () => {
    // Admin B attempts to access Org A via X-Organization-Id header
    const spoofRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Organization-Id', orgA.id);
    expect(spoofRes.status).toBe(403);

    // Admin B attempts to read Org A's department by ID
    const deptProbe = await request(app)
      .patch(`/api/v1/departments/${deptAId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Hacked' });
    expect(deptProbe.status).toBe(404);
  });

  it('7. Enforces subscription entitlements separately from RBAC permissions', async () => {
    // Org A is on Starter (certificates: false); even Tenant Admin gets ENTITLEMENT_REQUIRED
    const certBlock = await request(app)
      .get('/api/v1/certificates')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(certBlock.status).toBe(403);
    expect(certBlock.body.error.code).toBe('ENTITLEMENT_REQUIRED');

    // Upgrade Org A to Enterprise
    const upg = await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ planId: enterprisePlanId, billingCycle: 'monthly' });
    expect(upg.status).toBe(200);

    // Certificates now entitled for Admin A
    const certOk = await request(app)
      .get('/api/v1/certificates')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(certOk.status).toBe(200);

    // Learner A STILL cannot create courses just because org upgraded subscription!
    const rbacStillBlocked = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${learnerAToken}`)
      .send({ title: 'Unauthorized Course' });
    expect(rbacStillBlocked.status).toBe(403);
  });

  it('9-12. Full Course -> Enrollment -> Assessment -> Progress -> PDF/QR Certificate lifecycle', async () => {
    // Create & publish course
    const cRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Multi-Tenant Compliance 101', summary: 'Core course' });
    expect(cRes.status).toBe(201);
    courseAId = cRes.body.data.id;

    const mRes = await request(app)
      .post(`/api/v1/courses/${courseAId}/modules`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Module 1' });
    const lRes = await request(app)
      .post(`/api/v1/courses/${courseAId}/modules/${mRes.body.data.id}/lessons`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ title: 'Lesson 1', contentType: 'text', bodyMarkdown: 'Read carefully', isRequired: true });
    lessonAId = lRes.body.data.id;

    const pubRes = await request(app)
      .post(`/api/v1/courses/${courseAId}/transition`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ action: 'publish' });
    expect(pubRes.body.data.status).toBe('published');

    // Create assessment + question
    const aRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ courseId: courseAId, title: 'Final Check', passingScorePercent: 50 });
    assessmentAId = aRes.body.data.id;

    const qRes = await request(app)
      .post(`/api/v1/assessments/${assessmentAId}/questions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        questionType: 'mcq_single',
        prompt: 'Is tenant isolation mandatory?',
        points: 10,
        options: [
          { optionText: 'Yes', isCorrect: true },
          { optionText: 'No', isCorrect: false }
        ]
      });
    const correctOptId = qRes.body.data.options.find((o) => o.is_correct).id;

    // Enroll learner
    const enrRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ courseId: courseAId, membershipIds: [learnerAMembershipId] });
    expect(enrRes.status).toBe(201);
    enrollmentAId = enrRes.body.data[0].id;

    // Take & auto-grade assessment
    const startRes = await request(app)
      .post('/api/v1/assessment-attempts/start')
      .set('Authorization', `Bearer ${learnerAToken}`)
      .send({ assessmentId: assessmentAId, enrollmentId: enrollmentAId });
    expect(startRes.status).toBe(201);

    const subRes = await request(app)
      .post(`/api/v1/assessment-attempts/${startRes.body.data.attempt.id}/submit`)
      .set('Authorization', `Bearer ${learnerAToken}`)
      .send({ answers: [{ questionId: qRes.body.data.id, selectedOptionIds: [correctOptId] }] });
    expect(subRes.status).toBe(200);
    expect(Number(subRes.body.data.percentage)).toBe(100);
    expect(subRes.body.data.passed).toBe(true);

    // Complete required lesson -> triggers 100% completion & auto certificate!
    const progRes = await request(app)
      .post('/api/v1/progress/lesson')
      .set('Authorization', `Bearer ${learnerAToken}`)
      .send({ enrollmentId: enrollmentAId, lessonId: lessonAId, isCompleted: true, timeSpentSeconds: 120 });
    expect(progRes.status).toBe(200);
    expect(Number(progRes.body.data.completion.completion_percent)).toBe(100);
    expect(progRes.body.data.completion.is_course_completed).toBe(true);

    const certsRes = await request(app)
      .get('/api/v1/certificates')
      .set('Authorization', `Bearer ${learnerAToken}`);
    expect(certsRes.body.data.length).toBeGreaterThanOrEqual(1);
    certA = certsRes.body.data[0];

    // Verify public QR verification endpoint
    const verRes = await request(app).get(`/api/v1/certificates/verify/${certA.verification_code}`);
    expect(verRes.status).toBe(200);
    expect(verRes.body.valid).toBe(true);

    // Download PDF certificate
    const pdfRes = await request(app)
      .get(`/api/v1/certificates/${certA.id}/pdf`)
      .set('Authorization', `Bearer ${learnerAToken}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
  });

  it('13-16. Payment webhook idempotency, secure CSV exports, audit logs, and background job deduplication', async () => {
    const evtId = `evt_${crypto.randomBytes(6).toString('hex')}`;
    const payload = {
      eventId: evtId,
      eventType: 'invoice.paid',
      organizationId: orgA.id,
      amountCents: 59900,
      currency: 'USD'
    };

    const w1 = await request(app).post('/api/v1/billing/webhooks/stripe').send(payload);
    expect(w1.status).toBe(200);
    expect(w1.body.idempotent).toBe(false);

    const w2 = await request(app).post('/api/v1/billing/webhooks/stripe').send(payload);
    expect(w2.status).toBe(200);
    expect(w2.body.idempotent).toBe(true);

    const csvRes = await request(app)
      .get('/api/v1/reports/export?type=enrollments&format=csv')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');

    const auditRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);

    // Background job deduplication via idempotencyKey
    const idemp = `job_${Date.now()}`;
    const j1 = await enqueueJob({ organizationId: orgA.id, jobType: 'test_job', idempotencyKey: idemp });
    const j2 = await enqueueJob({ organizationId: orgA.id, jobType: 'test_job', idempotencyKey: idemp });
    expect(j1.deduplicated).toBe(false);
    expect(j2.deduplicated).toBe(true);
    expect(j1.job.id).toBe(j2.job.id);
  });
});

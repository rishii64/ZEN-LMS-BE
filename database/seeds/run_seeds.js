import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../..');
const rootDir = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(backendDir, '.env') });

const { Pool } = pg;

const PERMISSION_MODULES = [
  ['organizations', ['view', 'edit', 'manage']],
  ['users', ['view', 'create', 'edit', 'delete', 'export', 'manage']],
  ['roles', ['view', 'create', 'edit', 'delete', 'manage']],
  ['departments', ['view', 'create', 'edit', 'delete', 'manage']],
  ['courses', ['view', 'create', 'edit', 'delete', 'approve', 'publish', 'export', 'manage']],
  ['learning_paths', ['view', 'create', 'edit', 'delete', 'publish', 'manage']],
  ['enrollments', ['view', 'create', 'edit', 'delete', 'approve', 'export', 'manage']],
  ['assessments', ['view', 'create', 'edit', 'delete', 'approve', 'export', 'manage']],
  ['progress', ['view', 'export', 'manage']],
  ['certificates', ['view', 'create', 'delete', 'export', 'manage']],
  ['compliance', ['view', 'create', 'edit', 'approve', 'export', 'manage']],
  ['reports', ['view', 'create', 'export', 'manage']],
  ['billing', ['view', 'manage']],
  ['workflows', ['view', 'manage']],
  ['integrations', ['view', 'manage']],
  ['audit_logs', ['view', 'export']]
];

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Core LMS for small teams and growing training programs.',
    tierOrder: 1,
    monthlyPriceCents: 4900,
    annualPriceCents: 49000,
    maxUsers: 50,
    maxCourses: 25,
    maxStorageBytes: 5 * 1024 * 1024 * 1024,
    maxCustomRoles: 10,
    modules: {
      certificates: false,
      compliance: false,
      reports: true,
      workflows: false,
      integrations: false,
      sso: false,
      custom_branding: false,
      live_sessions: true,
      gamification: false,
      analytics_advanced: false
    }
  },
  {
    code: 'professional',
    name: 'Professional',
    description: 'Advanced branding, certificates, workflow customization, and rich reporting.',
    tierOrder: 2,
    monthlyPriceCents: 19900,
    annualPriceCents: 199000,
    maxUsers: 500,
    maxCourses: 200,
    maxStorageBytes: 50 * 1024 * 1024 * 1024,
    maxCustomRoles: 25,
    modules: {
      certificates: true,
      compliance: true,
      reports: true,
      workflows: true,
      integrations: true,
      sso: false,
      custom_branding: true,
      live_sessions: true,
      gamification: true,
      analytics_advanced: true
    }
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Large workforce hierarchies, SSO, API webhooks, compliance & advanced analytics.',
    tierOrder: 3,
    monthlyPriceCents: 59900,
    annualPriceCents: 599000,
    maxUsers: 10000,
    maxCourses: 2000,
    maxStorageBytes: 500 * 1024 * 1024 * 1024,
    maxCustomRoles: 100,
    modules: {
      certificates: true,
      compliance: true,
      reports: true,
      workflows: true,
      integrations: true,
      sso: true,
      custom_branding: true,
      live_sessions: true,
      gamification: true,
      analytics_advanced: true
    }
  },
  {
    code: 'government_private',
    name: 'Government / Private Deployment',
    description: 'Dedicated hosting options, strict retention controls, advanced identity & auditability.',
    tierOrder: 4,
    monthlyPriceCents: 149900,
    annualPriceCents: 1499000,
    maxUsers: 100000,
    maxCourses: 10000,
    maxStorageBytes: 2000 * 1024 * 1024 * 1024,
    maxCustomRoles: 500,
    modules: {
      certificates: true,
      compliance: true,
      reports: true,
      workflows: true,
      integrations: true,
      sso: true,
      custom_branding: true,
      live_sessions: true,
      gamification: true,
      analytics_advanced: true
    }
  }
];

const ROLE_TEMPLATES = [
  {
    name: 'Learner',
    slug: 'learner',
    description: 'Standard learner access to assigned courses, assessments, and own certificates.',
    perms: [
      ['courses', 'view', 'organization'],
      ['learning_paths', 'view', 'organization'],
      ['enrollments', 'view', 'self'],
      ['enrollments', 'create', 'self'],
      ['assessments', 'view', 'self'],
      ['progress', 'view', 'self'],
      ['certificates', 'view', 'self']
    ]
  },
  {
    name: 'Instructor / Trainer',
    slug: 'instructor',
    description: 'Create and manage courses, grade assessments, and run live sessions.',
    perms: [
      ['courses', 'view', 'organization'],
      ['courses', 'create', 'organization'],
      ['courses', 'edit', 'course'],
      ['learning_paths', 'view', 'organization'],
      ['enrollments', 'view', 'course'],
      ['assessments', 'view', 'organization'],
      ['assessments', 'create', 'organization'],
      ['assessments', 'edit', 'course'],
      ['assessments', 'approve', 'course'],
      ['progress', 'view', 'course'],
      ['certificates', 'view', 'course']
    ]
  },
  {
    name: 'Department Manager',
    slug: 'department-manager',
    description: 'Monitor team members, approve enrollments, and run department reports.',
    perms: [
      ['departments', 'view', 'department'],
      ['users', 'view', 'department'],
      ['courses', 'view', 'organization'],
      ['enrollments', 'view', 'department'],
      ['enrollments', 'create', 'department'],
      ['enrollments', 'approve', 'department'],
      ['progress', 'view', 'department'],
      ['reports', 'view', 'department'],
      ['reports', 'export', 'department']
    ]
  },
  {
    name: 'Compliance Officer / Auditor',
    slug: 'compliance-auditor',
    description: 'Monitor mandatory training, policy acknowledgements, certificates, and audit exports.',
    perms: [
      ['courses', 'view', 'organization'],
      ['enrollments', 'view', 'organization'],
      ['progress', 'view', 'organization'],
      ['certificates', 'view', 'organization'],
      ['compliance', 'view', 'organization'],
      ['compliance', 'create', 'organization'],
      ['compliance', 'approve', 'organization'],
      ['reports', 'view', 'organization'],
      ['reports', 'export', 'organization'],
      ['audit_logs', 'view', 'organization'],
      ['audit_logs', 'export', 'organization']
    ]
  },
  {
    name: 'Course Coordinator / Reviewer',
    slug: 'content-reviewer',
    description: 'Review, approve, and publish courses and manage training schedules.',
    perms: [
      ['courses', 'view', 'organization'],
      ['courses', 'edit', 'organization'],
      ['courses', 'approve', 'organization'],
      ['courses', 'publish', 'organization'],
      ['learning_paths', 'view', 'organization'],
      ['learning_paths', 'create', 'organization'],
      ['enrollments', 'view', 'organization'],
      ['enrollments', 'create', 'organization']
    ]
  }
];

export async function runSeeds(connectionString = process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");

    // 1. Seed Global Permissions Catalog
    const permIdMap = {};
    for (const [mod, actions] of PERMISSION_MODULES) {
      for (const action of actions) {
        const res = await client.query(
          `INSERT INTO permissions (module, action, description)
           VALUES ($1,$2,$3)
           ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description
           RETURNING id`,
          [mod, action, `${action} access for ${mod}`]
        );
        permIdMap[`${mod}:${action}`] = res.rows[0].id;
      }
    }

    // 2. Seed Subscription Plans & Features
    const planIds = {};
    for (const p of PLANS) {
      const pRes = await client.query(
        `INSERT INTO subscription_plans
         (code, name, description, tier_order, monthly_price_cents, annual_price_cents, max_users, max_courses, max_storage_bytes, max_custom_roles)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, monthly_price_cents = EXCLUDED.monthly_price_cents, max_custom_roles = EXCLUDED.max_custom_roles
         RETURNING id`,
        [p.code, p.name, p.description, p.tierOrder, p.monthlyPriceCents, p.annualPriceCents, p.maxUsers, p.maxCourses, p.maxStorageBytes, p.maxCustomRoles]
      );
      planIds[p.code] = pRes.rows[0].id;
      for (const [mod, enabled] of Object.entries(p.modules)) {
        await client.query(
          `INSERT INTO plan_features (plan_id, module_key, is_enabled) VALUES ($1,$2,$3)
           ON CONFLICT (plan_id, module_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled`,
          [pRes.rows[0].id, mod, enabled]
        );
      }
    }

    // 3. Seed Global Role Templates
    for (const tpl of ROLE_TEMPLATES) {
      const existing = await client.query(`SELECT id FROM roles WHERE organization_id IS NULL AND slug = $1`, [tpl.slug]);
      let roleId = existing.rows[0]?.id;
      if (!roleId) {
        const rRes = await client.query(
          `INSERT INTO roles (organization_id, name, slug, description, is_system_template)
           VALUES (NULL,$1,$2,$3,TRUE) RETURNING id`,
          [tpl.name, tpl.slug, tpl.description]
        );
        roleId = rRes.rows[0].id;
      }
      for (const [mod, action, scope] of tpl.perms) {
        const permId = permIdMap[`${mod}:${action}`];
        if (permId) {
          await client.query(
            `INSERT INTO role_permissions (role_id, organization_id, permission_id, scope, allow)
             VALUES ($1,NULL,$2,$3,TRUE) ON CONFLICT DO NOTHING`,
            [roleId, permId, scope]
          );
        }
      }
    }

    // 4. Seed Platform Super Admin
    const superEmail = (process.env.SEED_SUPER_ADMIN_EMAIL || 'saptarsi.mitra@zentelex.com').trim();
    const superPass = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin#2026!';
    const superHash = await bcrypt.hash(superPass, 10);
    const superRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_platform_admin, platform_role, email_verified_at, is_active)
       VALUES ($1,$2,'Platform Super Admin',TRUE,'super_admin',NOW(),TRUE)
       ON CONFLICT (email) DO UPDATE SET is_platform_admin = TRUE, platform_role = 'super_admin', password_hash = EXCLUDED.password_hash, is_active = TRUE
       RETURNING id`,
      [superEmail, superHash]
    );
    const superUserId = superRes.rows[0].id;

    // 5. Global Platform Settings & Announcement
    await client.query(
      `INSERT INTO platform_settings (key, value, description, updated_by)
       VALUES ('platform_name', '"AstraLearn Enterprise SaaS"'::jsonb, 'Global SaaS brand name', $1)
       ON CONFLICT (key) DO NOTHING`,
      [superUserId]
    );
    const annCheck = await client.query(`SELECT COUNT(*)::int AS cnt FROM platform_announcements`);
    if (annCheck.rows[0].cnt === 0) {
      await client.query(
        `INSERT INTO platform_announcements (title, body, severity, created_by)
         VALUES ('Welcome to AstraLearn Multi-Tenant LMS', 'PostgreSQL RLS tenant isolation, dynamic RBAC, and automated PDF/QR certificates are active.', 'info', $1)`,
        [superUserId]
      );
    }

    // 6. Seed 2 Demo Tenants (Corporate + Educational) if not already seeded
    const existingOrg = await client.query(`SELECT id FROM organizations WHERE slug = 'acme-corp'`);
    if (existingOrg.rows.length === 0) {
      const demoPassHash = await bcrypt.hash('DemoPass#2026!', 10);

      // Tenant 1: Acme Global Corp (Enterprise Plan, Employee terminology)
      const acmeOrg = (await client.query(
        `INSERT INTO organizations (slug, name, legal_name, industry, organization_type, contact_email, country, status, approved_at, approved_by)
         VALUES ('acme-corp', 'Acme Global Corp', 'Acme Global Corporation Inc.', 'Technology', 'corporate', 'admin@acme-corp.local', 'United States', 'active', NOW(), $1)
         RETURNING id`,
        [superUserId]
      )).rows[0];

      await client.query(
        `INSERT INTO organization_settings (organization_id, primary_color, secondary_color, terminology)
         VALUES ($1, '#2563eb', '#0f172a', '{"learner":"Employee","learners":"Employees","instructor":"Trainer","instructors":"Trainers","department":"Department","departments":"Departments","course":"Course","courses":"Courses","branch":"Office","branches":"Offices"}'::jsonb)`,
        [acmeOrg.id]
      );
      await client.query(
        `INSERT INTO organization_subscriptions (organization_id, plan_id, status, billing_cycle, unit_price_cents)
         VALUES ($1,$2,'active','annual',599000)`,
        [acmeOrg.id, planIds.enterprise]
      );
      for (const [mod, enabled] of Object.entries(PLANS.find((p) => p.code === 'enterprise').modules)) {
        await client.query(
          `INSERT INTO organization_modules (organization_id, module_key, is_enabled, source) VALUES ($1,$2,$3,'plan')`,
          [acmeOrg.id, mod, enabled]
        );
      }

      // Copy role templates to Acme
      const acmeRoles = {};
      for (const tpl of ROLE_TEMPLATES) {
        const r = (await client.query(
          `INSERT INTO roles (organization_id, name, slug, description) VALUES ($1,$2,$3,$4) RETURNING id`,
          [acmeOrg.id, tpl.name, tpl.slug, tpl.description]
        )).rows[0];
        acmeRoles[tpl.slug] = r.id;
        for (const [mod, action, scope] of tpl.perms) {
          const permId = permIdMap[`${mod}:${action}`];
          if (permId) {
            await client.query(
              `INSERT INTO role_permissions (role_id, organization_id, permission_id, scope, allow) VALUES ($1,$2,$3,$4,TRUE)`,
              [r.id, acmeOrg.id, permId, scope]
            );
          }
        }
      }

      const engDept = (await client.query(
        `INSERT INTO departments (organization_id, name, code, description) VALUES ($1,'Engineering','ENG','Software & Infrastructure Engineering') RETURNING id`,
        [acmeOrg.id]
      )).rows[0];
      const secDept = (await client.query(
        `INSERT INTO departments (organization_id, name, code, description) VALUES ($1,'Security & Compliance','SEC','InfoSec and Risk') RETURNING id`,
        [acmeOrg.id]
      )).rows[0];

      // Acme Users: Admin, Instructor, Manager, Learner
      const acmeAdminU = (await client.query(`INSERT INTO users (email, password_hash, full_name, email_verified_at) VALUES ('admin@acme-corp.local',$1,'Alice Vance (Acme Admin)',NOW()) RETURNING id`, [demoPassHash])).rows[0];
      const acmeAdminM = (await client.query(`INSERT INTO organization_memberships (organization_id, user_id, employee_code, job_title, status, is_org_admin, primary_department_id) VALUES ($1,$2,'ACM-001','VP of Learning','active',TRUE,$3) RETURNING id`, [acmeOrg.id, acmeAdminU.id, engDept.id])).rows[0];

      const acmeInstU = (await client.query(`INSERT INTO users (email, password_hash, full_name, email_verified_at) VALUES ('trainer@acme-corp.local',$1,'Marcus Chen (Trainer)',NOW()) RETURNING id`, [demoPassHash])).rows[0];
      const acmeInstM = (await client.query(`INSERT INTO organization_memberships (organization_id, user_id, employee_code, job_title, status, primary_department_id) VALUES ($1,$2,'ACM-002','Principal Security Trainer','active',$3) RETURNING id`, [acmeOrg.id, acmeInstU.id, secDept.id])).rows[0];
      await client.query(`INSERT INTO membership_roles (organization_id, membership_id, role_id) VALUES ($1,$2,$3)`, [acmeOrg.id, acmeInstM.id, acmeRoles.instructor]);

      const acmeLearnerU = (await client.query(`INSERT INTO users (email, password_hash, full_name, email_verified_at) VALUES ('learner@acme-corp.local',$1,'Priya Nair (Employee)',NOW()) RETURNING id`, [demoPassHash])).rows[0];
      const acmeLearnerM = (await client.query(`INSERT INTO organization_memberships (organization_id, user_id, employee_code, job_title, status, primary_department_id) VALUES ($1,$2,'ACM-003','Staff Engineer','active',$3) RETURNING id`, [acmeOrg.id, acmeLearnerU.id, engDept.id])).rows[0];
      await client.query(`INSERT INTO membership_roles (organization_id, membership_id, role_id) VALUES ($1,$2,$3)`, [acmeOrg.id, acmeLearnerM.id, acmeRoles.learner]);

      // Sample Course + Modules + Lessons + Assessment + Enrollment
      const cat = (await client.query(`INSERT INTO categories (organization_id, name, slug) VALUES ($1,'Information Security','infosec') RETURNING id`, [acmeOrg.id])).rows[0];
      const course = (await client.query(
        `INSERT INTO courses (organization_id, category_id, code, title, slug, summary, description, delivery_mode, status, is_mandatory, estimated_minutes, created_by_membership_id, published_at)
         VALUES ($1,$2,'SEC-101','Enterprise Security & OWASP Foundations','enterprise-security-owasp','Mandatory annual security training for all engineering employees.','Covers OWASP ASVS, multi-tenant data isolation, and secure coding standards.','self_paced','published',TRUE,45,$3,NOW())
         RETURNING id`,
        [acmeOrg.id, cat.id, acmeInstM.id]
      )).rows[0];
      const ver = (await client.query(`INSERT INTO course_versions (organization_id, course_id, version_number, title, status, is_current, published_at) VALUES ($1,$2,1,'Enterprise Security & OWASP Foundations','published',TRUE,NOW()) RETURNING id`, [acmeOrg.id, course.id])).rows[0];
      const mod1 = (await client.query(`INSERT INTO modules (organization_id, course_id, course_version_id, title, sort_order) VALUES ($1,$2,$3,'Module 1: Multi-Tenant Security Basics',1) RETURNING id`, [acmeOrg.id, course.id, ver.id])).rows[0];
      await client.query(`INSERT INTO lessons (organization_id, course_id, module_id, title, content_type, body_markdown, duration_minutes, is_required, sort_order) VALUES ($1,$2,$3,'1.1 Tenant Context & Least Privilege','text','# Tenant Isolation\nAlways derive organization_id from verified server memberships, never trust client-supplied identifiers.',15,TRUE,1)`, [acmeOrg.id, course.id, mod1.id]);
      await client.query(`INSERT INTO lessons (organization_id, course_id, module_id, title, content_type, body_markdown, duration_minutes, is_required, sort_order) VALUES ($1,$2,$3,'1.2 OWASP ASVS Checklist','text','# OWASP ASVS\nValidate all inputs, enforce RBAC on backend endpoints, and emit immutable audit events.',20,TRUE,2)`, [acmeOrg.id, course.id, mod1.id]);

      const assess = (await client.query(`INSERT INTO assessments (organization_id, course_id, module_id, title, passing_score_percent) VALUES ($1,$2,$3,'Security Foundations Quiz',70) RETURNING id`, [acmeOrg.id, course.id, mod1.id])).rows[0];
      const q1 = (await client.query(`INSERT INTO questions (organization_id, assessment_id, question_type, prompt, points, sort_order) VALUES ($1,$2,'mcq_single','Where must the active organization_id be resolved from on backend API calls?',10,1) RETURNING id`, [acmeOrg.id, assess.id])).rows[0];
      await client.query(`INSERT INTO question_options (organization_id, question_id, option_text, is_correct, sort_order) VALUES ($1,$2,'Authenticated user verified membership in DB',TRUE,1),($1,$2,'Unvalidated JSON body field',FALSE,2)`, [acmeOrg.id, q1.id]);

      await client.query(`INSERT INTO enrollments (organization_id, course_id, membership_id, assigned_by_membership_id, assignment_source, is_mandatory, status) VALUES ($1,$2,$3,$4,'mandatory',TRUE,'active')`, [acmeOrg.id, course.id, acmeLearnerM.id, acmeAdminM.id]);
      await client.query(`INSERT INTO certificate_templates (organization_id, name, title_text, signature_name, signature_title, validity_days, is_default) VALUES ($1,'Acme Corporate Certificate','Certificate of Compliance','Alice Vance','VP of Learning',365,TRUE)`, [acmeOrg.id]);
      await client.query(`INSERT INTO policies (organization_id, title, version, content, is_mandatory, renewal_days) VALUES ($1,'Acceptable Use & Data Security Policy','2.1','All employees must protect tenant and customer data using approved authentication and encryption controls.',TRUE,365)`, [acmeOrg.id]);

      // Tenant 2: Horizon University (Professional Plan, Student terminology)
      const eduOrg = (await client.query(
        `INSERT INTO organizations (slug, name, legal_name, industry, organization_type, contact_email, country, status, approved_at, approved_by)
         VALUES ('horizon-edu', 'Horizon University', 'Horizon State University', 'Higher Education', 'educational', 'dean@horizon.edu.local', 'United Kingdom', 'active', NOW(), $1)
         RETURNING id`,
        [superUserId]
      )).rows[0];
      await client.query(
        `INSERT INTO organization_settings (organization_id, primary_color, secondary_color, terminology)
         VALUES ($1, '#059669', '#064e3b', '{"learner":"Student","learners":"Students","instructor":"Professor","instructors":"Professors","department":"Faculty","departments":"Faculties","course":"Module","courses":"Modules","branch":"Campus","branches":"Campuses"}'::jsonb)`,
        [eduOrg.id]
      );
      await client.query(
        `INSERT INTO organization_subscriptions (organization_id, plan_id, status, billing_cycle, unit_price_cents)
         VALUES ($1,$2,'active','monthly',19900)`,
        [eduOrg.id, planIds.professional]
      );
      for (const [mod, enabled] of Object.entries(PLANS.find((p) => p.code === 'professional').modules)) {
        await client.query(
          `INSERT INTO organization_modules (organization_id, module_key, is_enabled, source) VALUES ($1,$2,$3,'plan')`,
          [eduOrg.id, mod, enabled]
        );
      }

      const csDept = (await client.query(`INSERT INTO departments (organization_id, name, code) VALUES ($1,'Faculty of Computer Science','CS') RETURNING id`, [eduOrg.id])).rows[0];
      const eduAdminU = (await client.query(`INSERT INTO users (email, password_hash, full_name, email_verified_at) VALUES ('dean@horizon.edu.local',$1,'Dr. Evelyn Hart (Dean)',NOW()) RETURNING id`, [demoPassHash])).rows[0];
      await client.query(`INSERT INTO organization_memberships (organization_id, user_id, employee_code, job_title, status, is_org_admin, primary_department_id) VALUES ($1,$2,'HZ-001','Dean of Online Learning','active',TRUE,$3)`, [eduOrg.id, eduAdminU.id, csDept.id]);
      await client.query(`INSERT INTO courses (organization_id, code, title, slug, summary, status) VALUES ($1,'CS-401','Distributed Systems Architecture','distributed-systems-401','Graduate seminar on consensus, replication, and fault tolerance.','published')`, [eduOrg.id]);
    }

    await client.query('COMMIT');
    console.log('[seed] Database seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()
) {
  runSeeds().catch(() => process.exit(1));
}

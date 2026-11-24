import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ZenLMS Multi-Tenant Seeding...');

  // 1. Create Super Admin
  const superPassword = await bcrypt.hash('Admin123!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@zenlms.io' },
    update: {},
    create: {
      email: 'superadmin@zenlms.io',
      passwordHash: superPassword,
      firstName: 'Elena',
      lastName: 'Rostova',
      isSuperAdmin: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    }
  });

  // 2. TENANT 1: Higher Education (Apex University)
  const apexOrg = await prisma.organization.upsert({
    where: { slug: 'apex-university' },
    update: {},
    create: {
      name: 'Apex Institute of Technology',
      slug: 'apex-university',
      sector: 'EDUCATION',
      logoUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=120',
      primaryColor: '#4f46e5', // Indigo
      secondaryColor: '#3730a3',
      timezone: 'America/New_York',
      settings: {
        create: {
          terminology: JSON.stringify({
            learner: 'Student',
            learners: 'Students',
            instructor: 'Professor',
            instructors: 'Faculty',
            course: 'Course',
            courses: 'Courses',
            department: 'Academic Faculty',
            departments: 'Academic Faculties',
            credential: 'Academic Certificate'
          }),
          allowSelfEnrollment: true,
          emailNotifications: true
        }
      },
      certTemplates: {
        create: {
          name: 'Apex Degree Certificate Template',
          title: 'Certificate of Academic Excellence',
          signerName: 'Dr. Arthur Vance',
          signatureTitle: 'Dean of Computer Sciences'
        }
      }
    }
  });

  // Apex Departments
  const csDept = await prisma.department.create({
    data: {
      organizationId: apexOrg.id,
      name: 'Department of Computer Science',
      code: 'CS-FAC',
      description: 'Undergraduate and Graduate Computing Programs'
    }
  });

  const mathDept = await prisma.department.create({
    data: {
      organizationId: apexOrg.id,
      name: 'Department of Mathematics & Statistics',
      code: 'MATH-FAC',
      description: 'Applied Mathematics and Statistical Sciences'
    }
  });

  // Apex Users
  const userPassword = await bcrypt.hash('Apex123!', 10);

  const apexAdmin = await prisma.user.upsert({
    where: { email: 'admin@apex.edu' },
    update: {},
    create: {
      email: 'admin@apex.edu',
      passwordHash: userPassword,
      firstName: 'Marcus',
      lastName: 'Aurelius',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    }
  });

  const apexProfessor = await prisma.user.upsert({
    where: { email: 'prof.sharma@apex.edu' },
    update: {},
    create: {
      email: 'prof.sharma@apex.edu',
      passwordHash: userPassword,
      firstName: 'Aarav',
      lastName: 'Sharma',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
    }
  });

  const apexStudent = await prisma.user.upsert({
    where: { email: 'student.alex@apex.edu' },
    update: {},
    create: {
      email: 'student.alex@apex.edu',
      passwordHash: userPassword,
      firstName: 'Alex',
      lastName: 'Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
    }
  });

  // Apex Memberships
  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: apexOrg.id, userId: apexAdmin.id } },
    update: {},
    create: {
      organizationId: apexOrg.id,
      userId: apexAdmin.id,
      role: 'ORG_ADMIN',
      title: 'Registrar & Systems Admin'
    }
  });

  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: apexOrg.id, userId: apexProfessor.id } },
    update: {},
    create: {
      organizationId: apexOrg.id,
      userId: apexProfessor.id,
      departmentId: csDept.id,
      role: 'INSTRUCTOR',
      title: 'Associate Professor of Computer Science'
    }
  });

  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: apexOrg.id, userId: apexStudent.id } },
    update: {},
    create: {
      organizationId: apexOrg.id,
      userId: apexStudent.id,
      departmentId: csDept.id,
      role: 'LEARNER',
      title: 'Junior Undergrad'
    }
  });

  // Apex Course: Full-Stack Web Architecture
  const apexCourse = await prisma.course.upsert({
    where: { organizationId_slug: { organizationId: apexOrg.id, slug: 'cs301-web-architecture' } },
    update: {},
    create: {
      organizationId: apexOrg.id,
      authorId: apexProfessor.id,
      title: 'CS301: Modern Web Architecture & Scalable Systems',
      slug: 'cs301-web-architecture',
      description: 'Master full-stack distributed system design, relational data modeling, multi-tenancy, and high-throughput API architectures.',
      category: 'Computer Science',
      level: 'INTERMEDIATE',
      estimatedHours: 8,
      status: 'PUBLISHED',
      coverImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600'
    }
  });

  // Apex Modules & Lessons
  const apexModule1 = await prisma.module.create({
    data: {
      courseId: apexCourse.id,
      title: 'Module 1: Foundations of Multi-Tenant Architectures',
      description: 'Examining data isolation topologies, shared tables vs separate databases, and security boundaries.',
      orderIndex: 0
    }
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      moduleId: apexModule1.id,
      title: '1.1 Multi-Tenant Data Isolation Paradigms',
      contentType: 'MARKDOWN',
      durationMinutes: 15,
      orderIndex: 0,
      contentText: `### Multi-Tenancy Architecture Overview

Multi-tenancy is an architectural model in which a single instance of a software application serves multiple customers (tenants). Each tenant has dedicated share of the instance including its data, configuration, user management, and individual functionality.

#### 3 Core Tenancy Models:
1. **Database-per-Tenant**: Highest isolation, high infrastructure overhead.
2. **Schema-per-Tenant**: Good balance, database-specific schema management.
3. **Shared Database, Shared Schema**: High scalability, cost-effective, enforces strict tenant ID scoping on all queries and constraints.

ZenLMS implements **Shared Database with Mandatory Foreign Key Scoping** coupled with relational composite constraints and application-level RBAC guards.`
    }
  });

  const lesson2 = await prisma.lesson.create({
    data: {
      moduleId: apexModule1.id,
      title: '1.2 Video Lecture: Scalable Relational Systems',
      contentType: 'VIDEO',
      contentUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      durationMinutes: 20,
      orderIndex: 1,
      contentText: 'Watch this comprehensive breakdown of indexing strategies for multi-tenant relational schemas.'
    }
  });

  const apexModule2 = await prisma.module.create({
    data: {
      courseId: apexCourse.id,
      title: 'Module 2: Verification & Knowledge Assessment',
      description: 'Evaluate your comprehension of multi-tenancy and API design.',
      orderIndex: 1
    }
  });

  const quizLesson = await prisma.lesson.create({
    data: {
      moduleId: apexModule2.id,
      title: '2.1 Comprehensive Architecture Quiz',
      contentType: 'QUIZ',
      durationMinutes: 15,
      orderIndex: 0,
      contentText: 'Demonstrate mastery of multi-tenant isolation, composite constraints, and RBAC enforcement.'
    }
  });

  // Quiz Assessment
  const assessment = await prisma.assessment.create({
    data: {
      lessonId: quizLesson.id,
      title: 'Multi-Tenant Architecture Exam',
      description: 'Score 70% or higher to fulfill credential requirements.',
      passingScore: 70,
      maxAttempts: 3
    }
  });

  const q1 = await prisma.question.create({
    data: {
      assessmentId: assessment.id,
      text: 'Which multi-tenancy model delivers the highest resource sharing and cost efficiency?',
      type: 'SINGLE_CHOICE',
      points: 1,
      orderIndex: 0,
      explanation: 'Shared database with shared schema pools all database compute and storage across tenants.'
    }
  });

  await prisma.questionOption.createMany({
    data: [
      { questionId: q1.id, text: 'Separate Database per Tenant', isCorrect: false, orderIndex: 0 },
      { questionId: q1.id, text: 'Shared Database with Shared Schema (Discriminator Column)', isCorrect: true, orderIndex: 1 },
      { questionId: q1.id, text: 'Separate Physical Server per Tenant', isCorrect: false, orderIndex: 2 }
    ]
  });

  const q2 = await prisma.question.create({
    data: {
      assessmentId: assessment.id,
      text: 'Why should tenant permissions be validated strictly on the backend rather than solely hiding UI buttons?',
      type: 'SINGLE_CHOICE',
      points: 1,
      orderIndex: 1,
      explanation: 'Frontend controls can be bypassed by direct API calls; the server must validate authorization.'
    }
  });

  await prisma.questionOption.createMany({
    data: [
      { questionId: q2.id, text: 'Because users can bypass UI controls and send raw HTTP requests directly', isCorrect: true, orderIndex: 0 },
      { questionId: q2.id, text: 'Only to reduce frontend bundle sizes', isCorrect: false, orderIndex: 1 },
      { questionId: q2.id, text: 'It is optional and not strictly necessary', isCorrect: false, orderIndex: 2 }
    ]
  });

  // 3. TENANT 2: Corporate L&D (Nexus Global Corp)
  const corpOrg = await prisma.organization.upsert({
    where: { slug: 'nexus-corp' },
    update: {},
    create: {
      name: 'Nexus Global Enterprises',
      slug: 'nexus-corp',
      sector: 'CORPORATE',
      logoUrl: 'https://images.unsplash.com/photo-1554774853-719586f82d77?w=120',
      primaryColor: '#059669', // Emerald Green
      secondaryColor: '#047857',
      timezone: 'Europe/London',
      settings: {
        create: {
          terminology: JSON.stringify({
            learner: 'Employee',
            learners: 'Employees',
            instructor: 'Corporate Trainer',
            instructors: 'L&D Trainers',
            course: 'Compliance Program',
            courses: 'Compliance Programs',
            department: 'Business Unit / Division',
            departments: 'Business Divisions',
            credential: 'Compliance Certificate'
          }),
          allowSelfEnrollment: true,
          emailNotifications: true
        }
      },
      certTemplates: {
        create: {
          name: 'Nexus ISO & Security Certificate',
          title: 'Certificate of Corporate Compliance',
          signerName: 'Victoria Hastings',
          signatureTitle: 'Chief Compliance & People Officer'
        }
      }
    }
  });

  // Nexus Departments
  const engDiv = await prisma.department.create({
    data: {
      organizationId: corpOrg.id,
      name: 'Engineering & Cloud Security',
      code: 'ENG-SEC'
    }
  });

  const hrDiv = await prisma.department.create({
    data: {
      organizationId: corpOrg.id,
      name: 'People Operations & Human Resources',
      code: 'HR-OPS'
    }
  });

  // Nexus Users
  const corpPassword = await bcrypt.hash('Nexus123!', 10);

  const corpAdmin = await prisma.user.upsert({
    where: { email: 'hr@nexuscorp.com' },
    update: {},
    create: {
      email: 'hr@nexuscorp.com',
      passwordHash: corpPassword,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
    }
  });

  const corpTrainer = await prisma.user.upsert({
    where: { email: 'trainer.david@nexuscorp.com' },
    update: {},
    create: {
      email: 'trainer.david@nexuscorp.com',
      passwordHash: corpPassword,
      firstName: 'David',
      lastName: 'Kim',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'
    }
  });

  const corpEmployee = await prisma.user.upsert({
    where: { email: 'employee.john@nexuscorp.com' },
    update: {},
    create: {
      email: 'employee.john@nexuscorp.com',
      passwordHash: corpPassword,
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    }
  });

  // Nexus Memberships
  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: corpOrg.id, userId: corpAdmin.id } },
    update: {},
    create: {
      organizationId: corpOrg.id,
      userId: corpAdmin.id,
      departmentId: hrDiv.id,
      role: 'ORG_ADMIN',
      title: 'VP of Global Learning & Development'
    }
  });

  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: corpOrg.id, userId: corpTrainer.id } },
    update: {},
    create: {
      organizationId: corpOrg.id,
      userId: corpTrainer.id,
      departmentId: engDiv.id,
      role: 'INSTRUCTOR',
      title: 'Lead Security Evangelist'
    }
  });

  await prisma.userMembership.upsert({
    where: { organizationId_userId: { organizationId: corpOrg.id, userId: corpEmployee.id } },
    update: {},
    create: {
      organizationId: corpOrg.id,
      userId: corpEmployee.id,
      departmentId: engDiv.id,
      role: 'LEARNER',
      title: 'Senior Software Engineer'
    }
  });

  // Nexus Course: Information Security & Data Privacy 2026
  const corpCourse = await prisma.course.upsert({
    where: { organizationId_slug: { organizationId: corpOrg.id, slug: 'infosec-2026-compliance' } },
    update: {},
    create: {
      organizationId: corpOrg.id,
      authorId: corpTrainer.id,
      title: '2026 Information Security & ISO/IEC 27001 Compliance',
      slug: 'infosec-2026-compliance',
      description: 'Mandatory annual corporate compliance training covering phishing defenses, data classification, and clean desk security protocols.',
      category: 'Compliance',
      level: 'BEGINNER',
      estimatedHours: 1,
      isMandatory: true,
      status: 'PUBLISHED',
      coverImageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600'
    }
  });

  const corpModule = await prisma.module.create({
    data: {
      courseId: corpCourse.id,
      title: 'Section 1: Data Protection & Threat Awareness',
      description: 'Essential cyber security hygiene for all enterprise personnel.',
      orderIndex: 0
    }
  });

  const corpLesson = await prisma.lesson.create({
    data: {
      moduleId: corpModule.id,
      title: '1.1 Recognizing Social Engineering & Spear Phishing',
      contentType: 'MARKDOWN',
      durationMinutes: 10,
      orderIndex: 0,
      contentText: `### Corporate Security Guidelines 2026

1. **Verify Sender Addresses**: Always examine sender domain headers before opening attachments.
2. **Password Security & MFA**: Never reuse internal passwords across public services. Multi-factor authentication is mandatory.
3. **Data Loss Prevention**: Confidential customer and financial data must never be copied to personal storage or public AI tools.`
    }
  });

  // Create an active enrollment for the Corporate Employee with a Verifiable Certificate
  const completedEnrollment = await prisma.enrollment.create({
    data: {
      organizationId: corpOrg.id,
      courseId: corpCourse.id,
      userId: corpEmployee.id,
      status: 'COMPLETED',
      progressPct: 100.0,
      enrolledAt: new Date(Date.now() - 7 * 86400000),
      startedAt: new Date(Date.now() - 6 * 86400000),
      completedAt: new Date(Date.now() - 1 * 86400000)
    }
  });

  await prisma.lessonProgress.create({
    data: {
      enrollmentId: completedEnrollment.id,
      lessonId: corpLesson.id,
      isCompleted: true,
      completedAt: new Date(Date.now() - 1 * 86400000)
    }
  });

  // Create Pre-Issued Certificate with known verificationCode
  const demoCert = await prisma.certificate.create({
    data: {
      certificateNumber: 'ZEN-2026-NEXUS-001',
      organizationId: corpOrg.id,
      courseId: corpCourse.id,
      userId: corpEmployee.id,
      enrollmentId: completedEnrollment.id,
      verificationCode: 'nexus-cert-demo-2026',
      issueDate: new Date(),
      recipientName: 'John Doe',
      courseTitle: corpCourse.title,
      organizationName: corpOrg.name
    }
  });

  console.log('✅ Seeding completed successfully!');
  console.log('✨ Demo Credentials:');
  console.log('   - Super Admin: superadmin@zenlms.io / Admin123!');
  console.log('   - Apex Univ Admin: admin@apex.edu / Apex123!');
  console.log('   - Apex Professor: prof.sharma@apex.edu / Apex123!');
  console.log('   - Apex Student: student.alex@apex.edu / Apex123!');
  console.log('   - Nexus Corp Admin: hr@nexuscorp.com / Nexus123!');
  console.log('   - Nexus Trainer: trainer.david@nexuscorp.com / Nexus123!');
  console.log('   - Nexus Employee: employee.john@nexuscorp.com / Nexus123!');
  console.log(`   - Demo Verifiable Certificate Code: ${demoCert.verificationCode}`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

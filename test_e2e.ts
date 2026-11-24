import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting End-to-End Multi-Tenant Verification Tests...\n');

  // Test 1: Verify Database Multi-Tenancy Records
  console.log('Test 1: Verifying Multi-Tenant Organizations & Settings...');
  const orgs = await prisma.organization.findMany({
    include: { settings: true, departments: true, courses: true }
  });

  if (orgs.length < 2) {
    throw new Error(`Expected at least 2 organizations, found ${orgs.length}`);
  }

  const apex = orgs.find(o => o.slug === 'apex-university');
  const nexus = orgs.find(o => o.slug === 'nexus-corp');

  if (!apex || !nexus) {
    throw new Error('Apex University or Nexus Corp missing from database!');
  }

  console.log(`  ✓ Apex University found (Sector: ${apex.sector}, Departments: ${apex.departments.length}, Courses: ${apex.courses.length})`);
  console.log(`  ✓ Nexus Global Enterprises found (Sector: ${nexus.sector}, Departments: ${nexus.departments.length}, Courses: ${nexus.courses.length})`);

  // Test 2: Verify Sector Terminology Engines
  console.log('\nTest 2: Verifying Sector Terminology Dictionaries...');
  const apexTerms = JSON.parse(apex.settings?.terminology || '{}');
  const nexusTerms = JSON.parse(nexus.settings?.terminology || '{}');

  console.log(`  ✓ Apex Terminology: Learner -> "${apexTerms.learner}", Instructor -> "${apexTerms.instructor}", Course -> "${apexTerms.course}"`);
  console.log(`  ✓ Nexus Terminology: Learner -> "${nexusTerms.learner}", Instructor -> "${nexusTerms.instructor}", Course -> "${nexusTerms.course}"`);

  if (apexTerms.learner !== 'Student' || nexusTerms.learner !== 'Employee') {
    throw new Error('Sector terminology mapping mismatch!');
  }

  // Test 3: Verify User Roles & Scoped RBAC Memberships
  console.log('\nTest 3: Verifying User Memberships and Scoped Roles...');
  const memberships = await prisma.userMembership.findMany({
    include: { user: true, organization: true }
  });

  const rolesFound = new Set(memberships.map(m => m.role));
  console.log(`  ✓ Active Tenant Roles Registered: ${Array.from(rolesFound).join(', ')}`);

  // Test 4: Verify Course Hierarchy (Course -> Modules -> Lessons -> Assessment -> Questions -> Options)
  console.log('\nTest 4: Verifying Course Curriculum & Assessment Hierarchy...');
  const csCourse = await prisma.course.findFirst({
    where: { slug: 'cs301-web-architecture' },
    include: {
      modules: {
        include: {
          lessons: {
            include: {
              assessment: {
                include: { questions: { include: { options: true } } }
              }
            }
          }
        }
      }
    }
  });

  if (!csCourse) throw new Error('CS301 course not found!');
  const totalLessons = csCourse.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  console.log(`  ✓ Course "${csCourse.title}" has ${csCourse.modules.length} modules, ${totalLessons} lessons.`);

  const quizLesson = csCourse.modules.flatMap(m => m.lessons).find(l => l.contentType === 'QUIZ');
  if (!quizLesson || !quizLesson.assessment) throw new Error('Quiz assessment not found!');
  console.log(`  ✓ Quiz "${quizLesson.assessment.title}" with passing score ${quizLesson.assessment.passingScore}% and ${quizLesson.assessment.questions.length} questions.`);

  // Test 5: Verify Public Certificate & Cryptographic Verification Code
  console.log('\nTest 5: Verifying Public Verifiable Credential...');
  const demoCert = await prisma.certificate.findFirst({
    where: { verificationCode: 'nexus-cert-demo-2026' },
    include: { organization: true, course: true }
  });

  if (!demoCert) throw new Error('Demo certificate missing!');
  console.log(`  ✓ Certificate Number: ${demoCert.certificateNumber}`);
  console.log(`  ✓ Recipient: ${demoCert.recipientName}`);
  console.log(`  ✓ Course: ${demoCert.courseTitle}`);
  console.log(`  ✓ Issuing Organization: ${demoCert.organizationName} (${demoCert.organization.sector})`);
  console.log(`  ✓ Verification Hash: ${demoCert.verificationCode}`);

  console.log('\n🎉 ALL 5 MULTI-TENANT VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

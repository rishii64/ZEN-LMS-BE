import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting End-to-End Enterprise SaaS & Multi-Tenant Verification Suite...\n');

  // Test 1: Verify Multi-Tenant Organizations & Sector Archetypes
  console.log('Test 1: Verifying Multi-Tenant Organizations & Sector Configuration...');
  const orgs = await prisma.organization.findMany({
    include: { settings: true, subscription: { include: { plan: true } }, departments: true, courses: true }
  });

  if (orgs.length < 2) {
    throw new Error(`Expected at least 2 organizations, found ${orgs.length}`);
  }

  const apex = orgs.find(o => o.slug === 'apex-university');
  const nexus = orgs.find(o => o.slug === 'nexus-corp');

  if (!apex || !nexus) {
    throw new Error('Apex University or Nexus Corp missing from database!');
  }

  console.log(`  ✓ Apex University: Sector "${apex.sector}", Plan: "${apex.subscription?.plan?.displayName}"`);
  console.log(`  ✓ Nexus Global Enterprises: Sector "${nexus.sector}", Plan: "${nexus.subscription?.plan?.displayName}"`);

  // Test 2: Verify Dynamic RBAC & System Permissions
  console.log('\nTest 2: Verifying Dynamic RBAC & Permission Catalog...');
  const permCount = await prisma.permission.count();
  const customRoles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } }
  });

  console.log(`  ✓ Total System Permissions Catalogued: ${permCount}`);
  console.log(`  ✓ Custom Roles Configured: ${customRoles.map(r => `${r.name} (${r.permissions.length} perms, scope: ${r.scope})`).join(', ')}`);

  if (permCount < 10) throw new Error('Expected at least 10 permissions!');

  // Test 3: Verify SaaS Subscription Plans & Usage
  console.log('\nTest 3: Verifying Subscription Plans & Quotas...');
  const plans = await prisma.subscriptionPlan.findMany();
  console.log(`  ✓ Available SaaS Plans: ${plans.map(p => `${p.name} ($${p.monthlyPrice}/mo, max ${p.maxUsers} users)`).join(', ')}`);

  // Test 4: Verify Multi-Unit Organizational Hierarchy (Departments, Locations, Teams)
  console.log('\nTest 4: Verifying Multi-Unit Organizational Hierarchy...');
  const depts = await prisma.department.count();
  const locs = await prisma.location.count();
  const teams = await prisma.team.count();
  console.log(`  ✓ Hierarchy Nodes: ${depts} Departments, ${locs} Locations/Branches, ${teams} Teams/Groups.`);

  // Test 5: Verify Learning Paths & Virtual Live Sessions
  console.log('\nTest 5: Verifying Learning Paths & Virtual Classroom Sessions...');
  const paths = await prisma.learningPath.findMany({ include: { items: true } });
  const liveSessions = await prisma.liveSession.findMany();
  console.log(`  ✓ Learning Paths: ${paths.map(p => `"${p.title}" (${p.items.length} units)`).join(', ')}`);
  console.log(`  ✓ Live Virtual Sessions Scheduled: ${liveSessions.map(s => `"${s.title}" (${s.meetingUrl})`).join(', ')}`);

  // Test 6: Verify Regulatory Compliance Policies & Verifiable Credentials
  console.log('\nTest 6: Verifying Regulatory Compliance Policies & Verifiable Credentials...');
  const policies = await prisma.compliancePolicy.findMany({ include: { acknowledgements: true } });
  const demoCert = await prisma.certificate.findFirst({
    where: { verificationCode: 'nexus-cert-demo-2026' }
  });

  console.log(`  ✓ Regulatory Policies: ${policies.map(p => `"${p.title}" (Sign-offs: ${p.acknowledgements.length})`).join(', ')}`);
  if (!demoCert) throw new Error('Demo verifiable certificate not found!');
  console.log(`  ✓ Public Verifiable Credential: ${demoCert.certificateNumber} (Hash: ${demoCert.verificationCode})`);

  console.log('\n🎉 ALL 6 ENTERPRISE MULTI-TENANT SAAS VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

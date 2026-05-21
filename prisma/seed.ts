/**
 * 시드 v1 — Week 1 Day 5
 *
 * 목표 (mindbridge-dev-plan.md §2 Week 1 / 기획안 §5.5):
 *   가상 기업 1, Department 3, Category 8,
 *   직원 50, 상담사 10 (+ Counselor 프로필·자격증·가용성·카테고리 매핑),
 *   전문의 3, HR 2, 운영자 1, Subscription 1, InviteCode 5,
 *   Consent (모든 User 필수 2종), AuditLog 샘플 5건.
 *
 * 멱등성: 시드 시작 시 모든 테이블 wipe → 재생성.
 *   (Day 5 시점에는 시드 외 사용자 데이터가 없으므로 안전한 패턴)
 *
 * 환경변수: ANONYMIZATION_SALT 필수.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type UserRole } from "@prisma/client";

import { anonymizeId } from "../lib/anon";

const prisma = new PrismaClient();
const SALT = process.env.ANONYMIZATION_SALT;
const SEED_PASSWORD = "testpass1234";

if (!SALT) {
  console.error("[seed] ANONYMIZATION_SALT 누락 — .env / .env.local 확인");
  process.exit(1);
}

// ============================================================
// 마스터 데이터
// ============================================================

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const COMPANY_NAME = "MindBridge 데모기업";
const COMPANY_DOMAIN = "mindbridge.test";

const DEPARTMENTS = ["마케팅팀", "개발팀", "인사팀"] as const;

const CATEGORIES: Array<{ slug: string; name: string; description: string }> = [
  { slug: "depression", name: "우울", description: "지속적인 우울감·무기력" },
  { slug: "anxiety", name: "불안", description: "범불안·공황·강박" },
  { slug: "burnout", name: "번아웃", description: "직무 소진·만성 피로" },
  { slug: "sleep", name: "수면", description: "불면·수면 리듬 장애" },
  { slug: "relationships", name: "직장 관계", description: "동료·상사 갈등, 위계 스트레스" },
  { slug: "family", name: "가족", description: "가족 갈등·양육 스트레스" },
  { slug: "grief", name: "상실·애도", description: "이별·사별·상실감" },
  { slug: "addiction", name: "중독·의존", description: "알코올·디지털 의존" },
];

// ============================================================
// 계정 명세
// ============================================================

interface UserSpec {
  email: string;
  role: UserRole;
  nickname: string;
  departmentIndex?: number; // 0..2, EMPLOYEE 만 사용
}

const FIXED_USERS: UserSpec[] = [
  // Day 2 호환: 5롤 1명씩 (이메일 그대로 유지)
  { email: "employee@mindbridge.test", role: "EMPLOYEE", nickname: "직원1", departmentIndex: 0 },
  { email: "counselor@mindbridge.test", role: "COUNSELOR", nickname: "상담사-A" },
  { email: "doctor@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-A" },
  { email: "hr@mindbridge.test", role: "HR", nickname: "HR-A" },
  { email: "admin@mindbridge.test", role: "ADMIN", nickname: "운영자1" },
];

function buildEmployees(): UserSpec[] {
  const list: UserSpec[] = [];
  // employee@mindbridge.test 포함하여 50명. fixed 1명 + 추가 49명.
  for (let i = 2; i <= 50; i++) {
    list.push({
      email: `emp${String(i).padStart(3, "0")}@mindbridge.test`,
      role: "EMPLOYEE",
      nickname: `직원-${String(i).padStart(3, "0")}`,
      departmentIndex: (i - 1) % DEPARTMENTS.length,
    });
  }
  return list;
}

function buildCounselors(): Array<
  UserSpec & {
    tier: "JUNIOR" | "SENIOR" | "SUPERVISOR";
    yearsOfPractice: number;
    bio: string;
    rating: number;
    ratingCount: number;
    licenseType: "CLINICAL_PSYCHOLOGIST_1" | "COUNSELING_PSYCHOLOGIST_1" | "MENTAL_HEALTH_NURSE";
    categorySlugs: string[];
  }
> {
  // counselor@mindbridge.test 가 첫 번째. 추가 9명.
  return [
    { email: "counselor@mindbridge.test", role: "COUNSELOR", nickname: "상담사-A", tier: "SUPERVISOR", yearsOfPractice: 12, bio: "직장인 우울·번아웃 전문, 10년차+", rating: 4.8, ratingCount: 48, licenseType: "CLINICAL_PSYCHOLOGIST_1", categorySlugs: ["depression", "burnout"] },
    { email: "counselor02@mindbridge.test", role: "COUNSELOR", nickname: "상담사-B", tier: "SENIOR", yearsOfPractice: 8, bio: "불안·공황 전문 임상심리사", rating: 4.7, ratingCount: 36, licenseType: "CLINICAL_PSYCHOLOGIST_1", categorySlugs: ["anxiety", "sleep"] },
    { email: "counselor03@mindbridge.test", role: "COUNSELOR", nickname: "상담사-C", tier: "SENIOR", yearsOfPractice: 7, bio: "직장 관계 갈등 상담 전문", rating: 4.6, ratingCount: 29, licenseType: "COUNSELING_PSYCHOLOGIST_1", categorySlugs: ["relationships", "burnout"] },
    { email: "counselor04@mindbridge.test", role: "COUNSELOR", nickname: "상담사-D", tier: "SENIOR", yearsOfPractice: 6, bio: "수면장애·만성 불안", rating: 4.5, ratingCount: 22, licenseType: "MENTAL_HEALTH_NURSE", categorySlugs: ["sleep", "anxiety"] },
    { email: "counselor05@mindbridge.test", role: "COUNSELOR", nickname: "상담사-E", tier: "JUNIOR", yearsOfPractice: 4, bio: "가족·관계 상담", rating: 4.4, ratingCount: 18, licenseType: "COUNSELING_PSYCHOLOGIST_1", categorySlugs: ["family", "relationships"] },
    { email: "counselor06@mindbridge.test", role: "COUNSELOR", nickname: "상담사-F", tier: "JUNIOR", yearsOfPractice: 3, bio: "우울·애도 상담", rating: 4.3, ratingCount: 14, licenseType: "COUNSELING_PSYCHOLOGIST_1", categorySlugs: ["depression", "grief"] },
    { email: "counselor07@mindbridge.test", role: "COUNSELOR", nickname: "상담사-G", tier: "JUNIOR", yearsOfPractice: 3, bio: "번아웃·일중독", rating: 4.2, ratingCount: 11, licenseType: "CLINICAL_PSYCHOLOGIST_1", categorySlugs: ["burnout", "addiction"] },
    { email: "counselor08@mindbridge.test", role: "COUNSELOR", nickname: "상담사-H", tier: "JUNIOR", yearsOfPractice: 3, bio: "디지털 의존·불안", rating: 4.1, ratingCount: 9, licenseType: "COUNSELING_PSYCHOLOGIST_1", categorySlugs: ["addiction", "anxiety"] },
    { email: "counselor09@mindbridge.test", role: "COUNSELOR", nickname: "상담사-I", tier: "JUNIOR", yearsOfPractice: 4, bio: "가족·우울", rating: 4.0, ratingCount: 12, licenseType: "MENTAL_HEALTH_NURSE", categorySlugs: ["family", "depression"] },
    { email: "counselor10@mindbridge.test", role: "COUNSELOR", nickname: "상담사-J", tier: "JUNIOR", yearsOfPractice: 5, bio: "관계·번아웃·수면", rating: 4.5, ratingCount: 19, licenseType: "COUNSELING_PSYCHOLOGIST_1", categorySlugs: ["relationships", "burnout", "sleep"] },
  ];
}

const PSYCHIATRISTS: UserSpec[] = [
  { email: "doctor@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-A" },
  { email: "doctor02@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-B" },
  { email: "doctor03@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-C" },
];

const HRS: UserSpec[] = [
  { email: "hr@mindbridge.test", role: "HR", nickname: "HR-A" },
  { email: "hr02@mindbridge.test", role: "HR", nickname: "HR-B" },
];

const ADMINS: UserSpec[] = [
  { email: "admin@mindbridge.test", role: "ADMIN", nickname: "운영자1" },
];

// ============================================================
// Wipe + Reseed
// ============================================================

async function wipe() {
  // Cascade 가 처리하지 않는 관계 순서대로 (외래키 충돌 회피)
  // W3 → W2 → W1 역순.
  await prisma.notificationOutbox.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.sessionMessage.deleteMany();
  await prisma.session.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.matchRecommendation.deleteMany();
  await prisma.assessmentResponse.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.inviteCode.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.counselorCategory.deleteMany();
  await prisma.counselorAvailability.deleteMany();
  await prisma.counselorCredential.deleteMany();
  await prisma.counselor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();
  await prisma.category.deleteMany();
}

async function seedCategories() {
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    await prisma.category.create({
      data: { slug: c.slug, name: c.name, description: c.description, sortOrder: i, active: true },
    });
  }
}

async function seedCompanyAndDepartments(): Promise<{ companyId: string; departmentIds: string[] }> {
  const company = await prisma.company.create({
    data: {
      id: COMPANY_ID,
      name: COMPANY_NAME,
      status: "ACTIVE",
      domain: COMPANY_DOMAIN,
      contactEmail: "ops@mindbridge.test",
    },
  });
  const departmentIds: string[] = [];
  for (const name of DEPARTMENTS) {
    const d = await prisma.department.create({
      data: { companyId: company.id, name },
    });
    departmentIds.push(d.id);
  }
  return { companyId: company.id, departmentIds };
}

async function createUser(
  spec: UserSpec,
  ctx: { companyId: string; departmentIds: string[]; passwordHash: string },
): Promise<{ id: string }> {
  const id = randomUUID();
  const anonymizedId = anonymizeId(id, SALT!);
  const departmentId =
    spec.role === "EMPLOYEE" && spec.departmentIndex !== undefined
      ? ctx.departmentIds[spec.departmentIndex]
      : null;
  await prisma.user.create({
    data: {
      id,
      email: spec.email,
      passwordHash: ctx.passwordHash,
      role: spec.role,
      status: "ACTIVE",
      companyId: ctx.companyId,
      departmentId,
      nickname: spec.nickname,
      anonymizedId,
      emailVerifiedAt: new Date(),
    },
  });
  return { id };
}

async function seedCounselorProfile(
  userId: string,
  counselor: ReturnType<typeof buildCounselors>[number],
  categoryIdBySlug: Record<string, string>,
  adminUserId: string,
) {
  const now = new Date();
  const approvedAt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const profile = await prisma.counselor.create({
    data: {
      userId,
      tier: counselor.tier,
      bio: counselor.bio,
      yearsOfPractice: counselor.yearsOfPractice,
      rating: counselor.rating,
      ratingCount: counselor.ratingCount,
      approvedAt,
      approvedById: adminUserId,
    },
  });

  await prisma.counselorCredential.create({
    data: {
      counselorId: profile.id,
      licenseType: counselor.licenseType,
      licenseNumber: `LIC-${profile.id.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000 * counselor.yearsOfPractice),
      status: "VERIFIED",
      verifiedAt: approvedAt,
      verifiedById: adminUserId,
    },
  });

  // 평일(월~금) 9~18시 가용 (recurring=true 단순 표현, dayOfWeek 1~5 5건)
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.counselorAvailability.create({
      data: {
        counselorId: profile.id,
        startsAt: new Date(Date.UTC(2026, 0, 5 + (dow - 1), 0, 0)), // 임시 기준일. 실제 매칭은 dayOfWeek + recurring 사용
        endsAt: new Date(Date.UTC(2026, 0, 5 + (dow - 1), 9, 0)),
        recurring: true,
        dayOfWeek: dow,
      },
    });
  }

  for (const slug of counselor.categorySlugs) {
    const categoryId = categoryIdBySlug[slug];
    if (!categoryId) continue;
    await prisma.counselorCategory.create({
      data: { counselorId: profile.id, categoryId },
    });
  }
}

async function seedConsents(userIds: string[]) {
  const version = "2026-05-19-v1";
  const data = userIds.flatMap((userId) => [
    { userId, type: "SERVICE" as const, version },
    { userId, type: "SENSITIVE_DATA" as const, version },
  ]);
  await prisma.consent.createMany({ data });
}

async function seedSubscription(companyId: string) {
  const now = new Date();
  await prisma.subscription.create({
    data: {
      companyId,
      plan: "STANDARD",
      status: "ACTIVE",
      seatCount: 50,
      pricePerSeat: 12000,
      startedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000),
      manualPaidAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      notes: "Day 5 시드 — 데모용 STANDARD 12개월",
    },
  });
}

async function seedInviteCodes(companyId: string, issuedById: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 5; i++) {
    await prisma.inviteCode.create({
      data: {
        code: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
        companyId,
        issuedById,
        expiresAt,
      },
    });
  }
}

async function seedAuditLogSamples(adminId: string, employeeId: string) {
  const baseTs = Date.now();
  await prisma.auditLog.createMany({
    data: [
      { actorId: adminId, action: "READ_CLINICAL_NOTE", resourceType: "ClinicalNote", resourceId: "sample-note-1", metadata: { reason: "감사 사유 입력" }, timestamp: new Date(baseTs - 5 * 3600 * 1000) },
      { actorId: employeeId, action: "PERMISSION_DENIED", resourceType: "AuditLog", resourceId: "n/a", metadata: { policy: { action: "read", subject: "AuditLog" } }, timestamp: new Date(baseTs - 4 * 3600 * 1000) },
      { actorId: adminId, action: "SUSPEND_COUNSELOR", resourceType: "Counselor", resourceId: "sample-counselor-1", metadata: { reason: "테스트 데이터" }, timestamp: new Date(baseTs - 3 * 3600 * 1000) },
      { actorId: null, action: "SYSTEM_CRON_ANONYMIZE", resourceType: "User", resourceId: "sample-user-1", metadata: { script: "anon-cron" }, timestamp: new Date(baseTs - 2 * 3600 * 1000) },
      { actorId: adminId, action: "INVITE_REVOKED", resourceType: "InviteCode", resourceId: "sample-invite-1", metadata: { reason: "잘못 발송" }, timestamp: new Date(baseTs - 1 * 3600 * 1000) },
    ],
  });
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("[seed] v1 시작");
  console.log("[seed] wipe…");
  await wipe();

  console.log("[seed] categories…");
  await seedCategories();
  const allCats = await prisma.category.findMany();
  const categoryIdBySlug: Record<string, string> = Object.fromEntries(
    allCats.map((c) => [c.slug, c.id]),
  );

  console.log("[seed] company + departments…");
  const { companyId, departmentIds } = await seedCompanyAndDepartments();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const ctx = { companyId, departmentIds, passwordHash };

  console.log("[seed] admin…");
  const adminUser = await createUser(ADMINS[0], ctx);

  console.log("[seed] HR…");
  const hrUsers: { id: string }[] = [];
  for (const spec of HRS) hrUsers.push(await createUser(spec, ctx));

  console.log("[seed] psychiatrists…");
  for (const spec of PSYCHIATRISTS) await createUser(spec, ctx);

  console.log("[seed] counselors…");
  const counselorSpecs = buildCounselors();
  for (const c of counselorSpecs) {
    const { id } = await createUser({ email: c.email, role: c.role, nickname: c.nickname }, ctx);
    await seedCounselorProfile(id, c, categoryIdBySlug, adminUser.id);
  }

  console.log("[seed] employees (fixed + 49)…");
  const employees: { id: string }[] = [];
  employees.push(await createUser(FIXED_USERS[0], ctx)); // employee@mindbridge.test
  for (const spec of buildEmployees()) {
    employees.push(await createUser(spec, ctx));
  }

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  console.log(`[seed] consents (${allUsers.length} users × 2)…`);
  await seedConsents(allUsers.map((u) => u.id));

  console.log("[seed] subscription…");
  await seedSubscription(companyId);

  console.log("[seed] invite codes…");
  await seedInviteCodes(companyId, hrUsers[0].id);

  console.log("[seed] audit log samples…");
  await seedAuditLogSamples(adminUser.id, employees[0].id);

  // 최종 카운트
  const counts = await Promise.all([
    prisma.company.count(),
    prisma.department.count(),
    prisma.category.count(),
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.user.count({ where: { role: "COUNSELOR" } }),
    prisma.user.count({ where: { role: "PSYCHIATRIST" } }),
    prisma.user.count({ where: { role: "HR" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.counselor.count(),
    prisma.counselorCredential.count(),
    prisma.counselorAvailability.count(),
    prisma.counselorCategory.count(),
    prisma.subscription.count(),
    prisma.inviteCode.count(),
    prisma.consent.count(),
    prisma.auditLog.count(),
  ]);
  const [
    company,
    department,
    category,
    employee,
    counselor,
    psychiatrist,
    hr,
    admin,
    counselorProfile,
    credential,
    availability,
    counselorCategory,
    subscription,
    invite,
    consent,
    audit,
  ] = counts;

  console.log("\n[seed] 완료. 비밀번호: testpass1234 (전 계정 공통)\n");
  console.log("=== 시드 카운트 ===");
  console.log(`  Company:          ${company}`);
  console.log(`  Department:       ${department}`);
  console.log(`  Category:         ${category}`);
  console.log(`  EMPLOYEE:         ${employee}`);
  console.log(`  COUNSELOR:        ${counselor}`);
  console.log(`  PSYCHIATRIST:     ${psychiatrist}`);
  console.log(`  HR:               ${hr}`);
  console.log(`  ADMIN:            ${admin}`);
  console.log(`  Counselor 프로필: ${counselorProfile}`);
  console.log(`  Credential:       ${credential}`);
  console.log(`  Availability:     ${availability}`);
  console.log(`  CounselorCat:     ${counselorCategory}`);
  console.log(`  Subscription:     ${subscription}`);
  console.log(`  InviteCode:       ${invite}`);
  console.log(`  Consent:          ${consent}`);
  console.log(`  AuditLog:         ${audit}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

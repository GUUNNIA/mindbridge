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
import { hash } from "@node-rs/bcrypt";
import { PrismaClient, type UserRole } from "@prisma/client";

import { anonymizeId } from "../lib/anon";
import { encryptField } from "../lib/crypto/field";

/**
 * encryptField 는 { ciphertext, encKeyVersion } 객체 반환.
 * 시드의 ClinicalNote/SessionMessage 컬럼은 String 타입이라 ciphertext 만 꺼내 저장.
 * encKeyVersion 컬럼은 모델 default(1) 가 처리.
 */
function enc(plaintext: string): string {
  const result = encryptField(plaintext);
  return result.ciphertext ?? "";
}

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
  /**
   * D25: 핵심 5롤 계정만 고정 UUID 지정.
   * 시드 재실행 시 user.id 가 바뀌지 않아 NextAuth JWT 세션이 stale 되지 않음
   * (이전 D24 발견 — wipe 후 stale JWT 로 server action 호출 시 외래키 위반).
   */
  id?: string;
}

// 핵심 5롤 고정 UUID. company id 와 동일 ...000001 시리즈로 정렬.
const FIXED_USER_IDS = {
  employee: "00000000-0000-0000-0000-000000000010",
  counselor: "00000000-0000-0000-0000-000000000020",
  psychiatrist: "00000000-0000-0000-0000-000000000030",
  hr: "00000000-0000-0000-0000-000000000040",
  admin: "00000000-0000-0000-0000-000000000050",
} as const;

const FIXED_USERS: UserSpec[] = [
  // Day 2 호환: 5롤 1명씩 (이메일 그대로 유지). D25: 고정 UUID 부여.
  { id: FIXED_USER_IDS.employee, email: "employee@mindbridge.test", role: "EMPLOYEE", nickname: "직원1", departmentIndex: 0 },
  { id: FIXED_USER_IDS.counselor, email: "counselor@mindbridge.test", role: "COUNSELOR", nickname: "상담사-A" },
  { id: FIXED_USER_IDS.psychiatrist, email: "doctor@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-A" },
  { id: FIXED_USER_IDS.hr, email: "hr@mindbridge.test", role: "HR", nickname: "HR-A" },
  { id: FIXED_USER_IDS.admin, email: "admin@mindbridge.test", role: "ADMIN", nickname: "운영자1" },
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
  { id: FIXED_USER_IDS.psychiatrist, email: "doctor@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-A" },
  { email: "doctor02@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-B" },
  { email: "doctor03@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의-C" },
];

const HRS: UserSpec[] = [
  { id: FIXED_USER_IDS.hr, email: "hr@mindbridge.test", role: "HR", nickname: "HR-A" },
  { email: "hr02@mindbridge.test", role: "HR", nickname: "HR-B" },
];

const ADMINS: UserSpec[] = [
  { id: FIXED_USER_IDS.admin, email: "admin@mindbridge.test", role: "ADMIN", nickname: "운영자1" },
];

// ============================================================
// Wipe + Reseed
// ============================================================

async function wipe() {
  // Cascade 가 처리하지 않는 관계 순서대로 (외래키 충돌 회피)
  // W3 → W2 → W1 역순.
  //
  // 주의: D22 발견 — W3 신설 모델(RiskFlag·Escalation·Feedback) 의 User 외래키는
  // onDelete 미지정 (RESTRICT). 반드시 User 삭제 이전에 wipe 해야 함.
  await prisma.feedback.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.riskFlag.deleteMany();
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
  const id = spec.id ?? randomUUID();
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

/**
 * STATISTICS (선택 동의) 보강 — Day 22.
 * 모집단 정의: 회사 소속 EMPLOYEE 만. 약 60% 가 동의 (BR-7 동의자 ≥10 충족 +
 * 미동의자 잔존으로 BR-12 모집단 제외 가드 검증).
 * 고정 시드: 직원 user.id 정렬 후 인덱스 % 5 ≠ 0 인 직원에게 부여 (재시드 안정성).
 */
async function seedStatisticsConsents(employeeUserIds: string[]) {
  const version = "2026-05-19-v1";
  const sorted = [...employeeUserIds].sort();
  const data = sorted
    .filter((_, idx) => idx % 5 !== 0) // 50명 중 40명 동의 (인덱스 0·5·10·... 10명 미동의)
    .map((userId) => ({ userId, type: "STATISTICS" as const, version }));
  if (data.length > 0) {
    await prisma.consent.createMany({ data });
  }
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

/**
 * Day 23 — 약식 자가진단 시드.
 *
 * 목적: HR 대시보드 차트(D23) 가 시각적으로 의미를 가지도록 STATISTICS 동의자
 * 30 명에게 최근 5 개월 분산 자가진단 ~50건. 카테고리·심각도 분포 다양.
 *
 * 분포:
 *   - 카테고리: depression / anxiety / burnout 우선 + sleep / relationships 보조
 *   - 심각도: MILD 35% / MODERATE 35% / MODERATELY_SEVERE 20% / SEVERE 10%
 *   - 시점: 최근 5 개월에 분산 (월별 ~10건). 시드는 결정론적 — 같은 인덱스 → 같은 시점.
 *
 * 본 시드는 V1 P0 화면 검증용. D25 시드 v2 가 들어오면 통째 대체 가능.
 */
async function seedAssessments(
  statsConsenterUserIds: string[],
  categoryIdBySlug: Record<string, string>,
) {
  if (statsConsenterUserIds.length === 0) return;

  const targets = [...statsConsenterUserIds].sort().slice(0, 30); // 동의자 40명 중 앞 30명
  const now = new Date();

  // 분배 정책 (D23 초기 분배의 modulo 충돌 fix):
  //   - monthsAgo 와 categorySlug 를 독립 변수로. 같은 modulo 인덱스 사용 금지 (같은 modulo
  //     쓰면 한 월에 한 카테고리만 몰리는 버그 발생).
  //   - 1차: categorySlug = i % 5, monthsAgo = floor(i / 6) (6명마다 다음 월, 0..4 분산)
  //     → 카테고리별 6건, 월별 6명. 마스킹 k=5 안전 통과.
  //   - 2차 (i % 5 !== 0 인 24명): 다른 카테고리 + 1차에서 1개월 뒤로 이동.
  //     → 총 54건. 6개월 누적으로 카테고리별 10~12건.
  const CATEGORIES = ["depression", "anxiety", "burnout", "sleep", "relationships"] as const;
  const SEVERITIES: Array<"MILD" | "MODERATE" | "MODERATELY_SEVERE" | "SEVERE"> = [
    "MILD", "MILD", "MILD",
    "MODERATE", "MODERATE", "MODERATE",
    "MODERATELY_SEVERE", "MODERATELY_SEVERE",
    "SEVERE",
  ];

  let total = 0;
  for (let i = 0; i < targets.length; i++) {
    const userId = targets[i];
    const baseMonthsAgo = Math.min(Math.floor(i / 6), 4);

    // 1차
    await createAssessmentRecord(
      userId,
      {
        categorySlug: CATEGORIES[i % CATEGORIES.length],
        severity: SEVERITIES[i % SEVERITIES.length],
        monthsAgo: baseMonthsAgo,
      },
      categoryIdBySlug,
      now,
    );
    total++;

    // 2차 (60%) — 다른 카테고리 + 다른 월
    if (i % 5 !== 0) {
      await createAssessmentRecord(
        userId,
        {
          categorySlug: CATEGORIES[(i + 3) % CATEGORIES.length],
          severity: SEVERITIES[(i + 5) % SEVERITIES.length],
          monthsAgo: (baseMonthsAgo + 1) % 5,
        },
        categoryIdBySlug,
        now,
      );
      total++;
    }
  }

  console.log(`[seed]   - assessments inserted: ${total}`);
}

async function createAssessmentRecord(
  userId: string,
  spec: {
    categorySlug: string;
    severity: "MILD" | "MODERATE" | "MODERATELY_SEVERE" | "SEVERE";
    monthsAgo: number;
  },
  categoryIdBySlug: Record<string, string>,
  now: Date,
) {
  const created = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - spec.monthsAgo,
      // 1..28 중 user.id 해시 기반 결정론적 일자
      1 + (Math.abs(hashString(userId + spec.categorySlug)) % 27),
      9, 0, 0, 0,
    ),
  );
  await prisma.assessment.create({
    data: {
      userId,
      status: "COMPLETED",
      primaryCategoryId: categoryIdBySlug[spec.categorySlug] ?? null,
      severity: spec.severity,
      startedAt: created,
      completedAt: created,
      createdAt: created,
      updatedAt: created,
    },
  });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/**
 * Day 25 — 시드 v2: 세션·임상 노트·피드백·RiskFlag 대표 케이스.
 *
 * 풀 워크플로우 시연용 최소 데이터:
 *   - Booking COMPLETED 5건 (직원 5명 × 상담사 2명)
 *   - Session COMPLETED 5건 (입장/종료 SYSTEM 메시지 + 직원·상담사 메시지 1턴)
 *   - ClinicalNote FINALIZED 5건 (SOAP 4필드 + summary 모두 enc)
 *   - Feedback 4건 (rating 5·4·5·3) — Counselor rating·ratingCount 트랜잭션 갱신
 *   - RiskFlag L2 1건 + L3 1건 → L3 는 Escalation PENDING 동시 생성
 *
 * 모든 텍스트 필드는 D18 컬럼 암호화 정책 따라 encryptField 적용.
 */
async function seedSessionsFeedbackRisks(args: {
  employeeIds: string[]; // 처음 5명 사용
  counselorUserIds: string[]; // 처음 2명 사용
  companyId: string;
}) {
  const { employeeIds, counselorUserIds, companyId } = args;
  if (employeeIds.length < 5 || counselorUserIds.length < 2) {
    console.warn("[seed v2] 직원·상담사 부족 — 세션 시드 스킵");
    return;
  }

  const now = Date.now();
  // 5건의 booking·session 시점: 1~5주 전 KST 14:00
  const offsets = [1, 2, 2, 3, 5]; // weeks ago
  const ratings = [5, 4, 5, 3, null]; // 마지막은 피드백 없음
  const flagsAt: Array<"L2" | "L3" | null> = [null, "L2", null, "L3", null];

  const sessionRecords: Array<{
    sessionId: string;
    bookingId: string;
    employeeId: string;
    counselorUserId: string;
    scheduledAt: Date;
    riskMessageId: string | null;
  }> = [];

  for (let i = 0; i < 5; i++) {
    const employeeId = employeeIds[i];
    const counselorUserId = counselorUserIds[i % 2];
    const scheduledAt = new Date(now - offsets[i] * 7 * 24 * 60 * 60 * 1000);
    const startedAt = new Date(scheduledAt.getTime() + 60 * 1000);
    const endedAt = new Date(scheduledAt.getTime() + 50 * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        employeeId,
        counselorId: counselorUserId,
        scheduledAt,
        status: "COMPLETED",
      },
      select: { id: true },
    });

    const session = await prisma.session.create({
      data: {
        bookingId: booking.id,
        employeeId,
        counselorId: counselorUserId,
        status: "COMPLETED",
        startedAt,
        endedAt,
        createdAt: scheduledAt,
        updatedAt: endedAt,
      },
      select: { id: true },
    });

    // 메시지 4개: 입장 SYSTEM / 직원 / 상담사 / 종료 SYSTEM
    const enterMsg = await prisma.sessionMessage.create({
      data: {
        sessionId: session.id,
        senderId: null,
        role: "SYSTEM",
        content: enc("세션이 시작되었어요"),
        createdAt: new Date(startedAt.getTime() + 1000),
      },
      select: { id: true },
    });

    let riskMessageId: string | null = null;
    const riskLevel = flagsAt[i];
    const employeeBody = riskLevel === "L3"
      ? "요즘 정말 끝내고 싶다는 생각이 자꾸 들어요. 방법까지 계속 떠오릅니다."
      : riskLevel === "L2"
        ? "잠도 안 오고 사라지고 싶다는 생각이 가끔 들어요."
        : "이번 주는 회사 일이 너무 힘들어요. 잠도 안 오고 식욕도 없어요.";

    const empMsg = await prisma.sessionMessage.create({
      data: {
        sessionId: session.id,
        senderId: employeeId,
        role: "EMPLOYEE",
        content: enc(employeeBody),
        createdAt: new Date(startedAt.getTime() + 60_000),
      },
      select: { id: true },
    });
    if (riskLevel) riskMessageId = empMsg.id;

    await prisma.sessionMessage.create({
      data: {
        sessionId: session.id,
        senderId: counselorUserId,
        role: "COUNSELOR",
        content: enc(
          riskLevel
            ? "지금 그 마음 들어주셔서 감사해요. 안전을 가장 먼저 살펴봐야 해요. 119 또는 1393 핫라인 도움 받으실 수 있어요."
            : "최근 일주일 동안 어떤 순간이 가장 힘드셨는지 천천히 이야기 들려주실 수 있을까요?",
        ),
        createdAt: new Date(startedAt.getTime() + 120_000),
      },
    });

    await prisma.sessionMessage.create({
      data: {
        sessionId: session.id,
        senderId: null,
        role: "SYSTEM",
        content: enc("세션이 종료되었어요"),
        createdAt: new Date(endedAt.getTime()),
      },
    });

    // ClinicalNote FINALIZED — 모두 enc
    await prisma.clinicalNote.create({
      data: {
        sessionId: session.id,
        counselorId: counselorUserId,
        employeeId,
        status: "FINALIZED",
        subjective: enc(
          riskLevel === "L3"
            ? "내담자는 구체적 자살 계획을 언급. 즉시 안전 사정 필요."
            : "내담자는 직무 스트레스로 인한 수면·식욕 저하를 호소.",
        ),
        objective: enc("세션 중 전반적으로 침체된 정서. 시선 접촉 간헐적."),
        assessmentText: enc(
          riskLevel === "L3"
            ? "자살 사고 + 구체적 계획. L3 위기. 전문의 사인오프 필요."
            : "직무 소진 중심 우울 증상. PHQ-9 권유.",
        ),
        plan: enc(
          "1) 다음 회기까지 수면·식사 일지. 2) 1577-0199 안내. 3) 필요 시 가족 동의 확인.",
        ),
        summaryForEmployee: enc(
          "이번 회기 어려운 이야기 들려주셔서 감사해요. 다음 회기까지 작은 자기 돌봄 활동 1가지 시도해 보세요.",
        ),
        flags: riskLevel === "L3" ? ["RISK_SUICIDAL", "FOLLOW_UP_RECOMMENDED"] : [],
        finalizedAt: new Date(endedAt.getTime() + 60_000),
        createdAt: new Date(endedAt.getTime() + 30_000),
        updatedAt: new Date(endedAt.getTime() + 60_000),
      },
    });

    // Feedback (마지막 케이스 제외 4건)
    const rating = ratings[i];
    if (rating !== null) {
      await prisma.feedback.create({
        data: {
          sessionId: session.id,
          employeeId,
          counselorId: counselorUserId,
          rating,
          comment: rating >= 4 ? "도움이 됐어요. 다음에도 만나고 싶어요." : "더 적극적인 가이드가 있으면 좋겠습니다.",
          wantSameCounselor: rating >= 4,
          createdAt: new Date(endedAt.getTime() + 24 * 60 * 60 * 1000),
        },
      });
    }

    sessionRecords.push({
      sessionId: session.id,
      bookingId: booking.id,
      employeeId,
      counselorUserId,
      scheduledAt,
      riskMessageId,
    });

    void enterMsg; // unused suppression
  }

  // Counselor rating·ratingCount 재계산 — Feedback 시드에 맞춰
  for (const counselorUserId of counselorUserIds.slice(0, 2)) {
    const profile = await prisma.counselor.findUnique({
      where: { userId: counselorUserId },
      select: { id: true, rating: true, ratingCount: true },
    });
    if (!profile) continue;
    const fbRows = await prisma.feedback.findMany({
      where: { counselorId: counselorUserId },
      select: { rating: true },
    });
    if (fbRows.length === 0) continue;
    const sum = fbRows.reduce((s, f) => s + f.rating, 0);
    // 기존 rating·ratingCount 위에 누적 (시드 v1 의 가상 평점에 v2 피드백 추가)
    const baseCount = profile.ratingCount;
    const baseRating = profile.rating ?? 0;
    const newCount = baseCount + fbRows.length;
    const newRating = Math.round(((baseRating * baseCount + sum) / newCount) * 100) / 100;
    await prisma.counselor.update({
      where: { id: profile.id },
      data: { rating: newRating, ratingCount: newCount },
    });
  }

  // RiskFlag — L2/L3 케이스에서 SessionMessage 기반으로 INSERT
  let createdRiskCount = 0;
  for (const rec of sessionRecords) {
    const flag = flagsAt[sessionRecords.indexOf(rec)];
    if (!flag || !rec.riskMessageId) continue;

    const isL3 = flag === "L3";
    const level = isL3 ? "L3_ESCALATION" : "L2_ALERT";
    const status = isL3 ? "ESCALATED" : "PENDING";

    const riskFlag = await prisma.riskFlag.create({
      data: {
        sourceType: "SESSION_MESSAGE",
        sourceId: rec.riskMessageId,
        subjectUserId: rec.employeeId,
        companyId,
        level,
        status,
        signals: {
          keywords: isL3 ? ["끝내고", "방법", "계속"] : ["사라지고", "잠"],
          snippet: isL3 ? "끝내고 싶다…방법까지" : "사라지고 싶다…",
        },
        summary: isL3 ? "L3: 구체적 자살 계획 언급" : "L2: 자해·자살 사고",
        createdAt: new Date(rec.scheduledAt.getTime() + 5 * 60 * 1000),
        updatedAt: new Date(rec.scheduledAt.getTime() + 5 * 60 * 1000),
      },
      select: { id: true },
    });
    createdRiskCount++;

    if (isL3) {
      // Escalation PENDING — SLA 24h 카운트다운은 createdAt 기준
      await prisma.escalation.create({
        data: {
          riskFlagId: riskFlag.id,
          subjectUserId: rec.employeeId,
          companyId,
          status: "PENDING",
          slaDueAt: new Date(rec.scheduledAt.getTime() + 24 * 60 * 60 * 1000),
          createdAt: new Date(rec.scheduledAt.getTime() + 5 * 60 * 1000),
          updatedAt: new Date(rec.scheduledAt.getTime() + 5 * 60 * 1000),
        },
      });
    }
  }

  console.log(
    `[seed v2]   - sessions=${sessionRecords.length}, feedback=${ratings.filter((r) => r !== null).length}, risks=${createdRiskCount}`,
  );
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

  const passwordHash = await hash(SEED_PASSWORD, 12);
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
  for (let idx = 0; idx < counselorSpecs.length; idx++) {
    const c = counselorSpecs[idx];
    // 첫 번째 (counselor@mindbridge.test) 만 고정 UUID — D25 stale JWT 회피
    const fixedId = idx === 0 ? FIXED_USER_IDS.counselor : undefined;
    const { id } = await createUser(
      { id: fixedId, email: c.email, role: c.role, nickname: c.nickname },
      ctx,
    );
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

  const allEmployees = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: { id: true },
  });
  console.log(`[seed] STATISTICS consents (40/${allEmployees.length} employees)…`);
  await seedStatisticsConsents(allEmployees.map((u) => u.id));

  console.log("[seed] assessments (D23 차트용 약식 시드)…");
  const statsConsenters = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      consents: { some: { type: "STATISTICS", revokedAt: null } },
    },
    select: { id: true },
  });
  await seedAssessments(
    statsConsenters.map((u) => u.id),
    categoryIdBySlug,
  );

  console.log("[seed v2] sessions + feedback + risk (D25 풀 사이클)…");
  const counselorUsers = await prisma.user.findMany({
    where: { role: "COUNSELOR" },
    orderBy: { email: "asc" },
    select: { id: true },
    take: 2,
  });
  const firstEmployees = employees.slice(0, 5).map((e) => e.id);
  await seedSessionsFeedbackRisks({
    employeeIds: firstEmployees,
    counselorUserIds: counselorUsers.map((u) => u.id),
    companyId,
  });

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

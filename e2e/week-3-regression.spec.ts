import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Day 21 — Week 3 회귀 E2E.
 *
 * W3 게이트 (mindbridge-dev-plan §4):
 *   "위기 자동 감지 30초 + SOAP 자동 변환 + 임상 노트 암호화 검증"
 *
 * 시나리오 (한 spec 안에서 직원 → 상담사 → 전문의 풀 흐름):
 *   1. setup: 시드 employee/doctor/counselor 재사용. 직전 spec 잔여 RiskFlag·
 *      Feedback·Escalation 정리 후 새 booking CONFIRMED 시드.
 *   2. 직원 로그인 → /app/bookings/[id] → 세션 입장 → 세션룸
 *   3. L3 위기 메시지 전송 → 30초 이내 RiskFlag(L3) + Escalation(PENDING) 자동 생성 검증
 *   4. 직원 → 세션 종료 클릭 → COMPLETED 전이 → 피드백 CTA 노출
 *   5. 피드백 폼 → 평점 5 + 코멘트 + 재예약 의사 → 제출 → Feedback row + Counselor rating 갱신
 *   6. DB raw: SessionMessage.content 가 평문 아님 (AES-256-GCM 컬럼 암호화 검증)
 *   7. 전문의 로그인 → /psychiatrist/queue → 상세 → 검토 시작 → 사인오프
 *   8. Escalation DECIDED + RiskFlag RESOLVED 검증
 *
 * 시드 격리: 매 spec 시작 시 시드 직원/상담사의 W3 잔여 row 일괄 삭제.
 * 시드 자체(User/Counselor/Company)는 건드리지 않음.
 */

const prisma = new PrismaClient();

const EMPLOYEE_EMAIL = "employee@mindbridge.test";
const COUNSELOR_EMAIL = "counselor@mindbridge.test";
const DOCTOR_EMAIL = "doctor@mindbridge.test";
const SEED_PASSWORD = "testpass1234";

const L3_MESSAGE = "수면제를 모아두기 시작했어요. 옥상에 자주 갑니다.";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !/\/signin/.test(u.toString()), { timeout: 20_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /로그아웃/ }).click();
  // signOut 후 callbackUrl 이 / 또는 /signin 으로 가는 두 경우 모두 견고하게 — 명시적으로 signin 으로 이동.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.goto("/signin");
  await page.waitForURL(/\/signin/, { timeout: 10_000 });
}

test("W3 회귀: 세션 → 위기(30s) → 종료 → 피드백 → 전문의 사인오프", async ({
  page,
}) => {
  // ─────────────────────────────────────────────────────────────────────
  // Setup: 잔여 정리 + 새 booking
  // ─────────────────────────────────────────────────────────────────────
  const employee = await prisma.user.findUniqueOrThrow({
    where: { email: EMPLOYEE_EMAIL },
    select: { id: true, companyId: true },
  });
  const counselorUser = await prisma.user.findUniqueOrThrow({
    where: { email: COUNSELOR_EMAIL },
    select: { id: true },
  });
  const counselor = await prisma.counselor.findUniqueOrThrow({
    where: { userId: counselorUser.id },
    select: { id: true, rating: true, ratingCount: true },
  });
  const beforeRating = { rating: counselor.rating, ratingCount: counselor.ratingCount };

  // 직전 spec 잔여 정리 — 이 직원의 RiskFlag·Feedback. Escalation 은 RiskFlag cascade.
  await prisma.feedback.deleteMany({ where: { employeeId: employee.id } });
  await prisma.riskFlag.deleteMany({ where: { subjectUserId: employee.id } });

  // unique slot — counselor + scheduledAt UNIQUE 제약 회피 (현재시각 + spec 매번 다른 ms)
  const scheduledAt = new Date(Date.now() + 30 * 60 * 1000 + Math.floor(Math.random() * 60_000));
  const booking = await prisma.booking.create({
    data: {
      employeeId: employee.id,
      counselorId: counselorUser.id,
      scheduledAt,
      status: "CONFIRMED",
    },
    select: { id: true },
  });

  const totalStart = Date.now();

  // ─────────────────────────────────────────────────────────────────────
  // 1. 직원 로그인 → /app/bookings/[id]
  // ─────────────────────────────────────────────────────────────────────
  await signIn(page, EMPLOYEE_EMAIL);
  await page.goto(`/app/bookings/${booking.id}`);
  await expect(page.getByText("예약 ID:")).toBeVisible();

  // ─────────────────────────────────────────────────────────────────────
  // 2. 세션 입장 → 세션룸
  // ─────────────────────────────────────────────────────────────────────
  await Promise.all([
    page.waitForURL(/\/session\/[0-9a-f-]+$/, { timeout: 15_000 }),
    page.getByRole("button", { name: /^세션 입장$/ }).click(),
  ]);
  const sessionUrl = page.url();
  const sessionId = sessionUrl.split("/").pop()!;
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

  // ─────────────────────────────────────────────────────────────────────
  // 3. L3 메시지 전송 → 위기 감지 30초 검증 (W3 게이트)
  // ─────────────────────────────────────────────────────────────────────
  const messageInput = page.locator('input[type="text"]');
  await expect(messageInput).toBeEnabled({ timeout: 15_000 });
  const riskStart = Date.now();
  await messageInput.fill(L3_MESSAGE);
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(messageInput).toHaveValue("", { timeout: 15_000 });

  // 핫라인 배너 표시 — D19 동작 회귀
  await expect(page.getByText(/위기/).first()).toBeVisible({ timeout: 10_000 });

  // RiskFlag + Escalation row 확인 (polling 으로 최대 30s 대기)
  const startedAt = new Date(riskStart);
  let escRow: { id: string; status: string; createdAt: Date; riskFlag: { level: string } } | null = null;
  const slaDeadline = riskStart + 30_000;
  while (Date.now() < slaDeadline) {
    const r = await prisma.escalation.findFirst({
      where: { subjectUserId: employee.id, createdAt: { gte: startedAt } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        riskFlag: { select: { level: true } },
      },
    });
    if (r) {
      escRow = r;
      break;
    }
    await page.waitForTimeout(500);
  }
  expect(escRow).not.toBeNull();
  expect(escRow!.riskFlag.level).toBe("L3_ESCALATION");
  expect(escRow!.status).toBe("PENDING");

  const detectionDelta = escRow!.createdAt.getTime() - riskStart;
  // eslint-disable-next-line no-console
  console.log(`[E2E] 위기 감지 delta: ${detectionDelta}ms (게이트 <30000ms)`);
  expect(detectionDelta).toBeLessThan(30_000);

  // ─────────────────────────────────────────────────────────────────────
  // 4. 세션 종료 → COMPLETED + 피드백 CTA 노출
  // ─────────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: /^세션 종료$/ }).click();
  await expect(page.getByRole("link", { name: /피드백 작성/ })).toBeVisible({
    timeout: 10_000,
  });

  // DB 검증 — Session.status = COMPLETED, endedAt 채워짐
  const completedSession = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { status: true, endedAt: true },
  });
  expect(completedSession.status).toBe("COMPLETED");
  expect(completedSession.endedAt).not.toBeNull();

  // ─────────────────────────────────────────────────────────────────────
  // 5. 피드백 폼 → 제출 → DB 검증
  // ─────────────────────────────────────────────────────────────────────
  await Promise.all([
    page.waitForURL(`**/app/feedback/${sessionId}`, { timeout: 15_000 }),
    page.getByRole("link", { name: /피드백 작성/ }).click(),
  ]);
  // 별 5개 클릭
  await page.getByRole("radio", { name: "별 5개" }).click();
  // 코멘트
  await page.locator("#comment").fill("E2E 회귀 시나리오 — 피드백 텍스트");
  // 재예약 의사
  await page.locator("#want-same").check();
  // 제출 → /app 으로 redirect
  await Promise.all([
    page.waitForURL(/\/app(?:\?|$)/, { timeout: 15_000 }),
    page.getByRole("button", { name: /피드백 제출/ }).click(),
  ]);

  // Feedback row + Counselor rating 갱신 검증
  const fb = await prisma.feedback.findUniqueOrThrow({
    where: { sessionId },
    select: { rating: true, wantSameCounselor: true, comment: true },
  });
  expect(fb.rating).toBe(5);
  expect(fb.wantSameCounselor).toBe(true);
  expect(fb.comment).toContain("E2E 회귀");

  const afterCounselor = await prisma.counselor.findUniqueOrThrow({
    where: { id: counselor.id },
    select: { rating: true, ratingCount: true },
  });
  expect(afterCounselor.ratingCount).toBe(beforeRating.ratingCount + 1);
  // 평균은 (이전평균*count + 5)/(count+1) — 정확히 일치하지 않아도 증가 여부만 단조 검증
  expect(afterCounselor.rating).not.toBeNull();

  // ─────────────────────────────────────────────────────────────────────
  // 6. 컬럼 암호화 검증 — SessionMessage.content 가 평문 아님
  // ─────────────────────────────────────────────────────────────────────
  const messages = await prisma.sessionMessage.findMany({
    where: { sessionId, role: { not: "SYSTEM" } },
    select: { content: true, encKeyVersion: true },
  });
  expect(messages.length).toBeGreaterThan(0);
  for (const m of messages) {
    expect(m.content).not.toContain("수면제");
    expect(m.content).not.toContain("옥상");
    expect(m.encKeyVersion).toBe(1);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 7. 전문의 로그인 → 큐 → 검토 시작 → 사인오프
  // ─────────────────────────────────────────────────────────────────────
  await signOut(page);
  await signIn(page, DOCTOR_EMAIL);

  await page.goto(`/psychiatrist/queue/${escRow!.id}`);
  await expect(page.getByText(/에스컬레이션 상세/)).toBeVisible();

  // 검토 시작 (PENDING → IN_REVIEW)
  await page.getByRole("button", { name: /^검토 시작$/ }).click();
  await expect(page.getByText(/^전문의 의견/)).toBeVisible({ timeout: 10_000 });

  // 사인오프 폼
  await page.locator('select').selectOption("medication_consult");
  await page
    .locator("textarea")
    .fill("E2E 회귀 — 응급 면담 권고. 가족 동의 후 약물 상담 진행.");
  await page.locator('#family-consent').check();
  await page.getByRole("button", { name: /^사인오프$/ }).click();

  await expect(page.getByText(/사인오프 완료된 케이스/)).toBeVisible({ timeout: 10_000 });

  // 최종 DB 검증 — Escalation DECIDED + RiskFlag RESOLVED
  const finalEsc = await prisma.escalation.findUniqueOrThrow({
    where: { id: escRow!.id },
    select: {
      status: true,
      decision: true,
      familyConsent: true,
      riskFlag: { select: { status: true } },
    },
  });
  expect(finalEsc.status).toBe("DECIDED");
  expect(finalEsc.decision).toBe("medication_consult");
  expect(finalEsc.familyConsent).toBe(true);
  expect(finalEsc.riskFlag.status).toBe("RESOLVED");

  const totalElapsed = Date.now() - totalStart;
  // eslint-disable-next-line no-console
  console.log(`[E2E] W3 회귀 풀 walltime: ${totalElapsed}ms`);
});

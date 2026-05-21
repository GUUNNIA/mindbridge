import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * D21 carry-over — EXPIRED Escalation 본인 큐 노출 회귀.
 *
 * 시나리오:
 *   1. setup: 본인이 reviewer 로 잡고 있던 IN_REVIEW Escalation 시드 (slaDueAt 과거)
 *   2. cron 트리거 → EXPIRED 전이 + 운영자 알림 outbox enqueue
 *   3. 전문의 본인 큐 페이지에서 EXPIRED 케이스가 여전히 보임 + 상단 안내 배너 노출
 *   4. expiredAt 을 25h 전으로 강제 이동 → 큐에서 사라짐 (24h 컷오프)
 *   5. cleanup
 *
 * 시드 격리: 본 spec 만 만든 RiskFlag 만 정리 (전체 cascade 회피 — D20 시연 잔여 사고 학습).
 */

const prisma = new PrismaClient();

const DOCTOR_EMAIL = "doctor@mindbridge.test";
const EMPLOYEE_EMAIL = "employee@mindbridge.test";
const SEED_PASSWORD = "testpass1234";

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

test("PSYCHIATRIST: 본인 IN_REVIEW → SLA 만료 → 24h 동안 큐에 EXPIRED 잔존", async ({
  page,
}) => {
  // ─────────────────────────────────────────────────────────────────────
  // Setup: 본인 reviewer 인 IN_REVIEW Escalation 시드, slaDueAt 1분 전
  // ─────────────────────────────────────────────────────────────────────
  const doctor = await prisma.user.findUniqueOrThrow({
    where: { email: DOCTOR_EMAIL },
    select: { id: true },
  });
  const employee = await prisma.user.findUniqueOrThrow({
    where: { email: EMPLOYEE_EMAIL },
    select: { id: true, companyId: true },
  });

  const flag = await prisma.riskFlag.create({
    data: {
      sourceType: "ASSESSMENT_RESPONSE",
      sourceId: `e2e-expired-${Date.now()}`,
      subjectUserId: employee.id,
      companyId: employee.companyId,
      level: "L3_ESCALATION",
      status: "ESCALATED",
      signals: { keywords: ["옥상"], snippet: "E2E EXPIRED 회귀 시드" },
      summary: "[E2E] EXPIRED 큐 잔존 검증용",
    },
    select: { id: true },
  });

  const escalation = await prisma.escalation.create({
    data: {
      riskFlagId: flag.id,
      subjectUserId: employee.id,
      companyId: employee.companyId,
      slaDueAt: new Date(Date.now() - 60 * 1000), // 1분 전 만료
      status: "IN_REVIEW",
      reviewerId: doctor.id,
      reviewStartedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    select: { id: true },
  });

  try {
    // ─────────────────────────────────────────────────────────────────────
    // 1. cron 트리거 → EXPIRED 전이 (route 호출)
    // ─────────────────────────────────────────────────────────────────────
    const cronRes = await page.request.post("/api/cron/escalation-sla");
    const cronBody = await cronRes.json();
    expect(cronBody.ok).toBe(true);
    expect(cronBody.expired).toBeGreaterThanOrEqual(1);

    const expiredRow = await prisma.escalation.findUniqueOrThrow({
      where: { id: escalation.id },
      select: { status: true, expiredAt: true },
    });
    expect(expiredRow.status).toBe("EXPIRED");
    expect(expiredRow.expiredAt).not.toBeNull();

    // ─────────────────────────────────────────────────────────────────────
    // 2. 전문의 로그인 → 본인 큐 페이지에서 EXPIRED 잔존 + 안내 배너
    // ─────────────────────────────────────────────────────────────────────
    await signIn(page, DOCTOR_EMAIL);
    await page.goto("/psychiatrist/queue");

    await expect(
      page.getByText(/내가 검토 중이던 케이스 \d+건이 SLA 만료/),
    ).toBeVisible({ timeout: 10_000 });
    // 본 escalation 의 행이 EXPIRED 상태 핫으로 보임
    await expect(page.getByText("SLA 만료").first()).toBeVisible();

    // 상세 진입 가능
    await page.goto(`/psychiatrist/queue/${escalation.id}`);
    await expect(page.getByText(/에스컬레이션 상세/)).toBeVisible();
    await expect(page.getByText(/SLA 만료된 케이스/)).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────
    // 3. expiredAt 을 25h 전으로 강제 이동 → 큐에서 사라짐 (컷오프)
    // ─────────────────────────────────────────────────────────────────────
    await prisma.escalation.update({
      where: { id: escalation.id },
      data: { expiredAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await page.goto("/psychiatrist/queue");
    await expect(
      page.getByText(/내가 검토 중이던 케이스 \d+건이 SLA 만료/),
    ).toHaveCount(0);
  } finally {
    // 본 spec 이 만든 row 만 정리 — RiskFlag cascade 로 Escalation 도 삭제. outbox 도 본인 케이스 한정.
    await prisma.notificationOutbox.deleteMany({
      where: { dedupeKey: { startsWith: `ESCALATION_EXPIRED:${escalation.id}:` } },
    });
    await prisma.riskFlag.delete({ where: { id: flag.id } });
  }
});

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Day 14 — 직원 여정 풀 E2E.
 *
 * 시나리오 (PRD §6.1.1 + IA §7 Onboarding 7화면):
 *   HR 발급 코드 → 가입 → verify-pending(dev) → consents → nickname → intro
 *   → assessment(5턴) → result → counselors(추천 카드) → slot picker → booking REQUESTED
 *
 * 측정:
 *   - 자가진단 5턴 전체 응답 시간 (DoD: 평균 <5s/턴)
 *   - 풀 플로우 walltime
 *
 * 격리: 매 spec 실행마다 unique InviteCode + unique email 발급. cleanup 없음
 * (다음 seed wipe 시 정리). DB 상태 공유 가정.
 */

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("employee journey: signup → onboarding → assessment → recommendation → booking", async ({
  page,
}) => {
  // ─────────────────────────────────────────────────────────────────────
  // Setup: 새 InviteCode + unique email
  // ─────────────────────────────────────────────────────────────────────
  const company = await prisma.company.findFirst({ select: { id: true } });
  const hr = await prisma.user.findFirst({
    where: { role: "HR" },
    select: { id: true },
  });
  if (!company || !hr) {
    throw new Error("seed 누락 — `pnpm db:seed` 실행 후 재시도해 주세요.");
  }

  const inviteCode = `E2E-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  await prisma.inviteCode.create({
    data: {
      code: inviteCode,
      companyId: company.id,
      issuedById: hr.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const email = `e2e-${Date.now()}@example.com`;
  const password = "E2eTestPassword123!";
  const nickname = `e2e직원${Date.now().toString().slice(-4)}`;

  const totalStart = Date.now();

  // ─────────────────────────────────────────────────────────────────────
  // 1. /signup (코드 URL 자동 입력 검증)
  // ─────────────────────────────────────────────────────────────────────
  await page.goto(`/signup?code=${inviteCode}`);
  await expect(page.locator("#code")).toHaveValue(inviteCode);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();

  // ─────────────────────────────────────────────────────────────────────
  // 2. /signup/verify-pending → [dev] 자동 인증
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL("**/signup/verify-pending", { timeout: 15_000 });
  await page.getByRole("button", { name: /자동 인증/ }).click();

  // ─────────────────────────────────────────────────────────────────────
  // 3. /app/onboarding/consents (서비스·민감정보 필수)
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL("**/app/onboarding/consents", { timeout: 15_000 });
  await page.locator('input[name="service"]').check();
  await page.locator('input[name="sensitive"]').check();
  await page.locator('button[type="submit"]').click();

  // ─────────────────────────────────────────────────────────────────────
  // 4. /app/onboarding/nickname
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL("**/app/onboarding/nickname", { timeout: 15_000 });
  await page.locator("#nickname").fill(nickname);
  await page.locator('button[type="submit"]').click();

  // ─────────────────────────────────────────────────────────────────────
  // 5. /app/onboarding/intro → "지금 시작"
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL("**/app/onboarding/intro", { timeout: 15_000 });
  await page.getByRole("link", { name: /지금 시작/ }).click();

  // ─────────────────────────────────────────────────────────────────────
  // 6. /app/assessment → 시작하기
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL("**/app/assessment", { timeout: 15_000 });
  await page.getByRole("button", { name: /시작하기/ }).click();

  // ─────────────────────────────────────────────────────────────────────
  // 7. /app/assessment/[id] → 5턴 대화 (hard cap → result redirect)
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL(/\/app\/assessment\/[0-9a-f-]+$/, { timeout: 15_000 });

  const assessmentStart = Date.now();
  // 4턴이면 shouldComplete(turnIndex=3, transcript>=20) 또는 hard cap 으로 완료.
  // mock 모드 임을 감안 — 의도적으로 짧지만 누적 20자는 첫 입력만으로 통과.
  const replies = [
    "요즘 잠을 못 자고 매일 불안해서 너무 힘들어요.",
    "회사 일이 많아 번아웃이 온 것 같습니다.",
    "관계도 어려워지고 점점 위축됩니다.",
    "도움이 필요한 것 같아 연락드렸어요.",
  ];
  const input = page.locator('input[type="text"]');
  const sendBtn = page.getByRole("button", { name: "보내기" });

  for (let i = 0; i < replies.length; i++) {
    const isLast = i === replies.length - 1;
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill(replies[i]);

    if (isLast) {
      // 마지막 send → shouldComplete=true → router.push(/result)
      await Promise.all([
        page.waitForURL(/\/app\/assessment\/[0-9a-f-]+\/result$/, { timeout: 30_000 }),
        sendBtn.click(),
      ]);
    } else {
      await sendBtn.click();
      // 봇 응답 도착 → input 값 클리어 + 다시 enabled (다음 turn 준비 상태)
      await expect(input).toHaveValue("", { timeout: 15_000 });
      await expect(input).toBeEnabled({ timeout: 15_000 });
    }
  }
  const assessmentElapsed = Date.now() - assessmentStart;
  // eslint-disable-next-line no-console
  const turnCount = replies.length;
  console.log(
    `[E2E] 자가진단 ${turnCount}턴 walltime: ${assessmentElapsed}ms (평균 ${Math.round(
      assessmentElapsed / turnCount,
    )}ms/턴, DoD 목표 <5000ms/턴 — mock 모드 기준)`,
  );
  expect(assessmentElapsed / turnCount).toBeLessThan(5_000);

  // ─────────────────────────────────────────────────────────────────────
  // 8. /app/counselors — 추천 카드 노출
  // ─────────────────────────────────────────────────────────────────────
  await page.goto("/app/counselors");
  await expect(page.getByRole("heading", { name: /추천 상담사/ })).toBeVisible();
  // 카드 3개 중 첫 "슬롯 보기" 링크
  await page.getByRole("link", { name: "슬롯 보기" }).first().click();

  // ─────────────────────────────────────────────────────────────────────
  // 9. /app/counselors/[id] — 슬롯 피커, 첫 슬롯 클릭
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL(/\/app\/counselors\/[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.getByText(/예약 가능 시각/)).toBeVisible();
  // 슬롯 button 첫 번째 (KST 시간 라벨 — HH:MM 형식)
  const slotButtons = page.locator(
    'button:has-text(":00"), button:has-text(":30")',
  );
  await expect(slotButtons.first()).toBeVisible({ timeout: 10_000 });
  await slotButtons.first().click();

  // ─────────────────────────────────────────────────────────────────────
  // 10. /app/bookings/[id] — REQUESTED 배지
  // ─────────────────────────────────────────────────────────────────────
  await page.waitForURL(/\/app\/bookings\/[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.locator('text=예약 ID:')).toBeVisible();
  await expect(page.getByText("예약 요청됨")).toBeVisible();

  // ─────────────────────────────────────────────────────────────────────
  // Outbox 검증: BOOKING_REQUESTED row 1건 enqueue됐는지
  // ─────────────────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const outboxRows = await prisma.notificationOutbox.findMany({
    where: { recipientUserId: user!.id, type: "BOOKING_REQUESTED" },
  });
  expect(outboxRows).toHaveLength(1);
  expect(outboxRows[0].status).toBe("PENDING");
  expect(outboxRows[0].dedupeKey).toMatch(/^BOOKING_REQUESTED:/);

  const totalElapsed = Date.now() - totalStart;
  // eslint-disable-next-line no-console
  console.log(`[E2E] 풀 플로우 walltime: ${totalElapsed}ms`);
});

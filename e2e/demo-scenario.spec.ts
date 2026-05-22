import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Day 27 — Demo scenario E2E.
 *
 * W4 신규 화면(HR 대시보드·리포트·운영자 위기 큐·감사 로그) 회귀.
 * W3 회귀는 위기·임상 워크플로우를 다룸 (week-3-regression.spec.ts) — 본 spec 은 W4 부분만.
 *
 * 시나리오 (2개 test):
 *   test #1 — HR 풀:
 *     /hr → /hr/dashboard (BR-7 통과 + KPI/차트 노출) → /hr/reports (insight preview)
 *     → /api/hr/report/pdf?... GET 200 (PDF 다운로드 가능) → AuditLog GENERATE_HR_REPORT_PDF 검증
 *   test #2 — ADMIN 풀 (자기완결, 시드 의존 최소):
 *     setup: L2 PENDING RiskFlag 직접 insert (cleanup 도)
 *     /admin/risk-queue → 표에 시드 RiskFlag 표시 + 직접 insert 한 row 표시 → ACK
 *     → DB status=ACKNOWLEDGED 검증
 *     → /admin/audit-logs → 감사 로그 표시 확인
 *
 * 시드 가정: pnpm db:seed 가 핵심 5롤 + STATISTICS 동의 + 자가진단 시드 + 시드 v2 까지 적용된 상태.
 */

const prisma = new PrismaClient();

const HR_EMAIL = "hr@mindbridge.test";
const ADMIN_EMAIL = "admin@mindbridge.test";
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

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /로그아웃/ }).click();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.goto("/signin");
  await page.waitForURL(/\/signin/, { timeout: 10_000 });
}

test("D27 demo: HR 흐름 — 대시보드 → 리포트 미리보기 → PDF 다운로드 → AuditLog", async ({
  page,
  request,
}) => {
  await signIn(page, HR_EMAIL);

  // 1) HR 홈 진입
  await page.goto("/hr");
  await expect(page.getByRole("heading", { name: /HR 대시보드/ })).toBeVisible();

  // 2) 대시보드 — BR-7 통과 + KPI 카드 노출
  await page.goto("/hr/dashboard");
  await expect(page.getByRole("heading", { name: /HR 대시보드/ })).toBeVisible();

  // BR-7 차단 카드가 *없음* 검증 (있으면 데이터 부족 — 시드 재실행 필요)
  await expect(page.getByText(/발행 차단 \(BR-7\)/)).toHaveCount(0);

  // 헤더 메타 — 직원 수·동의자 수. page 전체에서 첫 매칭 (글로벌 <header> 충돌 회피).
  await expect(page.getByText(/직원 \d+명/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/통계 동의자 \d+명/).first()).toBeVisible({ timeout: 15_000 });

  // KPI 카드 4종 + 차트 섹션 노출 — exact 매치 (CardDescription 안 substring 충돌 회피)
  await expect(page.getByText("이용 직원", { exact: true })).toBeVisible();
  await expect(page.getByText("자가진단 응답", { exact: true })).toBeVisible();
  await expect(page.getByText("번아웃 비율", { exact: true })).toBeVisible();
  await expect(page.getByText("월별 자가진단 추이", { exact: true })).toBeVisible();
  await expect(page.getByText("카테고리 분포", { exact: true })).toBeVisible();
  await expect(page.getByText("부서별 이용", { exact: true })).toBeVisible();

  // 3) 리포트 미리보기
  await page.goto("/hr/reports");
  await expect(page.getByRole("heading", { name: /월간 리포트/ })).toBeVisible();
  await expect(page.getByText("핵심 인사이트")).toBeVisible();
  await expect(page.getByText("Key Takeaways")).toBeVisible();
  await expect(page.getByText("Recommended Actions")).toBeVisible();

  // 4) PDF 다운로드 — route handler GET 200 검증 (실 PDF 바이너리 응답)
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1));
  const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
  const pdfUrl = `/api/hr/report/pdf?startISO=${encodeURIComponent(start.toISOString())}&endISO=${encodeURIComponent(end.toISOString())}`;
  const beforeLogs = await prisma.auditLog.count({
    where: { action: "GENERATE_HR_REPORT_PDF" },
  });

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const pdfResp = await request.get(pdfUrl, {
    headers: { cookie: cookieHeader },
  });
  expect(pdfResp.status()).toBe(200);
  expect(pdfResp.headers()["content-type"]).toContain("application/pdf");
  const buffer = await pdfResp.body();
  // 최소 PDF 바이너리 magic — "%PDF-"
  expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  expect(buffer.length).toBeGreaterThan(1000); // 너무 작으면 깨진 응답

  // AuditLog 갱신 검증
  const afterLogs = await prisma.auditLog.count({
    where: { action: "GENERATE_HR_REPORT_PDF" },
  });
  expect(afterLogs).toBe(beforeLogs + 1);

  await signOut(page);
});

test("D27 demo: ADMIN 흐름 — risk-queue ACK → audit-logs 검증", async ({ page }) => {
  // setup — L2 PENDING RiskFlag 직접 insert (자기완결)
  const employee = await prisma.user.findUniqueOrThrow({
    where: { email: EMPLOYEE_EMAIL },
    select: { id: true, companyId: true },
  });
  const fixture = await prisma.riskFlag.create({
    data: {
      sourceType: "SESSION_MESSAGE",
      sourceId: "e2e-fixture-" + Date.now(),
      subjectUserId: employee.id,
      companyId: employee.companyId,
      level: "L2_ALERT",
      status: "PENDING",
      signals: { keywords: ["E2E", "fixture"], snippet: "demo scenario fixture" },
      summary: "D27 E2E fixture L2 — ack test",
    },
    select: { id: true },
  });

  try {
    await signIn(page, ADMIN_EMAIL);

    // 1) 운영자 홈
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /운영자 콘솔/ })).toBeVisible();

    // 2) risk-queue
    await page.goto("/admin/risk-queue?status=PENDING");
    await expect(page.getByRole("heading", { name: /위기 알림 큐/ })).toBeVisible();
    // fixture row 가 표에 보임 (summary 로 식별)
    await expect(page.getByText("D27 E2E fixture L2")).toBeVisible({ timeout: 10_000 });

    // 3) ACK 버튼 클릭 — fixture 의 ACK 버튼 (해당 행에서)
    const row = page.locator("tr", { hasText: "D27 E2E fixture L2" });
    await row.getByRole("button", { name: /확인 \(ACK\)/ }).click();

    // ACK 완료 검증 — server action + router.refresh 가 끝날 때까지 대기.
    // PENDING 필터에서는 ACK 후 해당 행이 사라지거나 status pill 이 사라짐.
    // useTransition 비동기 race 회피: 행의 ACK 버튼이 더 이상 안 보일 때까지 대기 (PENDING 필터 해제 시) 또는
    // 상태 변경된 행을 다시 조회하기 위해 필터 없이 재진입.
    await expect(row.getByRole("button", { name: /확인 \(ACK\)/ })).toHaveCount(0, {
      timeout: 15_000,
    });

    // 4) DB 검증 — 추가로 polling 으로 status 확정 대기 (router.refresh + server action 완료 보장)
    let updated: { status: string; acknowledgedAt: Date | null; acknowledgedById: string | null } | null = null;
    const dbDeadline = Date.now() + 10_000;
    while (Date.now() < dbDeadline) {
      updated = await prisma.riskFlag.findUniqueOrThrow({
        where: { id: fixture.id },
        select: {
          status: true,
          acknowledgedAt: true,
          acknowledgedById: true,
        },
      });
      if (updated.status === "ACKNOWLEDGED") break;
      await page.waitForTimeout(300);
    }
    expect(updated?.status).toBe("ACKNOWLEDGED");
    expect(updated?.acknowledgedAt).not.toBeNull();
    expect(updated?.acknowledgedById).not.toBeNull();

    // 5) audit-logs 진입 + ADMIN 권한 페이지 표시 (시드 + PERMISSION_DENIED 등)
    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("heading", { name: /감사 로그/ })).toBeVisible();
    // 5건 이상 표시 (시드 v1 의 5건 + W3 동안 누적)
    await expect(page.getByText(/결과 \(/).first()).toBeVisible();
  } finally {
    // cleanup
    await prisma.riskFlag.delete({ where: { id: fixture.id } }).catch(() => {});
  }
});

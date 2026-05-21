import { defineConfig, devices } from "@playwright/test";
import { config as dotenvConfig } from "dotenv";

// .env.local → .env 순으로 로드 (Prisma client / spec 양쪽에서 같은 DB 사용)
dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

/**
 * Day 14 — Playwright E2E config.
 *
 * - dev 서버를 reuse (기존 pnpm dev 가 떠 있으면 그대로 사용, 없으면 자동 시작)
 * - chromium 단일 프로젝트 (시연 환경 통일, CI 비용 절감)
 * - 순차 실행 (DB 상태 공유 — 병렬은 W3 격리된 fixture 도입 후)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

/**
 * 시드 v1 (Week 1 Day 5)
 *
 * 목표 (mindbridge-dev-plan.md Week 1):
 * - 가상 기업 1, 직원 50, 상담사 10, 전문의 3
 *
 * 현재 상태: 스켈레톤. Day 5 에 본격 작성.
 * - Faker 또는 정적 데이터로 빠르게 채움
 * - 케이스 텍스트 생성 방식 (Claude 사전 vs 매번)은 Day 5 결정
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] 시작 — Week 0 시점에는 본문 미구현");
  console.log("[seed] Day 5 에 가상 기업·직원·상담사·전문의·카테고리 시드 작성 예정");

  // TODO Day 5: 시드 본문
  // - Category 마스터 (우울/불안/번아웃/관계/수면 등 8~10 종)
  // - Company 1 + Department 3
  // - User × 50 (EMPLOYEE) + Department 분산
  // - User × 10 + Counselor 프로필 + CounselorCategory M:N
  // - User × 3 (PSYCHIATRIST)
  // - User × 2 (HR), 1 (ADMIN)
  // - Subscription 1 (Company 기준, STANDARD plan)
  // - InviteCode 5장 (테스트용)
  // - Consent (각 User 별 SERVICE + SENSITIVE_DATA)
  // - AuditLog 샘플 (운영자 화면 검증용)
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

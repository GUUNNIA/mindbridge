/**
 * 시드 v0.5 — Week 1 Day 2 임시 시드
 *
 * 목적: 5롤 로그인 + 미들웨어 prefix 차단을 수동 검증할 최소 계정.
 * Day 5에 Company N + Department + 직원 50 + 상담사 10 + 전문의 3 등으로 본격 확장.
 *
 * 멱등: upsert 기반. 반복 실행해도 같은 결과.
 *
 * 주의:
 * - anonymizedId 는 임시로 randomUUID(). Day 5 에 BLAKE2b(id, salt) 정식 헬퍼로 백필.
 * - Counselor 프로필 row 는 Day 5 에 추가 (Day 2 는 미들웨어 검증만 필요).
 */

import { PrismaClient, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const SEED_PASSWORD = "testpass1234";

const ACCOUNTS: Array<{ email: string; role: UserRole; nickname: string }> = [
  { email: "employee@mindbridge.test", role: "EMPLOYEE", nickname: "직원1" },
  { email: "counselor@mindbridge.test", role: "COUNSELOR", nickname: "상담사1" },
  { email: "doctor@mindbridge.test", role: "PSYCHIATRIST", nickname: "전문의1" },
  { email: "hr@mindbridge.test", role: "HR", nickname: "HR1" },
  { email: "admin@mindbridge.test", role: "ADMIN", nickname: "운영자1" },
];

async function main() {
  console.log("[seed] Day 2 임시 시드 시작");

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    create: {
      id: COMPANY_ID,
      name: "MindBridge 데모기업",
      status: "ACTIVE",
      domain: "mindbridge.test",
      contactEmail: "ops@mindbridge.test",
    },
    update: {},
  });
  console.log(`[seed] Company: ${company.name} (${company.id})`);

  for (const acct of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: acct.email },
      create: {
        email: acct.email,
        passwordHash,
        role: acct.role,
        status: "ACTIVE",
        companyId: company.id,
        nickname: acct.nickname,
        anonymizedId: randomUUID(),
        emailVerifiedAt: new Date(),
      },
      update: {
        passwordHash,
        role: acct.role,
        status: "ACTIVE",
      },
    });
    console.log(`[seed] User: ${user.email} (${user.role})`);
  }

  console.log(`[seed] 완료. 비밀번호: ${SEED_PASSWORD} (5계정 공통)`);
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

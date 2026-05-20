import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const codes = await p.inviteCode.findMany({
    where: { usedAt: null, revokedAt: null },
    take: 5,
    select: { code: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const c of codes) {
    console.log(`  ${c.code}   (만료: ${c.expiresAt.toISOString().slice(0, 10)})`);
  }
  await p.$disconnect();
}
main();

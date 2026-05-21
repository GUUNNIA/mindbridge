import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listSessionMessages } from "@/lib/actions/session";
import { ChatRoom } from "./_components/chat-room";

/**
 * Day 15 — 세션룸 (직원·상담사 공유 라우트).
 *
 * roles 그룹 밖에 두는 이유: 동일 URL 로 두 역할이 같은 방에 들어옴.
 * 권한 검증은 페이지 내부에서 (Session.employeeId/counselorId 일치 여부).
 */

export default async function SessionRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/signin?from=/session/${id}`);

  const sessionRow = await prisma.session.findUnique({
    where: { id },
    include: {
      employee: { select: { nickname: true } },
      counselor: { select: { nickname: true } },
    },
  });
  if (!sessionRow) notFound();

  let myRole: "EMPLOYEE" | "COUNSELOR";
  let peerNickname: string;
  if (sessionRow.employeeId === session.user.id) {
    myRole = "EMPLOYEE";
    peerNickname = sessionRow.counselor.nickname ?? "상담사";
  } else if (sessionRow.counselorId === session.user.id) {
    myRole = "COUNSELOR";
    peerNickname = sessionRow.employee.nickname ?? "내담자";
  } else {
    redirect("/403");
  }

  const initial = await listSessionMessages({ sessionId: sessionRow.id });
  if (!initial.ok) {
    throw new Error(initial.error);
  }

  const homeHref = myRole === "EMPLOYEE" ? "/app" : "/counselor";

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{peerNickname} 님과의 세션</h1>
            <p className="text-xs text-muted-foreground">
              상태: {sessionRow.status} · 메시지는 AES-256-GCM 컬럼 암호화 적용
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={homeHref}>← 홈으로</Link>
          </Button>
        </header>

        <ChatRoom
          sessionId={sessionRow.id}
          myRole={myRole}
          peerNickname={peerNickname}
          initialMessages={initial.messages}
          initialStatus={sessionRow.status}
        />
      </div>
    </main>
  );
}

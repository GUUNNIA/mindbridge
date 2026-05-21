import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptField } from "@/lib/crypto/field";
import { AssessmentChat } from "./_components/chat";

export default async function AssessmentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "EMPLOYEE") redirect("/403");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { responses: { orderBy: { createdAt: "asc" } } },
  });
  if (!assessment || assessment.userId !== session.user.id) notFound();

  if (assessment.status === "COMPLETED") {
    redirect(`/app/assessment/${id}/result`);
  }

  return (
    <AssessmentChat
      assessmentId={id}
      initialMessages={assessment.responses.map((r) => ({
        id: r.id,
        role: r.role,
        content: decryptField(r.content, r.encKeyVersion) ?? "",
      }))}
    />
  );
}

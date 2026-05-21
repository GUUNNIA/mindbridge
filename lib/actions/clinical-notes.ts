"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { generateSoap, type SoapDraft } from "@/lib/ai/soap";
import { encryptField, decryptField } from "@/lib/crypto/field";

/**
 * 임상 노트 server actions (Day 17, PRD §6.1.1).
 *
 * - generateDraftFromMemo: 메모 1줄 + 세션 메시지 + 자가진단 요약을 generate_soap
 *   tool 에 넘겨 SOAP 4 field + 직원용 요약 + flags 반환 (DB 저장 안 함, 미리보기용)
 * - saveClinicalNote: 본인 담당 세션 검증 → ClinicalNote upsert. status DRAFT/FINALIZED.
 * - getClinicalNote(sessionId): 노트 조회. COUNSELOR 작성자 또는 EMPLOYEE 본인 (직원용
 *   요약만) 가능.
 *
 * Day 18 컬럼 암호화: subjective/objective/assessmentText/plan/summaryForEmployee
 * 평문 → enc 마이그레이션. encKeyVersion 보존.
 */

async function ensureCounselorOfSession(
  sessionId: string,
  counselorUserId: string,
): Promise<
  | { ok: true; session: { id: string; employeeId: string; counselorId: string } }
  | { ok: false; error: string }
> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, employeeId: true, counselorId: true, status: true },
  });
  if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };
  if (session.counselorId !== counselorUserId) {
    await prisma.auditLog.create({
      data: {
        actorId: counselorUserId,
        action: "PERMISSION_DENIED",
        resourceType: "ClinicalNote",
        resourceId: session.id,
        metadata: { reason: "not assigned counselor", at: "ensureCounselorOfSession" },
      },
    });
    return { ok: false, error: "본인 담당 세션이 아닙니다." };
  }
  return { ok: true, session };
}

export type GenerateDraftResult =
  | { ok: true; draft: SoapDraft; provider: "claude" | "mock" }
  | { ok: false; error: string };

export const generateDraftFromMemo = withAuth(
  { action: "create", subject: "ClinicalNote" },
  async (
    ctx,
    input: { sessionId: string; memo: string },
  ): Promise<GenerateDraftResult> => {
    const check = await ensureCounselorOfSession(input.sessionId, ctx.user.id);
    if (!check.ok) return { ok: false, error: check.error };

    // 세션 메시지 + 자가진단 요약 조회 (transcript context). D18 enc → decrypt 후 LLM 컨텍스트로
    const rawMessages = await prisma.sessionMessage.findMany({
      where: { sessionId: input.sessionId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, encKeyVersion: true },
      take: 200,
    });
    const messages = rawMessages.map((m) => ({
      role: m.role,
      content: decryptField(m.content, m.encKeyVersion) ?? "",
    }));
    const assessment = await prisma.assessment.findFirst({
      where: { userId: check.session.employeeId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: {
        summaryForCounselor: true,
        severity: true,
        primaryCategoryId: true,
      },
    });
    const categoryName = assessment?.primaryCategoryId
      ? (
          await prisma.category.findUnique({
            where: { id: assessment.primaryCategoryId },
            select: { name: true },
          })
        )?.name
      : null;

    const draft = await generateSoap(input.memo, {
      sessionMessages: messages,
      assessmentSummary: assessment?.summaryForCounselor ?? null,
      primaryCategory: categoryName ?? null,
      severity: assessment?.severity ?? null,
    });

    return {
      ok: true,
      draft,
      provider: process.env.ANTHROPIC_API_KEY ? "claude" : "mock",
    };
  },
);

const saveSchema = z.object({
  sessionId: z.string().min(1),
  subjective: z.string().max(1200).optional().default(""),
  objective: z.string().max(800).optional().default(""),
  assessmentText: z.string().max(800).optional().default(""),
  plan: z.string().max(800).optional().default(""),
  summaryForEmployee: z.string().max(400).optional().default(""),
  flags: z.array(z.string()).max(10).optional().default([]),
  status: z.enum(["DRAFT", "FINALIZED"]).default("DRAFT"),
});

export type SaveNoteResult =
  | { ok: true; noteId: string; status: "DRAFT" | "FINALIZED" }
  | { ok: false; error: string };

export const saveClinicalNote = withAuth(
  { action: "update", subject: "ClinicalNote" },
  async (ctx, input: z.infer<typeof saveSchema>): Promise<SaveNoteResult> => {
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    const check = await ensureCounselorOfSession(data.sessionId, ctx.user.id);
    if (!check.ok) return { ok: false, error: check.error };

    const isFinalize = data.status === "FINALIZED";
    const finalizedAt = isFinalize ? new Date() : null;

    // D18 컬럼 암호화 — SOAP 4 fields + 직원용 요약
    const encSubj = encryptField(data.subjective || null);
    const encObj = encryptField(data.objective || null);
    const encAssess = encryptField(data.assessmentText || null);
    const encPlan = encryptField(data.plan || null);
    const encSummary = encryptField(data.summaryForEmployee || null);

    const note = await prisma.clinicalNote.upsert({
      where: { sessionId: data.sessionId },
      create: {
        sessionId: data.sessionId,
        counselorId: ctx.user.id,
        employeeId: check.session.employeeId,
        subjective: encSubj.ciphertext,
        objective: encObj.ciphertext,
        assessmentText: encAssess.ciphertext,
        plan: encPlan.ciphertext,
        summaryForEmployee: encSummary.ciphertext,
        encKeyVersion: encSubj.encKeyVersion,
        flags: data.flags,
        status: data.status,
        finalizedAt,
      },
      update: {
        subjective: encSubj.ciphertext,
        objective: encObj.ciphertext,
        assessmentText: encAssess.ciphertext,
        plan: encPlan.ciphertext,
        summaryForEmployee: encSummary.ciphertext,
        encKeyVersion: encSubj.encKeyVersion,
        flags: data.flags,
        status: data.status,
        // FINALIZED → DRAFT 회귀는 일단 허용 (시연 단순화). V2 에 잠금 정책.
        finalizedAt: isFinalize ? new Date() : null,
      },
      select: { id: true, status: true },
    });

    return { ok: true, noteId: note.id, status: note.status };
  },
);

export interface ClinicalNoteView {
  id: string;
  sessionId: string;
  status: "DRAFT" | "FINALIZED";
  subjective: string | null;
  objective: string | null;
  assessmentText: string | null;
  plan: string | null;
  summaryForEmployee: string | null;
  flags: string[];
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
}

export const getClinicalNote = withAuth(
  { action: "read", subject: "ClinicalNote" },
  async (
    ctx,
    input: { sessionId: string },
  ): Promise<
    | { ok: true; note: ClinicalNoteView | null }
    | { ok: false; error: string }
  > => {
    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: { id: true, employeeId: true, counselorId: true },
    });
    if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

    const isCounselor = session.counselorId === ctx.user.id;
    const isEmployee = session.employeeId === ctx.user.id;
    if (!isCounselor && !isEmployee) {
      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          action: "PERMISSION_DENIED",
          resourceType: "ClinicalNote",
          resourceId: session.id,
          metadata: { reason: "not participant", at: "getClinicalNote" },
        },
      });
      return { ok: false, error: "이 세션의 참가자가 아닙니다." };
    }

    const note = await prisma.clinicalNote.findUnique({
      where: { sessionId: session.id },
    });
    if (!note) return { ok: true, note: null };

    // D18 — DB 평문 0건. 표시 직전 decrypt.
    const v = note.encKeyVersion;
    const decSubj = decryptField(note.subjective, v);
    const decObj = decryptField(note.objective, v);
    const decAssess = decryptField(note.assessmentText, v);
    const decPlan = decryptField(note.plan, v);
    const decSummary = decryptField(note.summaryForEmployee, v);

    return {
      ok: true,
      note: {
        id: note.id,
        sessionId: note.sessionId,
        status: note.status,
        // EMPLOYEE 는 직원용 요약만 (PRD §2.2). SOAP 4 field 는 null 처리.
        subjective: isCounselor ? decSubj : null,
        objective: isCounselor ? decObj : null,
        assessmentText: isCounselor ? decAssess : null,
        plan: isCounselor ? decPlan : null,
        summaryForEmployee: decSummary,
        flags: isCounselor ? note.flags : [],
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        finalizedAt: note.finalizedAt,
      },
    };
  },
);

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

// next-auth는 enforce 경로에선 호출 안 되지만, 모듈 로드 시 안전한 stub 제공
vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn().mockResolvedValue(null),
}));

import { enforce, ForbiddenError } from "@/lib/with-auth";
import { prisma } from "@/lib/db";

const create = prisma.auditLog.create as unknown as ReturnType<typeof vi.fn>;

describe("enforce — Server Action 권한 강제 + AuditLog 자동 기록 (Day 3 DoD)", () => {
  beforeEach(() => create.mockClear());

  it("EMPLOYEE → AuditLog 읽기 시도: ForbiddenError + AuditLog 1건", async () => {
    await expect(
      enforce(
        { id: "u-emp", role: "EMPLOYEE", email: "e@m.test", anonymizedId: "anon-emp" },
        { action: "read", subject: "AuditLog", resourceId: "any" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({
      actorId: "u-emp",
      action: "PERMISSION_DENIED",
      resourceType: "AuditLog",
      resourceId: "any",
    });
    expect(arg.data.metadata).toMatchObject({
      policy: { action: "read", subject: "AuditLog" },
    });
  });

  it("HR → ClinicalNote 읽기 시도: 거부 + AuditLog 기록", async () => {
    await expect(
      enforce(
        { id: "u-hr", role: "HR", email: "h@m.test", anonymizedId: "anon-hr" },
        { action: "read", subject: "ClinicalNote" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0][0] as any).data.resourceType).toBe("ClinicalNote");
    expect((create.mock.calls[0][0] as any).data.resourceId).toBe("n/a");
  });

  it("ADMIN → AuditLog 읽기 허용: AuditLog 기록 없음, ctx 반환", async () => {
    const ctx = await enforce(
      { id: "u-adm", role: "ADMIN", email: "a@m.test", anonymizedId: "anon-adm" },
      { action: "read", subject: "AuditLog" },
    );
    expect(ctx.user.role).toBe("ADMIN");
    expect(ctx.user.id).toBe("u-adm");
    expect(create).not.toHaveBeenCalled();
  });

  it("COUNSELOR → ClinicalNote 생성 허용: 기록 없음", async () => {
    const ctx = await enforce(
      { id: "u-cou", role: "COUNSELOR", email: "c@m.test", anonymizedId: "anon-cou" },
      { action: "create", subject: "ClinicalNote" },
    );
    expect(ctx.user.role).toBe("COUNSELOR");
    expect(create).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import { defineAbilityFor } from "@/lib/abilities";

const baseUser = { id: "u-1", companyId: "c-1" } as const;

describe("CASL abilities — 5롤별 권한 매트릭스 (PRD §2.2)", () => {
  it("EMPLOYEE: 본인 자가진단 R/W, AuditLog/HRReport 거부", () => {
    const a = defineAbilityFor({ ...baseUser, role: "EMPLOYEE" });
    expect(a.can("read", "OwnAssessment")).toBe(true);
    expect(a.can("update", "OwnAssessment")).toBe(true);
    expect(a.can("read", "AuditLog")).toBe(false);
    expect(a.can("read", "HRReport")).toBe(false);
    expect(a.can("read", "Payout")).toBe(false);
  });

  it("COUNSELOR: ClinicalNote/Session R/W, AuditLog/HRReport 거부", () => {
    const a = defineAbilityFor({ ...baseUser, role: "COUNSELOR" });
    expect(a.can("read", "ClinicalNote")).toBe(true);
    expect(a.can("create", "ClinicalNote")).toBe(true);
    expect(a.can("read", "Session")).toBe(true);
    expect(a.can("read", "Payout")).toBe(true);
    expect(a.can("read", "AuditLog")).toBe(false);
    expect(a.can("read", "HRReport")).toBe(false);
  });

  it("PSYCHIATRIST: ClinicalNote R, AuditLog/HRReport 거부", () => {
    const a = defineAbilityFor({ ...baseUser, role: "PSYCHIATRIST" });
    expect(a.can("read", "ClinicalNote")).toBe(true);
    expect(a.can("update", "ClinicalNote")).toBe(false); // R only
    expect(a.can("read", "RiskAlert")).toBe(true);
    expect(a.can("read", "AuditLog")).toBe(false);
    expect(a.can("read", "HRReport")).toBe(false);
  });

  it("HR: HRReport R/W, ClinicalNote/Session/AuditLog 거부", () => {
    const a = defineAbilityFor({ ...baseUser, role: "HR" });
    expect(a.can("read", "HRReport")).toBe(true);
    expect(a.can("manage", "HRReport")).toBe(true);
    expect(a.can("create", "InviteCode")).toBe(true);
    expect(a.can("read", "ClinicalNote")).toBe(false);
    expect(a.can("read", "Session")).toBe(false);
    expect(a.can("read", "AuditLog")).toBe(false);
    expect(a.can("read", "Payout")).toBe(false);
  });

  it("ADMIN: manage all + AuditLog R", () => {
    const a = defineAbilityFor({ ...baseUser, role: "ADMIN" });
    expect(a.can("read", "AuditLog")).toBe(true);
    expect(a.can("manage", "Counselor")).toBe(true);
    expect(a.can("manage", "Payout")).toBe(true);
    expect(a.can("manage", "RiskAlert")).toBe(true);
  });
});

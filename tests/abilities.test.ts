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

  it("EMPLOYEE: CounselorRecommendation R/Create 허용, Counselor 직접 read 거부", () => {
    const a = defineAbilityFor({ ...baseUser, role: "EMPLOYEE" });
    expect(a.can("read", "CounselorRecommendation")).toBe(true);
    expect(a.can("create", "CounselorRecommendation")).toBe(true);
    expect(a.can("read", "Counselor")).toBe(false);
  });

  it("HR: CounselorRecommendation 거부 (개인 식별 자원 접근 금지)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "HR" });
    expect(a.can("read", "CounselorRecommendation")).toBe(false);
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

  it("HR: InviteCode R/Create/Update 허용 (Day 13 revoke 포함)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "HR" });
    expect(a.can("read", "InviteCode")).toBe(true);
    expect(a.can("create", "InviteCode")).toBe(true);
    expect(a.can("update", "InviteCode")).toBe(true);
  });

  it("EMPLOYEE/COUNSELOR/PSYCHIATRIST: InviteCode 모든 액션 거부", () => {
    for (const role of ["EMPLOYEE", "COUNSELOR", "PSYCHIATRIST"] as const) {
      const a = defineAbilityFor({ ...baseUser, role });
      expect(a.can("read", "InviteCode")).toBe(false);
      expect(a.can("create", "InviteCode")).toBe(false);
      expect(a.can("update", "InviteCode")).toBe(false);
    }
  });

  it("EMPLOYEE: Session R/Update 허용 (Day 15 세션룸 입장·메시지)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "EMPLOYEE" });
    expect(a.can("read", "Session")).toBe(true);
    expect(a.can("update", "Session")).toBe(true);
  });

  it("COUNSELOR: Session R/Update 허용", () => {
    const a = defineAbilityFor({ ...baseUser, role: "COUNSELOR" });
    expect(a.can("read", "Session")).toBe(true);
    expect(a.can("update", "Session")).toBe(true);
  });

  it("HR: Session 모든 액션 거부 (개인 식별 자원)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "HR" });
    expect(a.can("read", "Session")).toBe(false);
    expect(a.can("update", "Session")).toBe(false);
  });

  it("ADMIN: manage all + AuditLog R", () => {
    const a = defineAbilityFor({ ...baseUser, role: "ADMIN" });
    expect(a.can("read", "AuditLog")).toBe(true);
    expect(a.can("manage", "Counselor")).toBe(true);
    expect(a.can("manage", "Payout")).toBe(true);
    expect(a.can("manage", "RiskAlert")).toBe(true);
  });
});

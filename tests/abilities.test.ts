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

  it("COUNSELOR: Booking R + CaseAssessment R 허용 (Day 16 본인 담당 케이스)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "COUNSELOR" });
    expect(a.can("read", "Booking")).toBe(true);
    expect(a.can("read", "CaseAssessment")).toBe(true);
    expect(a.can("create", "Booking")).toBe(false); // 상담사는 본인이 예약 생성 안 함
  });

  it("EMPLOYEE/HR/PSYCHIATRIST: CaseAssessment 거부 (상담사 view 자원)", () => {
    for (const role of ["EMPLOYEE", "HR", "PSYCHIATRIST"] as const) {
      const a = defineAbilityFor({ ...baseUser, role });
      expect(a.can("read", "CaseAssessment")).toBe(false);
    }
  });

  it("ADMIN: manage all + AuditLog R", () => {
    const a = defineAbilityFor({ ...baseUser, role: "ADMIN" });
    expect(a.can("read", "AuditLog")).toBe(true);
    expect(a.can("manage", "Counselor")).toBe(true);
    expect(a.can("manage", "Payout")).toBe(true);
    expect(a.can("manage", "RiskAlert")).toBe(true);
  });

  // D20 — Escalation subject 5롤 cross-check.
  // 새 subject 도입 시 5롤 cross-check 필수 (이전 D10·D11 회귀 학습).
  it("PSYCHIATRIST: Escalation R/Update 허용 (큐 + 사인오프)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "PSYCHIATRIST" });
    expect(a.can("read", "Escalation")).toBe(true);
    expect(a.can("update", "Escalation")).toBe(true);
    expect(a.can("create", "Escalation")).toBe(false); // 생성은 system (assessAndFlag) 만
    expect(a.can("delete", "Escalation")).toBe(false);
  });

  it("ADMIN: Escalation manage 허용 (전체 모니터링)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "ADMIN" });
    expect(a.can("manage", "Escalation")).toBe(true);
    expect(a.can("read", "Escalation")).toBe(true);
    expect(a.can("update", "Escalation")).toBe(true);
  });

  it("EMPLOYEE/COUNSELOR/HR: Escalation 모든 액션 거부", () => {
    for (const role of ["EMPLOYEE", "COUNSELOR", "HR"] as const) {
      const a = defineAbilityFor({ ...baseUser, role });
      expect(a.can("read", "Escalation")).toBe(false);
      expect(a.can("update", "Escalation")).toBe(false);
      expect(a.can("create", "Escalation")).toBe(false);
    }
  });

  // D21 — Feedback subject 5롤 cross-check.
  it("EMPLOYEE: Feedback R/Create 허용 (본인 세션에 한해, 자원 단위 격리는 server action)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "EMPLOYEE" });
    expect(a.can("read", "Feedback")).toBe(true);
    expect(a.can("create", "Feedback")).toBe(true);
    expect(a.can("update", "Feedback")).toBe(false); // 작성 후 수정 불가 (V1)
    expect(a.can("delete", "Feedback")).toBe(false);
  });

  it("COUNSELOR: Feedback R 허용 (본인 받은 집계만, 자원 단위는 server action)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "COUNSELOR" });
    expect(a.can("read", "Feedback")).toBe(true);
    expect(a.can("create", "Feedback")).toBe(false);
    expect(a.can("update", "Feedback")).toBe(false);
  });

  it("ADMIN: Feedback manage 허용 (운영자 품질 모니터링)", () => {
    const a = defineAbilityFor({ ...baseUser, role: "ADMIN" });
    expect(a.can("manage", "Feedback")).toBe(true);
    expect(a.can("read", "Feedback")).toBe(true);
  });

  it("HR/PSYCHIATRIST: Feedback 모든 액션 거부 (개인 식별·임상 외 자원)", () => {
    for (const role of ["HR", "PSYCHIATRIST"] as const) {
      const a = defineAbilityFor({ ...baseUser, role });
      expect(a.can("read", "Feedback")).toBe(false);
      expect(a.can("create", "Feedback")).toBe(false);
      expect(a.can("update", "Feedback")).toBe(false);
    }
  });
});

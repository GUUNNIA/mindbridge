import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { UserRole } from "@prisma/client";

/**
 * CASL 권한 정의 — PRD §2.2 권한 매트릭스 기반.
 *
 * 자원 단위 조건(예: 담당 케이스만, 본인 정산만)은 W2/W3 엔티티가 들어올 때
 * conditions 로 보강. Day 3 은 액션·자원 매트릭스의 뼈대만 정의.
 */

export type AppAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "manage";

export type AppSubject =
  // W1 P0
  | "User"
  | "Company"
  | "Department"
  | "Subscription"
  | "InviteCode"
  | "Consent"
  | "Counselor"
  | "CounselorRecommendation"
  | "AuditLog"
  // W2/W3/W4 placeholder (실제 모델은 추후 마이그레이션에서 추가)
  | "OwnAssessment"
  | "Session"
  | "ClinicalNote"
  | "Booking"
  | "Payout"
  | "RiskAlert"
  | "HRReport"
  | "Notification"
  | "all";

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

export interface AbilityUser {
  id: string;
  role: UserRole;
  companyId?: string | null;
}

export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case "ADMIN": {
      // 운영자: 거의 모든 자원 R/W + 감사 로그 R
      can("manage", "all");
      // 단, 본인 정산만 (자원 조건은 W3 에 보강)
      break;
    }

    case "HR": {
      // 익명 집계만, 개인 식별 자원 접근 금지
      can("read", "HRReport");
      can("manage", "HRReport");
      can("read", "Notification");
      can(["create", "read"], "InviteCode");
      // 정산·임상 노트·세션은 명시적 미허용
      break;
    }

    case "PSYCHIATRIST": {
      can("read", "Session"); // 에스컬레이션 케이스만 — W3 conditions 보강
      can("update", "Session");
      can("read", "ClinicalNote");
      can("read", "RiskAlert");
      can("read", "Payout"); // 본인 — W3 conditions 보강
      break;
    }

    case "COUNSELOR": {
      can("read", "Session");
      can("update", "Session");
      can(["read", "create", "update"], "ClinicalNote"); // 담당 케이스만 — W3 conditions
      can("read", "RiskAlert");
      can("read", "Payout");
      can("read", "Counselor");
      can("update", "Counselor"); // 본인 프로필
      break;
    }

    case "EMPLOYEE": {
      can(["read", "create", "update"], "OwnAssessment");
      can(["read", "create"], "CounselorRecommendation");
      can("read", "Session"); // 본인 세션
      can("read", "ClinicalNote"); // 직원용 요약만 — W3 conditions
      can("create", "Booking");
      can("read", "Booking");
      can(["read", "create"], "Consent");
      break;
    }
  }

  return build();
}

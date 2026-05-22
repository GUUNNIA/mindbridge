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
  | "CaseAssessment"
  | "AuditLog"
  // W2/W3/W4 placeholder (실제 모델은 추후 마이그레이션에서 추가)
  | "OwnAssessment"
  | "Session"
  | "ClinicalNote"
  | "Booking"
  | "Payout"
  | "RiskAlert"
  | "Escalation"
  | "Feedback"
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
      // 본인 정산만 (자원 조건은 W3 에 보강)
      // AuditLog 는 manage:all 로 통과하지만 D25 에서 명시적으로 read 표기 (가독성)
      can("read", "AuditLog");
      break;
    }

    case "HR": {
      // 익명 집계만, 개인 식별 자원 접근 금지
      can("read", "HRReport");
      can("manage", "HRReport");
      can("read", "Notification");
      can(["create", "read", "update"], "InviteCode");
      // 정산·임상 노트·세션은 명시적 미허용
      break;
    }

    case "PSYCHIATRIST": {
      can("read", "Session"); // 에스컬레이션 케이스만 — W3 conditions 보강
      can("update", "Session");
      can("read", "ClinicalNote");
      can("read", "RiskAlert");
      can("read", "Payout"); // 본인 — W3 conditions 보강
      // D20: 에스컬레이션 큐 read + 사인오프 update. 본인 큐 필터·
      // 자원 단위 격리는 server action 에서 reviewerId 검증.
      can("read", "Escalation");
      can("update", "Escalation");
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
      // D16: 본인 담당 booking·자가진단 요약 read (자원 단위 필터는 server action 에서 booking.counselorId 검증)
      can("read", "Booking");
      can("read", "CaseAssessment");
      // D21: 본인 받은 피드백 집계만 read (코멘트 개별 노출은 V2). 자원 단위 격리는
      // server action 에서 counselorId === ctx.user.id 검증.
      can("read", "Feedback");
      break;
    }

    case "EMPLOYEE": {
      can(["read", "create", "update"], "OwnAssessment");
      can(["read", "create"], "CounselorRecommendation");
      can(["read", "update"], "Session"); // 본인 세션 (update = 입장·메시지 발송·종료)
      can("read", "ClinicalNote"); // 직원용 요약만 — W3 conditions
      can("create", "Booking");
      can("read", "Booking");
      can(["read", "create"], "Consent");
      // D21: 본인 세션에 한해 피드백 작성·열람. 자원 단위 격리는 server action
      // 에서 session.employeeId === ctx.user.id 검증.
      can(["read", "create"], "Feedback");
      break;
    }
  }

  return build();
}

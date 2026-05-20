import { createHash } from "node:crypto";

/**
 * User.anonymizedId 생성기 (PRD §7.3 / line 460: anonymizedId = BLAKE2b(realId, salt)).
 *
 * - 입력: user 실제 id + 환경변수 ANONYMIZATION_SALT
 * - 출력: base64url 22자 (~132bit)
 * - 같은 입력 → 같은 출력 (재현 가능)
 * - salt 변경 시 모든 익명 ID 가 무효화되므로 salt 변경 금지
 *
 * V1: 단일 salt. salt 회전·재해시는 V2 (User.encKeyVersion 패턴 차용 가능).
 */
export function anonymizeId(realId: string, salt: string): string {
  if (!salt) {
    throw new Error("anonymizeId: salt is empty (ANONYMIZATION_SALT not set)");
  }
  return createHash("blake2b512")
    .update(`${realId}:${salt}`)
    .digest("base64url")
    .slice(0, 22);
}

/** 환경변수에서 salt를 읽고 anonymizeId 호출. seed·앱 코드 양쪽에서 편하게 쓰는 진입점. */
export function anonymizeIdFromEnv(realId: string): string {
  return anonymizeId(realId, process.env.ANONYMIZATION_SALT ?? "");
}

import crypto from "node:crypto";

/**
 * 앱 레이어 컬럼 암호화 (Day 18, 기획안 §5.7).
 *
 * AES-256-GCM. IV per row (12 bytes), AuthTag (16 bytes).
 * 저장 포맷: base64(iv || ciphertext || authTag) → DB 의 String 컬럼에 그대로.
 *
 * 키 관리:
 *   - ENCRYPTION_KEY_V<n> 환경변수에서 32 bytes base64 로 로드
 *   - encKeyVersion 컬럼이 row 별 어느 키로 암호화됐는지 추적 (회전 대비)
 *   - V1 단일 키. 회전·rewrap 은 V2.
 *
 * 적용 대상 (D18):
 *   - SessionMessage.content
 *   - ClinicalNote.{subjective, objective, assessmentText, plan, summaryForEmployee}
 *   - AssessmentResponse.content  (기획안의 Assessment.transcript)
 *   - User.realName, User.phone   (시드에 없음 — 후속 가입자만)
 *
 * 호출 측 책임:
 *   - DB 쓰기 직전 encryptField(plaintext, keyVersion)
 *   - DB 읽기 직후 decryptField(stored, encKeyVersion)
 *   - SQL 직접 조회(psql 등) 시 평문 0건이어야 한다 — DoD §5.7
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CURRENT_KEY_VERSION = 1;

function getKey(version: number): Buffer {
  const envName = `ENCRYPTION_KEY_V${version}`;
  const b64 = process.env[envName];
  if (!b64) {
    throw new Error(
      `[crypto] ${envName} 환경변수가 없습니다. .env.local 에 32 bytes base64 키를 설정해 주세요.`,
    );
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `[crypto] ${envName} 는 32 bytes base64 여야 합니다 (현재 ${buf.length} bytes).`,
    );
  }
  return buf;
}

export interface EncryptResult {
  ciphertext: string | null;
  encKeyVersion: number;
}

/**
 * 평문 → 암호문. null 은 null 그대로, 빈 문자열은 빈 문자열 그대로 (인덱스 영향 회피).
 */
export function encryptField(
  plaintext: string | null | undefined,
  keyVersion: number = CURRENT_KEY_VERSION,
): EncryptResult {
  if (plaintext == null) return { ciphertext: null, encKeyVersion: keyVersion };
  if (plaintext === "") return { ciphertext: "", encKeyVersion: keyVersion };

  const key = getKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, ciphertext, authTag]);
  return {
    ciphertext: packed.toString("base64"),
    encKeyVersion: keyVersion,
  };
}

/**
 * 암호문 → 평문. encKeyVersion 으로 적절한 키 선택.
 * null/빈 문자열 그대로 통과.
 */
export function decryptField(
  packedBase64: string | null | undefined,
  encKeyVersion: number,
): string | null {
  if (packedBase64 == null) return null;
  if (packedBase64 === "") return "";

  const key = getKey(encKeyVersion);
  const packed = Buffer.from(packedBase64, "base64");
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("[crypto] 암호문 길이 부족 — 형식 오류.");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export const currentKeyVersion = CURRENT_KEY_VERSION;

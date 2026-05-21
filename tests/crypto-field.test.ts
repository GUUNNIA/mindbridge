import { beforeAll, describe, it, expect } from "vitest";
import crypto from "node:crypto";

import { encryptField, decryptField, currentKeyVersion } from "@/lib/crypto/field";

/**
 * AES-256-GCM 컬럼 암호화 round-trip 검증 (Day 18).
 *
 * 환경변수 누락 시 자동 fallback — vitest 시작 전에 32 bytes 키 주입.
 */

beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY_V1) {
    process.env.ENCRYPTION_KEY_V1 = crypto.randomBytes(32).toString("base64");
  }
});

describe("encryptField/decryptField — round-trip", () => {
  it("일반 한국어 문자열 — 평문 ↔ 암호문 round-trip", () => {
    const plain = "내담자가 수면 부족·업무 압박을 호소합니다.";
    const enc = encryptField(plain);
    expect(enc.ciphertext).not.toBe(plain);
    expect(enc.encKeyVersion).toBe(currentKeyVersion);
    expect(decryptField(enc.ciphertext, enc.encKeyVersion)).toBe(plain);
  });

  it("null → null 통과", () => {
    expect(encryptField(null).ciphertext).toBe(null);
    expect(decryptField(null, 1)).toBe(null);
  });

  it("undefined → null 통과", () => {
    expect(encryptField(undefined).ciphertext).toBe(null);
  });

  it("빈 문자열 → 빈 문자열 통과 (인덱스 영향 회피)", () => {
    expect(encryptField("").ciphertext).toBe("");
    expect(decryptField("", 1)).toBe("");
  });

  it("같은 평문 2회 암호화 → 다른 ciphertext (IV randomness)", () => {
    const a = encryptField("동일 평문");
    const b = encryptField("동일 평문");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(decryptField(a.ciphertext, a.encKeyVersion)).toBe("동일 평문");
    expect(decryptField(b.ciphertext, b.encKeyVersion)).toBe("동일 평문");
  });

  it("긴 SOAP 본문 (수천 byte) 도 round-trip", () => {
    const long = "긴 임상 노트 내용. ".repeat(500); // ~10KB
    const enc = encryptField(long);
    expect(decryptField(enc.ciphertext, enc.encKeyVersion)).toBe(long);
  });

  it("암호문 변조 시 GCM auth tag 검증 실패 (decrypt throw)", () => {
    const enc = encryptField("원본 평문");
    if (!enc.ciphertext) throw new Error("ciphertext null");
    // 마지막 1 byte 변조 (authTag 영역)
    const tampered = Buffer.from(enc.ciphertext, "base64");
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptField(tampered.toString("base64"), enc.encKeyVersion)).toThrow();
  });

  it("잘못된 키 버전 → 환경변수 없음 throw", () => {
    expect(() => encryptField("test", 99)).toThrow(/ENCRYPTION_KEY_V99/);
  });

  it("encKeyVersion 컬럼이 row 별 추적 정보로 저장됨 (회전 대비)", () => {
    const enc = encryptField("test", 1);
    expect(enc.encKeyVersion).toBe(1);
  });
});

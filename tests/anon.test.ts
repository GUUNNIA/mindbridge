import { describe, it, expect } from "vitest";
import { anonymizeId } from "@/lib/anon";

const SALT = "test-salt-do-not-use-in-prod";

describe("anonymizeId — BLAKE2b 기반 익명 ID", () => {
  it("같은 (id, salt) → 같은 결과 (재현 가능)", () => {
    const a = anonymizeId("user-1", SALT);
    const b = anonymizeId("user-1", SALT);
    expect(a).toBe(b);
  });

  it("다른 id → 다른 결과", () => {
    const a = anonymizeId("user-1", SALT);
    const b = anonymizeId("user-2", SALT);
    expect(a).not.toBe(b);
  });

  it("다른 salt → 다른 결과 (salt 변경 시 모든 익명 ID 무효)", () => {
    const a = anonymizeId("user-1", SALT);
    const b = anonymizeId("user-1", "other-salt");
    expect(a).not.toBe(b);
  });

  it("출력은 base64url 22자 (~132bit)", () => {
    const out = anonymizeId("user-1", SALT);
    expect(out).toHaveLength(22);
    expect(out).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("salt 누락 시 throw", () => {
    expect(() => anonymizeId("user-1", "")).toThrow(/salt is empty/);
  });
});

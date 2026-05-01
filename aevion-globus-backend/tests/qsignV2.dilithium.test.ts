import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests Dilithium primitives in two modes:
 *   PREVIEW (default) — env unset → SHA-512 fingerprint, 128 hex.
 *   REAL              — QSIGN_DILITHIUM_V1_SEED set → real ML-DSA-65,
 *                       backed by @noble/post-quantum.
 *
 * Module is reloaded per-test via vi.resetModules() so the realKeypairCache
 * doesn't leak across cases. Real-mode tests are slow (~10ms each) due to
 * actual ML-DSA keygen + sign + verify.
 */

const ORIGINAL_SEED = process.env.QSIGN_DILITHIUM_V1_SEED;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_SEED === undefined) delete process.env.QSIGN_DILITHIUM_V1_SEED;
  else process.env.QSIGN_DILITHIUM_V1_SEED = ORIGINAL_SEED;
});

describe("qsignV2 dilithium — preview mode (env unset)", () => {
  it("signDilithium returns 128-hex SHA-512 with preview kid", async () => {
    delete process.env.QSIGN_DILITHIUM_V1_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const r = await m.signDilithium('{"hello":"world"}');
    expect(r.mode).toBe("preview");
    expect(r.kid).toBe(m.DILITHIUM_KID_PREVIEW);
    expect(r.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(r.publicKey).toBeUndefined();
  });

  it("signDilithium is deterministic in preview mode", async () => {
    delete process.env.QSIGN_DILITHIUM_V1_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const a = await m.signDilithium('{"x":1}');
    const b = await m.signDilithium('{"x":1}');
    expect(a.signature).toBe(b.signature);
  });

  it("verifyDilithium returns valid=true for matching preview digest", async () => {
    delete process.env.QSIGN_DILITHIUM_V1_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const r = await m.signDilithium('{"k":1}');
    const v = await m.verifyDilithium('{"k":1}', r.signature);
    expect(v.valid).toBe(true);
    expect(v.mode).toBe("preview");
  });

  it("verifyDilithium returns valid=false for tampered preview digest", async () => {
    delete process.env.QSIGN_DILITHIUM_V1_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const r = await m.signDilithium('{"k":1}');
    const v = await m.verifyDilithium('{"k":2}', r.signature);
    expect(v.valid).toBe(false);
  });

  it("getActiveDilithium returns null when env unset", async () => {
    delete process.env.QSIGN_DILITHIUM_V1_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    expect(await m.getActiveDilithium()).toBeNull();
  });

  it("getActiveDilithium returns null on malformed seed (not 64 hex)", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = "not-hex-bad-length";
    const m = await import("../src/lib/qsignV2/dilithium");
    expect(await m.getActiveDilithium()).toBeNull();
  });
});

describe("qsignV2 dilithium — real mode (env set)", () => {
  // Deterministic 32-byte seed for reproducible test keys.
  const TEST_SEED = "0000000000000000000000000000000000000000000000000000000000000001";

  it("getActiveDilithium derives a keypair when seed is set", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const kp = await m.getActiveDilithium();
    expect(kp).not.toBeNull();
    expect(kp!.kid).toBe(m.DILITHIUM_KID_REAL);
    expect(kp!.publicKey.length).toBe(1952);
    expect(kp!.secretKey.length).toBe(4032);
  });

  it("signDilithium returns ~6618-hex real signature with real kid", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const r = await m.signDilithium('{"hello":"AEVION"}');
    expect(r.mode).toBe("real");
    expect(r.kid).toBe(m.DILITHIUM_KID_REAL);
    expect(r.signature.length).toBe(m.DILITHIUM_REAL_HEX_LEN);
    expect(r.signature).toMatch(/^[0-9a-f]+$/);
    expect(r.publicKey).toBeDefined();
    expect(r.publicKey!.length).toBe(1952 * 2);
  });

  it("real ML-DSA-65 sign/verify round-trip", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const canonical = '{"order":42,"ts":1714000000}';
    const r = await m.signDilithium(canonical);
    const v = await m.verifyDilithium(canonical, r.signature);
    expect(v.valid).toBe(true);
    expect(v.mode).toBe("real");
  });

  it("real ML-DSA-65 verify rejects tampered canonical", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const r = await m.signDilithium('{"k":"v"}');
    const v = await m.verifyDilithium('{"k":"vv"}', r.signature);
    expect(v.valid).toBe(false);
    expect(v.mode).toBe("real");
  });

  it("verifyDilithium auto-detects preview vs real by length", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    // Preview-length sig (128 hex) → preview path even with seed set
    const previewSig = "a".repeat(128);
    const v1 = await m.verifyDilithium("anything", previewSig);
    expect(v1.mode).toBe("preview");
    expect(v1.valid).toBe(false); // wrong digest, but path is preview
    // Real-length sig
    const r = await m.signDilithium('{"q":1}');
    expect(r.signature.length).toBe(m.DILITHIUM_REAL_HEX_LEN);
    const v2 = await m.verifyDilithium('{"q":1}', r.signature);
    expect(v2.mode).toBe("real");
  });

  it("real-mode signature is non-deterministic (different sigs for same payload)", async () => {
    process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;
    const m = await import("../src/lib/qsignV2/dilithium");
    const a = await m.signDilithium('{"x":7}');
    const b = await m.signDilithium('{"x":7}');
    // Both must verify but signatures may differ (FIPS 204 randomized variant).
    const va = await m.verifyDilithium('{"x":7}', a.signature);
    const vb = await m.verifyDilithium('{"x":7}', b.signature);
    expect(va.valid).toBe(true);
    expect(vb.valid).toBe(true);
  });
});

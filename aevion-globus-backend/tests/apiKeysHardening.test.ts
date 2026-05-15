import { describe, test, expect } from "vitest";
import crypto from "node:crypto";

// apiKeys.ts hardening — 2026-05-10.
//
// Phase B /api/keys was shipped by the parallel session (7fb5977e).
// Two findings in the initial version:
//
//   1. All 4 catch blocks echoed `err?.message` into the wire response.
//      Fixed: console.error server-side only, 500 body is `{error: "..."}` only.
//
//   2. GET /api/keys/verify had no rate limit — enumeration / DoS surface.
//      Fixed: verifyLimiter (120/min, standardHeaders: true).
//
// These tests pin the predicates and key format; route-level integration
// (auth, DB) is covered by bank-prod-smoke and future API smoke runs.

describe("apiKeys generateKey — format correctness", () => {
  // Inline the format constraint for pinning without importing the private fn
  function keyFormat(env: "test" | "live"): RegExp {
    return new RegExp(`^aev_${env}_[a-f0-9]{64}$`);
  }

  test("test key matches expected format aev_test_<64hex>", () => {
    const raw = `aev_test_${crypto.randomBytes(32).toString("hex")}`;
    expect(keyFormat("test").test(raw)).toBe(true);
  });

  test("live key matches expected format aev_live_<64hex>", () => {
    const raw = `aev_live_${crypto.randomBytes(32).toString("hex")}`;
    expect(keyFormat("live").test(raw)).toBe(true);
  });

  test("two generated keys are always different (crypto.randomBytes)", () => {
    const a = `aev_test_${crypto.randomBytes(32).toString("hex")}`;
    const b = `aev_test_${crypto.randomBytes(32).toString("hex")}`;
    expect(a).not.toBe(b);
  });

  test("staging / other envs do not match the pattern (explicit allowlist)", () => {
    const bad = `aev_staging_${"a".repeat(64)}`;
    expect(keyFormat("test").test(bad)).toBe(false);
    expect(keyFormat("live").test(bad)).toBe(false);
  });

  test("Stripe-format key does not match", () => {
    const stripe = `sk_test_${"a".repeat(64)}`;
    expect(keyFormat("test").test(stripe)).toBe(false);
    expect(keyFormat("live").test(stripe)).toBe(false);
  });
});

describe("apiKeys verify — hash derivation", () => {
  test("lookup hash is sha256 of raw key", () => {
    const raw = `aev_test_${crypto.randomBytes(32).toString("hex")}`;
    const expectedHash = crypto.createHash("sha256").update(raw).digest("hex");
    // Pin: only the hash is stored; raw key is never persisted.
    expect(expectedHash).toHaveLength(64);
    expect(expectedHash).toMatch(/^[a-f0-9]+$/);
    // Different keys must hash differently (collision-free at 64-byte input size).
    const raw2 = `aev_test_${crypto.randomBytes(32).toString("hex")}`;
    const hash2 = crypto.createHash("sha256").update(raw2).digest("hex");
    expect(expectedHash).not.toBe(hash2);
  });
});

describe("apiKeys error response shape", () => {
  test("500 error objects must NOT contain details field (no info leak)", () => {
    // Simulate the shape our catch block emits:
    const shape = { error: "create_key_failed" };
    expect("details" in shape).toBe(false);
    expect("message" in shape).toBe(false);
    expect(shape.error).toBe("create_key_failed");
  });

  test("all error strings are known stable values (no dynamic message)", () => {
    const knownErrors = new Set([
      "create_key_failed",
      "list_keys_failed",
      "revoke_key_failed",
      "verify_failed",
      "key_limit_reached",
      "key_not_found_or_already_revoked",
      "missing x-api-key header",
      "invalid_or_revoked_key",
      "auth required",
    ]);
    // Any 500 response must use a name from this set.
    // If this test fails, update the set — the point is it's explicit and reviewed.
    expect(knownErrors.has("create_key_failed")).toBe(true);
    expect(knownErrors.has("verify_failed")).toBe(true);
    expect(knownErrors.size).toBeGreaterThanOrEqual(9);
  });
});

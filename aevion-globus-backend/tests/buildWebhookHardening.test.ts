import { describe, test, expect } from "vitest";
import crypto from "node:crypto";

// Build module Tier 3 hardening — 2026-05-09.
//
// Two findings in src/routes/build/:
//
//   1. applications.ts:175 — outbound application webhook signed with
//      `process.env.BUILD_PAYMENT_WEBHOOK_SECRET ?? ""`. Empty-string fallback
//      means anyone with the OSS source could compute a valid HMAC for our
//      outbound payload and the receiver would accept it. Fixed: skip the
//      outbound POST entirely when secret is unset.
//
//   2. billing.ts:274 (/api/build/webhooks/payment) — HMAC verify computed
//      over `JSON.stringify(req.body ?? {})` instead of req.rawBody. Same bug
//      we fixed in Bureau. Fixed: switched to req.rawBody with JSON.stringify
//      fallback only when rawBody is unavailable.
//
// These tests pin the predicates; route-level integration is covered by
// build smoke + future bank-prod-smoke runs.

// Outbound predicate — fix #1
function shouldSendApplicationWebhook(env: NodeJS.ProcessEnv): boolean {
  if (!env.BUILD_APPLICATION_WEBHOOK_URL) return false;
  const secret = (env.BUILD_PAYMENT_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return false;
  return true;
}

// Inbound HMAC verify — fix #2
function buildPaymentSignatureValid(secret: string, rawBody: string, sigHeader: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (sigHeader.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

describe("build outbound application webhook — fix #1", () => {
  test("skips when URL not configured", () => {
    expect(shouldSendApplicationWebhook({ BUILD_PAYMENT_WEBHOOK_SECRET: "x".repeat(32) })).toBe(false);
  });

  test("skips when secret is unset (was: would sign with empty string)", () => {
    expect(
      shouldSendApplicationWebhook({ BUILD_APPLICATION_WEBHOOK_URL: "https://partner.example.com/hook" }),
    ).toBe(false);
  });

  test("skips when secret is empty string", () => {
    expect(
      shouldSendApplicationWebhook({
        BUILD_APPLICATION_WEBHOOK_URL: "https://partner.example.com/hook",
        BUILD_PAYMENT_WEBHOOK_SECRET: "",
      }),
    ).toBe(false);
  });

  test("skips when secret is just whitespace", () => {
    expect(
      shouldSendApplicationWebhook({
        BUILD_APPLICATION_WEBHOOK_URL: "https://partner.example.com/hook",
        BUILD_PAYMENT_WEBHOOK_SECRET: "   ",
      }),
    ).toBe(false);
  });

  test("sends when both URL and secret are set", () => {
    expect(
      shouldSendApplicationWebhook({
        BUILD_APPLICATION_WEBHOOK_URL: "https://partner.example.com/hook",
        BUILD_PAYMENT_WEBHOOK_SECRET: "x".repeat(32),
      }),
    ).toBe(true);
  });
});

describe("build payment webhook — HMAC verify uses raw bytes (fix #2)", () => {
  const secret = "x".repeat(48);

  test("matching raw body + signature → valid", () => {
    const raw = '{"event":"payment.succeeded","orderId":"ord_123"}';
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    expect(buildPaymentSignatureValid(secret, raw, sig)).toBe(true);
  });

  test("mismatched signature → invalid", () => {
    const raw = '{"event":"payment.succeeded","orderId":"ord_123"}';
    expect(buildPaymentSignatureValid(secret, raw, "0".repeat(64))).toBe(false);
  });

  test("re-serialised body produces different signature than raw bytes", () => {
    // Sender's HTTP body has whitespace / formatting that JSON.parse +
    // JSON.stringify drops. The HMAC over each string is different. This is
    // why we MUST use req.rawBody (the literal bytes received) instead of
    // re-serialising req.body. Any deviation breaks signature checking.
    const senderRaw = '{ "event":"payment.succeeded",  "orderId" : "ord_123" }';
    const senderSig = crypto.createHmac("sha256", secret).update(senderRaw).digest("hex");
    const reSerialized = JSON.stringify(JSON.parse(senderRaw)); // collapses whitespace
    expect(senderRaw).not.toBe(reSerialized);
    const reSig = crypto.createHmac("sha256", secret).update(reSerialized).digest("hex");
    expect(senderSig).not.toBe(reSig);
    // Verifying sender sig against re-serialised body fails.
    expect(buildPaymentSignatureValid(secret, reSerialized, senderSig)).toBe(false);
    // Verifying sender sig against raw bytes succeeds.
    expect(buildPaymentSignatureValid(secret, senderRaw, senderSig)).toBe(true);
  });

  test("length-mismatch signature → invalid (timingSafeEqual would throw)", () => {
    expect(buildPaymentSignatureValid(secret, "{}", "deadbeef")).toBe(false);
  });

  test("non-hex signature → invalid (no crash)", () => {
    expect(buildPaymentSignatureValid(secret, "{}", "not-a-hex".padEnd(64, "z"))).toBe(false);
  });
});

// Timestamp replay-protection — fix #3 (added 2026-05-09).
// Without timestamp, a captured signed payload could be replayed forever.
// The header is optional so existing partners aren't broken; once they sign
// timestamps too, we can tighten via WEBHOOK_REQUIRE_HMAC=1.
function timestampWithinTolerance(tsHeader: string, nowSec: number, toleranceSec = 300): boolean {
  if (!tsHeader.trim()) return true; // no header → optional, allow
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= toleranceSec;
}

describe("build payment webhook — timestamp replay protection (fix #3)", () => {
  const now = 1_778_000_000;

  test("missing timestamp header → allowed (backwards compat)", () => {
    expect(timestampWithinTolerance("", now)).toBe(true);
  });

  test("recent timestamp → allowed", () => {
    expect(timestampWithinTolerance(String(now - 30), now)).toBe(true);
    expect(timestampWithinTolerance(String(now), now)).toBe(true);
    expect(timestampWithinTolerance(String(now + 30), now)).toBe(true);
  });

  test("timestamp 5 min ago → boundary allowed", () => {
    expect(timestampWithinTolerance(String(now - 300), now)).toBe(true);
  });

  test("timestamp 10 min ago → REJECTED (replay)", () => {
    expect(timestampWithinTolerance(String(now - 600), now)).toBe(false);
  });

  test("timestamp 1 day ago → REJECTED (replay)", () => {
    expect(timestampWithinTolerance(String(now - 86400), now)).toBe(false);
  });

  test("timestamp 10 min in future → REJECTED (clock skew or forge)", () => {
    expect(timestampWithinTolerance(String(now + 600), now)).toBe(false);
  });

  test("non-numeric timestamp → REJECTED", () => {
    expect(timestampWithinTolerance("not-a-number", now)).toBe(false);
    expect(timestampWithinTolerance("NaN", now)).toBe(false);
  });
});

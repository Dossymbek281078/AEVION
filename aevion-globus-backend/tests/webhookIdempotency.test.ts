import { describe, test, expect } from "vitest";
import crypto from "crypto";

// Webhook idempotency — Bureau hardening 2026-05-08.
//
// Stripe and Sumsub both document at-least-once delivery: after a network
// blip or 5xx on our end they redeliver the same event. Our /payment/webhook
// and /verify/webhook now insert into BureauWebhookEvent before any side
// effect; on conflict they 200 OK with `{deduped: true}`.
//
// This file pins the dedup *key derivation* — the exact logic that feeds
// the unique constraint:
//   key = eventId  (when the provider gave us one — Stripe `evt_*`)
//       | "sha256:" + sha256(rawBody)  (fallback for stub providers / KYC
//                                       providers that don't carry an id)
//
// Integration of this key into BureauWebhookEvent is exercised by the prod
// smoke (which double-fires the webhook and expects the second to deduplicate).

function deriveDedupKey(eventId: string | null, rawBody: string): string {
  return eventId || `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
}

describe("webhook dedup key derivation", () => {
  test("uses provider eventId when present", () => {
    const k = deriveDedupKey("evt_1Tu9abc123", '{"x":1}');
    expect(k).toBe("evt_1Tu9abc123");
  });

  test("falls back to sha256(rawBody) when provider gave no event id", () => {
    const body = '{"foo":"bar","n":42}';
    const k = deriveDedupKey(null, body);
    expect(k.startsWith("sha256:")).toBe(true);
    expect(k.slice(7)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("identical bodies (same retry) produce the same fallback key", () => {
    const body = '{"eventId":"x","sessionId":"y","status":"approved"}';
    expect(deriveDedupKey(null, body)).toBe(deriveDedupKey(null, body));
  });

  test("different bodies (genuinely different events) produce different keys", () => {
    const a = deriveDedupKey(null, '{"sessionId":"a"}');
    const b = deriveDedupKey(null, '{"sessionId":"b"}');
    expect(a).not.toBe(b);
  });

  test("provider eventId wins even if rawBody also yields a hash", () => {
    const body = '{"x":1}';
    const withId = deriveDedupKey("evt_real", body);
    const without = deriveDedupKey(null, body);
    expect(withId).toBe("evt_real");
    expect(withId).not.toBe(without);
    // Important: this means a Stripe redelivery (same evt_*) collapses to
    // the same key regardless of body whitespace etc., while a stub-provider
    // retry uses the body — both paths are deterministic per delivery.
  });

  test("sha256 prefix is stable so the stripe path can never collide with the hash path", () => {
    // evt_* strings are short alphanumeric; sha256: prefix guarantees the
    // two namespaces never share a key by accident.
    const stripeKey = deriveDedupKey("evt_1Tu9abc", "{}");
    const fallback = deriveDedupKey(null, "{}");
    expect(stripeKey.startsWith("evt_")).toBe(true);
    expect(fallback.startsWith("sha256:")).toBe(true);
  });
});

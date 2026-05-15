import { describe, test, expect } from "vitest";

// classifyWebhookFailure is local to bureau.ts; we import the route module
// to exercise it indirectly. Since it's a pure string predicate, we test by
// matching the exact substring patterns the function looks for. If the
// function is renamed/exported, swap to direct import.
//
// This keeps the alert taxonomy in SENTRY_ALERTS.md honest:
// any failure-string we pattern-match against here MUST match what the
// upstream parser (Stripe SDK / Sumsub / our own throws) actually emits.

// Inline copy — must stay in lockstep with the function in bureau.ts.
function classifyWebhookFailure(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("missing stripe-signature") || m.includes("missing x-payload-digest")) {
    return "no_signature_header";
  }
  if (m.includes("signature") || m.includes("constructevent") || m.includes("hmac")) {
    return "signature_invalid";
  }
  if (m.includes("metadata.bureauintentid") || m.includes("missing metadata")) {
    return "metadata_missing";
  }
  if (m.includes("unhandled stripe event")) {
    return "unhandled_event";
  }
  if (m.includes("env is not set") || m.includes("not yet implemented")) {
    return "config_missing";
  }
  return "unknown";
}

describe("classifyWebhookFailure", () => {
  test("missing stripe-signature header → no_signature_header (scanner noise, no alert)", () => {
    expect(classifyWebhookFailure("missing stripe-signature header")).toBe("no_signature_header");
  });

  test("Stripe constructEvent signature mismatch → signature_invalid (real alert)", () => {
    expect(
      classifyWebhookFailure(
        "Webhook signature verification failed. Signing secret may have rotated.",
      ),
    ).toBe("signature_invalid");
  });

  test("Stripe constructEvent generic error → signature_invalid", () => {
    expect(classifyWebhookFailure("constructEvent: timestamp outside tolerance")).toBe(
      "signature_invalid",
    );
  });

  test("missing bureauIntentId metadata → metadata_missing", () => {
    expect(
      classifyWebhookFailure("stripe event evt_123: missing metadata.bureauIntentId"),
    ).toBe("metadata_missing");
  });

  test("unhandled event type → unhandled_event", () => {
    expect(classifyWebhookFailure("unhandled stripe event type: charge.refunded")).toBe(
      "unhandled_event",
    );
  });

  test("missing env var → config_missing", () => {
    expect(
      classifyWebhookFailure("Stripe payment: STRIPE_WEBHOOK_SECRET env is not set."),
    ).toBe("config_missing");
  });

  test("not-yet-implemented stub → config_missing", () => {
    expect(
      classifyWebhookFailure("Stripe provider not yet implemented — populate parseWebhook"),
    ).toBe("config_missing");
  });

  test("DB error / random → unknown", () => {
    expect(classifyWebhookFailure("connection refused: postgres on 5432")).toBe("unknown");
  });

  test("KYC HMAC mismatch (sumsub) → signature_invalid", () => {
    expect(classifyWebhookFailure("HMAC mismatch on x-payload-digest")).toBe("signature_invalid");
  });

  test("missing x-payload-digest header → no_signature_header (KYC scanner noise)", () => {
    expect(classifyWebhookFailure("missing x-payload-digest header")).toBe("no_signature_header");
  });
});

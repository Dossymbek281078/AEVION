import { describe, test, expect, beforeEach, afterEach } from "vitest";

// Stripe provider regression tests — Bureau Tier 3 hardening 2026-05-08.
//
// Until 2026-05-08 stripeProvider was a TODO stub: createIntent / getIntent /
// parseWebhook all threw `Stripe provider not yet implemented`. Setting
// BUREAU_PAYMENT_PROVIDER=stripe on prod made /payment/intent return 500 and
// every webhook return 400 — payment status never propagated.
//
// This file imports the real provider; if the `stripe` npm package is not
// installed locally, the dynamic import falls back and the suite is skipped.
// Railway/CI install full deps so the suite runs there.

const STRIPE_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "AEVION_PUBLIC_BASE_URL"];

let stripePaymentProvider: typeof import("../src/lib/payment/stripeProvider").stripePaymentProvider | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  stripePaymentProvider = require("../src/lib/payment/stripeProvider").stripePaymentProvider;
} catch {
  stripePaymentProvider = null;
}

const desc = stripePaymentProvider ? describe : describe.skip;

beforeEach(() => {
  for (const k of STRIPE_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of STRIPE_KEYS) delete process.env[k];
});

desc("stripePaymentProvider env requirements", () => {
  test("createIntent rejects when STRIPE_SECRET_KEY is unset", async () => {
    await expect(
      stripePaymentProvider!.createIntent({
        reference: "ref-1",
        amountCents: 1900,
        currency: "USD",
        description: "test",
      }),
    ).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });

  test("parseWebhook throws when STRIPE_WEBHOOK_SECRET is unset", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    expect(() => stripePaymentProvider!.parseWebhook({}, "{}")).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  test("parseWebhook throws on missing stripe-signature header", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    expect(() =>
      stripePaymentProvider!.parseWebhook({ "content-type": "application/json" }, "{}"),
    ).toThrow(/stripe-signature/);
  });

  test("provider id is stripe", () => {
    expect(stripePaymentProvider!.id).toBe("stripe");
  });
});

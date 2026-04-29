import crypto from "crypto";
import {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
} from "./provider";

/**
 * Deterministic stub payment provider for development and CI.
 *
 * Behaviour:
 *   - createIntent stashes the intent in-memory and returns a fake
 *     checkout URL.
 *   - getIntent auto-completes the intent on first read (so polling
 *     reaches "paid" without external action).
 *   - parseWebhook accepts {intentId} and marks the intent paid.
 *
 * Stripe-shaped enough that route code written against this works
 * unchanged when BUREAU_PAYMENT_PROVIDER=stripe is wired in.
 */

interface StubIntent {
  input: PaymentIntentInput;
  status: "unpaid" | "paid";
  paidAt: string | null;
}

const intents = new Map<string, StubIntent>();

export const stubPaymentProvider: PaymentProvider = {
  id: "stub",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const intentId = "pay-stub-" + crypto.randomBytes(8).toString("hex");
    intents.set(intentId, { input, status: "unpaid", paidAt: null });
    return {
      intentId,
      checkoutUrl: `/bureau/pay-stub/${intentId}`,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  async getIntent(intentId: string): Promise<PaymentResult> {
    const i = intents.get(intentId);
    if (!i) {
      return {
        status: "expired",
        paidAt: null,
        reason: "Stub intent not found",
        raw: null,
      };
    }
    // Auto-complete on first poll so the demo flow works without a click.
    if (i.status === "unpaid") {
      i.status = "paid";
      i.paidAt = new Date().toISOString();
    }
    return {
      status: i.status,
      paidAt: i.paidAt,
      reason: null,
      raw: { stub: true, input: i.input },
    };
  },

  parseWebhook(_headers: Record<string, string>, rawBody: string) {
    let body: { intentId?: unknown };
    try {
      body = JSON.parse(rawBody) as { intentId?: unknown };
    } catch {
      throw new Error("Stub webhook: body is not valid JSON");
    }
    const intentId = typeof body.intentId === "string" ? body.intentId : null;
    if (!intentId) throw new Error("Stub webhook: intentId missing");
    const i = intents.get(intentId);
    if (!i) throw new Error(`Stub webhook: unknown intentId ${intentId}`);
    i.status = "paid";
    i.paidAt = new Date().toISOString();
    return {
      intentId,
      result: {
        status: "paid",
        paidAt: i.paidAt,
        reason: null,
        raw: { stub: true, webhook: true },
      },
    };
  },
};

/** Test-only helper. */
export function __resetStubPaymentIntents(): void {
  intents.clear();
}

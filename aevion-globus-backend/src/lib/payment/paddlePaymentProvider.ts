/**
 * Paddle Billing v2 payment provider — replaces Stripe for Bureau payments.
 *
 * Activate via env:
 *   BUREAU_PAYMENT_PROVIDER=paddle
 *   PADDLE_API_KEY=pdl_live_...
 *   PADDLE_WEBHOOK_SECRET=...  (from Paddle dashboard → Notifications)
 *   PADDLE_SANDBOX=false       (production)
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app
 *
 * Paddle is Merchant of Record — they handle VAT/taxes, you receive payouts.
 * Docs: https://developer.paddle.com/api-reference/transactions/create-transaction
 */

import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
} from "./provider";

function paddleKey(): string {
  const k = process.env.PADDLE_API_KEY?.trim();
  if (!k) throw new Error("PADDLE_API_KEY not set — set BUREAU_PAYMENT_PROVIDER=stub for dev");
  return k;
}
function paddleWebhookSecret(): string {
  return process.env.PADDLE_WEBHOOK_SECRET?.trim() || "";
}
function isSandbox(): boolean {
  return process.env.PADDLE_SANDBOX !== "false";
}
function paddleBase(): string {
  return isSandbox() ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}
function publicBaseUrl(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || "https://aevion.app");
}

async function paddlePost(path: string, body: unknown): Promise<unknown> {
  const r = await fetch(`${paddleBase()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${paddleKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Paddle ${path} → ${r.status}: ${errText.slice(0, 300)}`);
  }
  return r.json();
}

async function paddleGet(path: string): Promise<unknown> {
  const r = await fetch(`${paddleBase()}${path}`, {
    headers: { Authorization: `Bearer ${paddleKey()}` },
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Paddle GET ${path} → ${r.status}: ${errText.slice(0, 300)}`);
  }
  return r.json();
}

function mapPaddleStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case "completed": return "paid";
    case "past_due":
    case "payment_failed": return "failed";
    case "canceled": return "expired";
    case "billed":
    case "pending_payment": return "processing";
    default: return "unpaid";
  }
}

export const paddlePaymentProvider: PaymentProvider = {
  id: "paddle",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const bureauIntentId = randomUUID();
    const base = publicBaseUrl();

    const txBody = {
      items: [{
        quantity: 1,
        price: {
          name: input.description.slice(0, 200),
          unit_price: {
            amount: String(input.amountCents),
            currency_code: input.currency.toUpperCase().slice(0, 3),
          },
          tax_mode: "exclusive",
          custom_data: { bureauIntentId, reference: input.reference },
        },
      }],
      custom_data: { bureauIntentId, reference: input.reference },
      ...(input.email ? { customer: { email: input.email } } : {}),
      checkout: {
        url: `${base}/bureau?paid=1&reference=${encodeURIComponent(input.reference)}`,
      },
    };

    const data = await paddlePost("/transactions", txBody) as {
      data?: { id: string; checkout?: { url: string }; status?: string };
    };

    const tx = data.data;
    if (!tx?.id) throw new Error("Paddle returned no transaction id");

    const checkoutUrl = tx.checkout?.url
      ?? `${paddleBase().replace("api.", "")}/checkout/${tx.id}`;

    return {
      intentId: bureauIntentId,
      checkoutUrl,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  async getIntent(bureauIntentId: string): Promise<PaymentResult> {
    // Paddle doesn't support search-by-custom-data yet — poll via webhook-stored txId.
    // For Bureau polling, we surface "unpaid" until webhook updates the DB row.
    // This mirrors Stripe's approach: trust webhooks, not polling.
    const data = await paddleGet(
      `/transactions?custom_data=bureauIntentId:${encodeURIComponent(bureauIntentId)}&per_page=1`,
    ).catch(() => null);

    const tx = (data as any)?.data?.[0];
    if (!tx) return { status: "unpaid", paidAt: null, reason: "not_found", raw: null };

    return {
      status: mapPaddleStatus(tx.status),
      paidAt: tx.status === "completed" ? (tx.updated_at ?? new Date().toISOString()) : null,
      reason: null,
      raw: { id: tx.id, status: tx.status },
    };
  },

  parseWebhook(headers: Record<string, string>, rawBody: string) {
    const secret = paddleWebhookSecret();

    // Paddle uses h1=<HMAC-SHA256> signature in Paddle-Signature header
    // Format: ts=<timestamp>;h1=<hmac>
    const sigHeader = headers["paddle-signature"] || "";
    if (secret && sigHeader) {
      const parts = Object.fromEntries(sigHeader.split(";").map((p) => p.split("=")));
      const ts = parts["ts"] || "";
      const h1 = parts["h1"] || "";
      const signed = `${ts}:${rawBody}`;
      const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
      if (
        !h1 ||
        h1.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(expected, "hex"))
      ) {
        throw new Error("Paddle webhook signature mismatch");
      }
    }

    let event: Record<string, unknown>;
    try { event = JSON.parse(rawBody); } catch { throw new Error("Paddle webhook: invalid JSON"); }

    const eventType = String(event.event_type || event.notification_type || "");
    const txData = (event.data || event.transaction) as Record<string, unknown> | undefined;

    if (!txData) throw new Error(`Paddle webhook: no data in event ${eventType}`);

    const customData = (txData.custom_data || {}) as Record<string, string>;
    const bureauIntentId = customData["bureauIntentId"] || "";
    if (!bureauIntentId) throw new Error(`Paddle webhook: missing bureauIntentId in custom_data`);

    let status: PaymentStatus = "unpaid";
    if (eventType === "transaction.completed") status = "paid";
    else if (eventType === "transaction.payment_failed") status = "failed";
    else if (eventType === "transaction.canceled") status = "expired";

    return {
      intentId: bureauIntentId,
      eventId: String(event.notification_id || event.event_id || ""),
      result: {
        status,
        paidAt: status === "paid" ? (txData.updated_at as string ?? new Date().toISOString()) : null,
        reason: null,
        raw: { eventType, txId: txData.id, status: txData.status },
      } satisfies PaymentResult,
    };
  },
};

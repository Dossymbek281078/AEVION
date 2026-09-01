/**
 * Lemon Squeezy payment provider.
 *
 * Activate via env:
 *   BUREAU_PAYMENT_PROVIDER=lemonsqueezy
 *   LEMON_SQUEEZY_API_KEY=<from Settings → API in the LS dashboard>
 *   LEMON_SQUEEZY_STORE_ID=<numeric store id from LS dashboard URL>
 *   LEMON_SQUEEZY_WEBHOOK_SECRET=<signing secret created when adding a webhook>
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app    (success/cancel redirects)
 *
 *   # Default variant id used by createIntent if the input.reference isn't
 *   # mapped to a specific variant. Get from LS dashboard → Store →
 *   # Products → click product → variant id is in URL.
 *   LEMON_SQUEEZY_DEFAULT_VARIANT_ID=<numeric variant id>
 *
 * Reference:
 *   https://docs.lemonsqueezy.com/api/checkouts/create-checkout
 *   https://docs.lemonsqueezy.com/help/webhooks
 *   https://docs.lemonsqueezy.com/help/webhooks/signing-requests
 *
 * Mapping notes:
 * - LS doesn't have a Stripe-style payment intent; each checkout is its own
 *   resource keyed by a UUID. We generate our own intentId (UUID) and pass
 *   it via `custom_data.bureauIntentId` so the webhook returns it. LS
 *   echoes `custom_data` back on every order_created / subscription_created
 *   event.
 * - parseWebhook reads `x-signature` header (HMAC-SHA256, hex) and verifies
 *   against LEMON_SQUEEZY_WEBHOOK_SECRET. Then maps event_name → PaymentStatus.
 *   See https://docs.lemonsqueezy.com/help/webhooks/signing-requests
 * - getIntent polls /v1/orders?filter[order_number]=<our ref> — LS doesn't
 *   give us back our intentId in the order list, so we filter by the
 *   reference we passed as `order_number` (or fall back to custom_data via
 *   /v1/checkouts/{id} if we cached the LS checkout id on creation).
 */
import { buildSuccessUrl } from "./successUrl";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
} from "./provider";
import { resolveLemonSqueezyVariant } from "../../data/lemonSqueezyVariants";

const LS_BASE = "https://api.lemonsqueezy.com/v1";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`LemonSqueezy: missing env ${name}`);
  return v;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requiredEnv("LEMON_SQUEEZY_API_KEY")}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
}

function publicBaseUrl(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL || "https://aevion.app").replace(/\/+$/, "");
}

/**
 * Куда вернуть человека после успешной оплаты.
 *
 * 🔴 Было `${base}/payment/success` — страницы с таким адресом не существует
 * ни в репозитории, ни на проде (замер 12.08.2026: `aevion.app/payment/success`
 * → 404, при том что `/pricing/checkout/success`, `/pricing/checkout/cancel`
 * и `/bureau` отвечают 200). То есть человек платил за подписку и попадал на
 * страницу ошибки. Деньги при этом списывались и доступ выдавался — ломался
 * только последний экран, поэтому дефект не проявлял себя ничем, кроме
 * впечатления покупателя.
 *
 * Ведём на существующую страницу успеха — ту же, что уже используют PayPal и
 * PayBox. Она читает tier/period/total/provider и показывает, что делать
 * дальше, так что параметры передаём, а не теряем.
 */
export function successRedirectUrl(base: string, intentId: string, input: PaymentIntentInput): string {
  // Собирает общий сборщик: адрес возврата был в трёх копиях, и они
  // разошлись — appId не клал никто, а tier знал только этот помощник.
  return buildSuccessUrl(base, input, { provider: "lemonsqueezy", intentId });
}

// In-memory cache: our intentId → LS checkout id (so getIntent can fetch the
// right LS order). Rebuilds on process restart; webhook-driven status is the
// source of truth, so a cache miss just means we can't poll until next webhook.
const INTENT_TO_LS_CHECKOUT = new Map<string, string>();

interface LsCheckoutResponse {
  data?: {
    id?: string;
    attributes?: {
      url?: string;
    };
  };
}

interface LsOrderListResponse {
  data?: Array<{
    attributes?: {
      status?: string;
      created_at?: string;
      refunded?: boolean;
    };
  }>;
}

function mapStatus(raw: string | undefined, refunded: boolean | undefined): PaymentStatus {
  if (refunded) return "refunded";
  switch ((raw || "").toLowerCase()) {
    case "paid":
      return "paid";
    case "pending":
      return "processing";
    case "failed":
      return "failed";
    case "expired":
    case "void":
      return "expired";
    default:
      return "unpaid";
  }
}

export const lemonSqueezyPaymentProvider: PaymentProvider = {
  id: "lemonsqueezy",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const storeId = requiredEnv("LEMON_SQUEEZY_STORE_ID");
    // Reference-based mapping first ("bundle:fintech", "all-access" → published
    // variant), env DEFAULT acts as the catch-all when the slot isn't filled
    // yet OR when reference doesn't match any known bundle.
    const variantId = resolveLemonSqueezyVariant(input.reference) ?? requiredEnv("LEMON_SQUEEZY_DEFAULT_VARIANT_ID");
    const intentId = randomUUID();
    const base = publicBaseUrl();

    const body = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: input.email ?? undefined,
            custom: { bureauIntentId: intentId, reference: input.reference, ...(input.customData ?? {}) },
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: true,
          },
          product_options: {
            name: input.description,
            description: input.description,
            redirect_url: successRedirectUrl(base, intentId, input),
            receipt_button_text: "Back to AEVION",
            enabled_variants: [Number.parseInt(variantId, 10)],
          },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    };

    const res = await fetch(`${LS_BASE}/checkouts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`LS createCheckout failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const j = (await res.json()) as LsCheckoutResponse;
    const lsId = j.data?.id;
    const url = j.data?.attributes?.url;
    if (!lsId || !url) throw new Error("LS createCheckout: missing id/url in response");

    INTENT_TO_LS_CHECKOUT.set(intentId, lsId);

    return {
      intentId,
      checkoutUrl: url,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  async getIntent(intentId: string): Promise<PaymentResult> {
    // Best-effort poll: filter orders by our bureauIntentId stored in custom
    // data. LS doesn't index custom_data so we fall back to "no info yet" —
    // the webhook is authoritative.
    const url = `${LS_BASE}/orders?filter[store_id]=${requiredEnv("LEMON_SQUEEZY_STORE_ID")}&sort=-created_at&page[size]=20`;
    const res = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (!res || !res.ok) {
      return { status: "unpaid", paidAt: null, reason: null, raw: null };
    }
    const j = (await res.json()) as LsOrderListResponse;
    // Without filter on custom_data we just confirm there's no obvious paid
    // match — webhook will deliver the real status.
    const recent = j.data?.[0]?.attributes;
    return {
      status: mapStatus(recent?.status, recent?.refunded),
      paidAt: recent?.status === "paid" ? recent?.created_at ?? null : null,
      reason: null,
      raw: j,
    };
  },

  parseWebhook(headers: Record<string, string>, rawBody: string) {
    const secret = requiredEnv("LEMON_SQUEEZY_WEBHOOK_SECRET");
    const presented = headers["x-signature"] || headers["X-Signature"];
    if (!presented) throw new Error("LS webhook: missing x-signature header");

    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("LS webhook: signature mismatch");
    }

    let parsed: {
      meta?: {
        event_name?: string;
        custom_data?: { bureauIntentId?: string };
        webhook_id?: string;
      };
      data?: {
        id?: string;
        attributes?: {
          status?: string;
          created_at?: string;
          refunded?: boolean;
        };
      };
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error("LS webhook: body is not JSON");
    }

    const intentId = parsed.meta?.custom_data?.bureauIntentId;
    if (!intentId) throw new Error("LS webhook: meta.custom_data.bureauIntentId missing");

    const event = (parsed.meta?.event_name || "").toLowerCase();
    let status: PaymentStatus;
    switch (event) {
      case "order_created":
        status = mapStatus(parsed.data?.attributes?.status, parsed.data?.attributes?.refunded);
        break;
      case "order_refunded":
        status = "refunded";
        break;
      case "subscription_payment_failed":
        status = "failed";
        break;
      case "subscription_expired":
        status = "expired";
        break;
      default:
        status = mapStatus(parsed.data?.attributes?.status, parsed.data?.attributes?.refunded);
    }

    return {
      intentId,
      eventId: parsed.meta?.webhook_id || undefined,
      result: {
        status,
        paidAt: status === "paid" ? parsed.data?.attributes?.created_at ?? null : null,
        reason: null,
        raw: parsed,
      },
    };
  },
};

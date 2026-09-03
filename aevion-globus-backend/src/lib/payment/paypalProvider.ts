/**
 * PayPal payment provider (Orders v2 API) — глобальный карт/PayPal-канал.
 *
 * До этого PayPal в коде значился только как "soon" в маркетинге — живого
 * процессинга не было. Этот провайдер включает реальный канал (карты + баланс
 * PayPal), полезный для регионов без локального процессинга и как мост к
 * Payoneer-выводу.
 *
 * Activate via env:
 *   PAYPAL_CLIENT_ID=<developer.paypal.com → Apps & Credentials → Client ID>
 *   PAYPAL_SECRET=<там же, Secret>
 *   PAYPAL_SANDBOX=0                 # 0 = боевой; по умолчанию 1 (sandbox)
 *   PAYPAL_WEBHOOK_ID=<Apps → Webhooks → Webhook ID> (для verify-webhook-signature)
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app
 *
 * Документация:
 *   https://developer.paypal.com/docs/api/orders/v2/
 *   https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 *
 * Поток:
 *   1. createIntent → OAuth token → POST /v2/checkout/orders (intent CAPTURE)
 *      → ссылка approve = checkoutUrl, order.id = intentId
 *   2. Пользователь подтверждает на PayPal → возвращается на return_url
 *   3. Вебхук PAYMENT.CAPTURE.COMPLETED / CHECKOUT.ORDER.APPROVED →
 *      parseWebhook проверяет подпись через verify-webhook-signature API
 *   4. getIntent → GET /v2/checkout/orders/{id} (статус COMPLETED = оплачено)
 */

import { buildCancelUrl, buildSuccessUrl } from "./successUrl";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
} from "./provider";

function clientId(): string {
  const v = process.env.PAYPAL_CLIENT_ID;
  if (!v) throw new Error("PayPal: missing PAYPAL_CLIENT_ID");
  return v;
}

function secret(): string {
  const v = process.env.PAYPAL_SECRET;
  if (!v) throw new Error("PayPal: missing PAYPAL_SECRET");
  return v;
}

function isSandbox(): boolean {
  return process.env.PAYPAL_SANDBOX !== "0";
}

function apiBase(): string {
  return isSandbox() ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

function publicBase(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}

/** True только когда заданы оба обязательных секрета — иначе провайдер не активен. */
export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_SECRET?.trim());
}

// ─── OAuth token (кэш в процессе) ───────────────────────────────────────────
let token: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token;
  const basic = Buffer.from(`${clientId()}:${secret()}`).toString("base64");
  const r = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal oauth failed: ${r.status}`);
  const d = (await r.json()) as { access_token: string; expires_in: number };
  token = d.access_token;
  tokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
  return token;
}

function statusFromOrder(orderStatus: string): PaymentResult["status"] {
  switch (orderStatus) {
    case "COMPLETED":
      return "paid";
    case "APPROVED":
    case "SAVED":
      return "processing";
    case "VOIDED":
      return "failed";
    default:
      return "unpaid";
  }
}

export const paypalPaymentProvider: PaymentProvider = {
  id: "paypal",


  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const t = await getToken();
    const base = publicBase();
    const value = (input.amountCents / 100).toFixed(2);
    const customId = собратьCustomId(input.reference, input.customData);

    const r = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.reference,
            custom_id: customId,
            description: input.description.slice(0, 127),
            amount: { currency_code: (input.currency || "USD").toUpperCase(), value },
          },
        ],
        application_context: {
          brand_name: "AEVION",
          user_action: "PAY_NOW",
          return_url: buildSuccessUrl(base, input, { provider: "paypal", flags: { paypal: "1" } }),
          cancel_url: buildCancelUrl(base, input, { flags: { paypal: "1" } }),
        },
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`PayPal create order failed: ${r.status} ${body.slice(0, 200)}`);
    }
    const order = (await r.json()) as {
      id: string;
      status: string;
      links?: { href: string; rel: string }[];
    };
    const approve = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!approve) throw new Error("PayPal: no approve link in order response");
    return {
      intentId: `paypal:${order.id}`,
      checkoutUrl: approve,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency || "USD",
    };
  },

  async getIntent(intentId: string): Promise<PaymentResult> {
    const orderId = intentId.startsWith("paypal:") ? intentId.slice("paypal:".length) : intentId;
    try {
      const t = await getToken();
      const r = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) return { status: "failed", paidAt: null, reason: `api_${r.status}`, raw: null };
      const order = (await r.json()) as {
        status: string;
        update_time?: string;
        create_time?: string;
      };
      const status = statusFromOrder(order.status);
      return {
        status,
        paidAt: status === "paid" ? (order.update_time ?? order.create_time ?? new Date().toISOString()) : null,
        reason: status === "paid" ? null : order.status,
        raw: order,
      };
    } catch (err) {
      return { status: "failed", paidAt: null, reason: err instanceof Error ? err.message : "unknown", raw: null };
    }
  },

  parseWebhook(headers: Record<string, string>, rawBody: string) {
    // PayPal-вебхук проверяется через API verify-webhook-signature (нужен
    // PAYPAL_WEBHOOK_ID + заголовки доставки). Здесь синхронно распарсим тело и
    // вернём intentId + статус из event_type; криптопроверка подписи — в роуте
    // (асинхронный вызов API), который пометит reason:"unverified" если не
    // прошла. parseWebhook остаётся синхронным по контракту интерфейса.
    let body: {
      event_type?: string;
      resource?: {
        id?: string;
        status?: string;
        custom_id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
        payer?: { email_address?: string };
        update_time?: string;
        create_time?: string;
      };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { intentId: "paypal:", result: { status: "failed" as const, paidAt: null, reason: "parse_error", raw: rawBody } };
    }
    const res = body.resource ?? {};
    const orderId = res.supplementary_data?.related_ids?.order_id ?? res.id ?? "";
    const event = body.event_type ?? "";
    let status: PaymentResult["status"] = "processing";
    if (event === "PAYMENT.CAPTURE.COMPLETED" || res.status === "COMPLETED") status = "paid";
    else if (event === "PAYMENT.CAPTURE.DENIED" || event === "PAYMENT.CAPTURE.REFUNDED") status = event.endsWith("REFUNDED") ? "refunded" : "failed";
    else if (event === "CHECKOUT.ORDER.APPROVED") status = "processing";

    return {
      intentId: `paypal:${orderId}`,
      eventId: res.id || undefined,
      result: {
        status,
        paidAt: status === "paid" ? (res.update_time ?? res.create_time ?? new Date().toISOString()) : null,
        reason: status === "paid" ? null : event,
        raw: { ...res, event_type: event, _headers_present: Object.keys(headers).length > 0 },
      },
    };
  },
};

/**
 * Криптопроверка подписи вебхука PayPal через API. Возвращает true только если
 * PayPal подтвердил подпись (verification_status === "SUCCESS"). Без
 * PAYPAL_WEBHOOK_ID вернёт false (нельзя проверить → не доверяем).
 */
export async function verifyPaypalWebhook(
  headers: Record<string, string>,
  rawBody: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) return false;
  try {
    const t = await getToken();
    const r = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });
    if (!r.ok) return false;
    const d = (await r.json()) as { verification_status?: string };
    return d.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

/**
 * `custom_id` для PayPal: не длиннее 127 символов И всегда разбираемый.
 *
 * 🔴 ПОПРАВКА 02.09.2026, находка соседнего окна. Было так:
 *
 *     JSON.stringify({ reference, ...customData }).slice(0, 127)
 *
 * Это срез СТРОКИ JSON. Перевалило за 127 — наружу уезжает обрезанный, то
 * есть НЕВАЛИДНЫЙ JSON. Разбор в вебхуке падает в запасную ветку и
 * возвращает `{ reference: customId }`, то есть кусок JSON целиком вместо
 * ссылки заказа. Такой платёж не привязать ни к чему: деньги пришли, а к
 * чему они — неизвестно.
 *
 * Теряется при этом не «поле аналитики», а ВЫДАЧА КУПЛЕННОГО. И проявится
 * не сразу: сегодня, вероятно, влезает, а сломается ровно тогда, когда в
 * `customData` добавят ещё одно поле, — то есть при обычной работе и молча.
 *
 * Стало: собираем по одному полю, пока результат помещается. Не влезло —
 * поле не едет, но JSON остаётся целым.
 *
 * Если не помещается даже минимальный объект (ссылка длиннее ~110 символов),
 * отдаём ссылку ГОЛОЙ строкой: запасная ветка разбора вернёт её как
 * `reference`, и это верный ответ, а не мусор.
 */
export function собратьCustomId(
  reference: string,
  customData?: Record<string, string | undefined>,
): string {
  const ПРЕДЕЛ = 127;
  if (JSON.stringify({ reference }).length > ПРЕДЕЛ) return reference.slice(0, ПРЕДЕЛ);

  let итог: Record<string, string> = { reference };
  for (const [k, v] of Object.entries(customData ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    const проба = { ...итог, [k]: String(v) };
    if (JSON.stringify(проба).length <= ПРЕДЕЛ) итог = проба;
  }
  return JSON.stringify(итог);
}

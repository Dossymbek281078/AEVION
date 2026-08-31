/**
 * PayBox / Freedom Pay payment provider (KZT, локальные карты Казахстана + Kaspi).
 *
 * Открывает локальный платёжный канал для KZ-рынка: 12 приложений Revenue Hub
 * объявляют канал `paybox`, но без этого провайдера он был заглушкой.
 *
 * Activate via env:
 *   PAYBOX_MERCHANT_ID=<paybox.money → Личный кабинет → Мерчанты → ID>
 *   PAYBOX_SECRET=<секретный ключ мерчанта (тот же ЛК)>
 *   PAYBOX_TESTING=1                 # 1 = тестовый режим (по умолчанию 1 пока не настроено боевое)
 *   PAYBOX_RESULT_SCRIPT_NAME=webhook  # последний сегмент пути result_url (для проверки подписи колбэка)
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app     # для success/failure/result редиректов
 *
 * Документация: https://docs.freedompay.kz / https://paybox.money (init_payment.php).
 *
 * Алгоритм подписи (Freedom Pay):
 *   md5( [script_name, ...значения_параметров_отсортированных_по_ключу, secret].join(";") )
 *   где параметры — все pg-поля и прочие, КРОМЕ pg_sig.
 *
 * Поток:
 *   1. createIntent → POST init_payment.php → парсим pg_redirect_url (hosted-страница)
 *   2. Пользователь платит на стороне PayBox
 *   3. PayBox шлёт POST на result_url (pg_result=1 успех) — parseWebhook проверяет подпись
 *   4. getIntent → POST get_status3.php для опроса статуса
 */

import { buildSuccessUrl } from "./successUrl";
import { createHash, randomBytes } from "node:crypto";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
} from "./provider";

const PAYBOX_BASE = "https://api.paybox.money";

function merchantId(): string {
  const v = process.env.PAYBOX_MERCHANT_ID;
  if (!v) throw new Error("PayBox: missing PAYBOX_MERCHANT_ID");
  return v;
}

function secret(): string {
  const v = process.env.PAYBOX_SECRET;
  if (!v) throw new Error("PayBox: missing PAYBOX_SECRET");
  return v;
}

function publicBase(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}

function testingMode(): "1" | "0" {
  // По умолчанию тестовый режим, пока явно не выставлен PAYBOX_TESTING=0.
  return process.env.PAYBOX_TESTING === "0" ? "0" : "1";
}

/** True только когда заданы оба обязательных секрета — иначе провайдер не активен. */
export function isPayboxConfigured(): boolean {
  return Boolean(process.env.PAYBOX_MERCHANT_ID?.trim() && process.env.PAYBOX_SECRET?.trim());
}

function genSalt(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Подпись Freedom Pay: md5(script;sorted_param_values;secret).
 * Берём имя скрипта (например "init_payment.php"), значения всех параметров
 * (кроме pg_sig) в порядке сортировки КЛЮЧЕЙ по алфавиту, и секрет — джойним
 * через ";" и хэшируем md5.
 */
function sign(scriptName: string, params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "pg_sig")
    .sort();
  const parts = [scriptName, ...keys.map((k) => params[k]), secret()];
  return createHash("md5").update(parts.join(";")).digest("hex");
}

/** Достаём содержимое тега XML-ответа PayBox без xml-парсера. */
function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

async function payboxPost(scriptName: string, params: Record<string, string>): Promise<string> {
  const signed = { ...params, pg_sig: sign(scriptName, params) };
  const body = new URLSearchParams(signed);
  const r = await fetch(`${PAYBOX_BASE}/${scriptName}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return r.text();
}

export const payboxPaymentProvider: PaymentProvider = {
  id: "paybox",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const base = publicBase();
    // pg_amount — в основной единице валюты (тенге), не в копейках/тийинах.
    const amount = (input.amountCents / 100).toFixed(2);
    const orderId = `${input.reference}_${Date.now()}`;
    const params: Record<string, string> = {
      pg_merchant_id: merchantId(),
      pg_order_id: orderId,
      pg_amount: amount,
      pg_currency: (input.currency || "KZT").toUpperCase(),
      pg_description: input.description.slice(0, 255),
      pg_salt: genSalt(),
      pg_testing_mode: testingMode(),
      pg_result_url: `${base}/api/paybox/webhook`,
      pg_success_url: buildSuccessUrl(base, input, { provider: "paybox", flags: { paybox: "1" } }),
      pg_failure_url: `${base}/pricing/checkout/cancel?paybox=1`,
    };
    if (input.email) params.pg_user_contact_email = input.email;
    if (input.customData) {
      for (const [k, v] of Object.entries(input.customData)) {
        params[`pg_param_${k}`] = String(v);
      }
    }

    const xml = await payboxPost("init_payment.php", params);
    const status = xmlTag(xml, "pg_status");
    const redirect = xmlTag(xml, "pg_redirect_url");
    const paymentId = xmlTag(xml, "pg_payment_id");
    if (status !== "ok" || !redirect) {
      const err = xmlTag(xml, "pg_error_description") ?? "init_failed";
      throw new Error(`PayBox init_payment failed: ${err}`);
    }
    return {
      intentId: `paybox:${paymentId ?? orderId}`,
      checkoutUrl: redirect,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency || "KZT",
    };
  },

  async getIntent(intentId: string): Promise<PaymentResult> {
    const paymentId = intentId.startsWith("paybox:") ? intentId.slice("paybox:".length) : intentId;
    try {
      const xml = await payboxPost("get_status3.php", {
        pg_merchant_id: merchantId(),
        pg_payment_id: paymentId,
        pg_salt: genSalt(),
      });
      const txStatus = xmlTag(xml, "pg_transaction_status") ?? xmlTag(xml, "pg_status");
      const captured = txStatus === "ok" || txStatus === "success";
      const refunded = txStatus === "refunded" || txStatus === "reversed";
      return {
        status: refunded ? "refunded" : captured ? "paid" : "processing",
        paidAt: captured ? (xmlTag(xml, "pg_create_date") ?? new Date().toISOString()) : null,
        reason: captured ? null : txStatus,
        raw: xml,
      };
    } catch (err) {
      return { status: "failed", paidAt: null, reason: err instanceof Error ? err.message : "unknown", raw: null };
    }
  },

  parseWebhook(_headers: Record<string, string>, rawBody: string) {
    // PayBox шлёт form-encoded POST на result_url. Имя скрипта для подписи —
    // последний сегмент пути result_url (по умолчанию "webhook").
    const scriptName = process.env.PAYBOX_RESULT_SCRIPT_NAME?.trim() || "webhook";
    const params = new URLSearchParams(rawBody);
    const flat: Record<string, string> = {};
    for (const [k, v] of params.entries()) flat[k] = v;

    const presented = flat["pg_sig"] ?? "";
    const paymentId = flat["pg_payment_id"] ?? flat["pg_order_id"] ?? "";

    // Без секрета подпись вычислить нечем → не доверяем (а не падаем). Возвращаем
    // invalid_signature, чтобы роут ответил 401, а не 400 на необработанном throw.
    if (!process.env.PAYBOX_SECRET?.trim()) {
      return {
        intentId: `paybox:${paymentId}`,
        result: { status: "failed" as const, paidAt: null, reason: "invalid_signature", raw: flat },
      };
    }

    const expected = sign(scriptName, flat);
    if (!presented || presented !== expected) {
      return {
        intentId: `paybox:${paymentId}`,
        result: { status: "failed" as const, paidAt: null, reason: "invalid_signature", raw: flat },
      };
    }

    const result = flat["pg_result"]; // "1" = успех, "0" = отказ
    const captured = result === "1";
    const refunded = flat["pg_refund"] === "1" || flat["pg_revoke"] === "1";

    return {
      intentId: `paybox:${paymentId}`,
      eventId: paymentId || undefined,
      result: {
        status: refunded ? ("refunded" as const) : captured ? ("paid" as const) : ("failed" as const),
        paidAt: captured ? (flat["pg_create_date"] ?? new Date().toISOString()) : null,
        reason: captured ? null : refunded ? "refunded" : (flat["pg_failure_description"] ?? "declined"),
        raw: flat,
      },
    };
  },
};

/**
 * Gumroad payment provider.
 *
 * Activate via env:
 *   BUREAU_PAYMENT_PROVIDER=gumroad
 *   GUMROAD_ACCESS_TOKEN=<from gumroad.com/settings/advanced → Access Token>
 *   GUMROAD_WEBHOOK_SECRET=<optional, for ping signature verification>
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app
 *
 * Product mapping — set the Gumroad product permalink in env:
 *   GUMROAD_DEFAULT_PERMALINK=<e.g. "aevion">
 *   GUMROAD_PERMALINK_<REFERENCE>=<permalink>
 *   # e.g. GUMROAD_PERMALINK_BUNDLE_AI=qcoreai
 *
 * Gumroad notes:
 * - No server-side checkout creation needed — checkout URL is simply
 *   https://app.gumroad.com/l/<permalink> (or custom domain).
 * - "Ping" webhook on purchase — POST with form-encoded body.
 * - No HMAC signing by default; optionally enabled by setting a passphrase
 *   in the product settings (comes back as `url_params` hash or we do own
 *   validation via GUMROAD_ACCESS_TOKEN API lookup).
 * - No native subscriptions API — use Gumroad Memberships for recurring.
 *   Recurring ping has is_recurring_billing=true.
 * - intentId: we encode our own reference into the ?wanted_email param or
 *   use sale_id as the canonical id returned from the webhook.
 *
 * Fulfillment flow:
 *   1. createIntent → returns product page URL (no server call needed)
 *   2. User pays on Gumroad
 *   3. Gumroad pings /api/gumroad/webhook (POST, form-encoded)
 *   4. parseWebhook → extract email + sale_id → return PaymentResult(paid)
 *   5. Route handler calls provisionSubscription(email, tier)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
} from "./provider";

const GUMROAD_BASE = "https://api.gumroad.com/v2";

function accessToken(): string {
  const v = process.env.GUMROAD_ACCESS_TOKEN;
  if (!v) throw new Error("Gumroad: missing GUMROAD_ACCESS_TOKEN");
  return v;
}

function publicBase(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}

// Мерж 06.09.2026: объединены ДВЕ починки. Из deploy/all — параметр
// `explicit` (переданная ссылка перебивает всё: без этого общая запасная
// ссылка уводила покупателя на чужой продукт, см. PaymentIntentInput).
// Из feat/funnel-upsell-allaccess — чтение двух написаний переменной и
// предупреждение, когда не настроено ни одно.
function resolvePermalink(reference: string, explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  const ключ = reference.toUpperCase().replace(/[^A-Z0-9]/g, "_");

  /*
   * ДВЕ ЗАПИСИ ОДНОГО ИМЕНИ, и ворота с действием читали разные.
   *
   * Маршрут Конституции решает «есть ли у нас пермалинк», спрашивая
   * `GUMROAD_CONSTITUTION_PRO_PERMALINK` — она и задана на проде. Сюда же
   * приходит ссылка `constitution-pro`, и искали мы
   * `GUMROAD_PERMALINK_CONSTITUTION_PRO` — другую переменную, не заданную
   * нигде. Ворота говорили «есть», действие не находило.
   *
   * Сегодня расхождение скрыто: ключ LemonSqueezy задан, и до ветки Gumroad
   * дело не доходит. Уберут его — и покупатель уедет по ссылке, собранной из
   * САМОЙ ссылки (`gumroad.com/l/constitution-pro`), то есть на товар,
   * которого может не быть. Ошибка проявится ровно тогда, когда откажет
   * первый провайдер, — в момент, когда запас и нужен.
   *
   * Обе записи читаем здесь, а не переименовываем переменную: имя живёт в
   * настройках сервиса, и переименование сломало бы работающие ворота.
   */
  const порядок = [
    process.env[`GUMROAD_PERMALINK_${ключ}`],
    process.env[`GUMROAD_${ключ}_PERMALINK`],
    process.env.GUMROAD_DEFAULT_PERMALINK,
  ];
  const найденный = порядок.find((v) => typeof v === "string" && v.trim() !== "")?.trim();
  if (!найденный) {
    /*
     * Ни одного сопоставления и нет товара по умолчанию — адрес соберётся из
     * САМОЙ ссылки, а такого товара у Gumroad может не быть. Прежде это
     * происходило молча: покупатель нажимал «купить» и попадал на страницу
     * несуществующего товара, а у нас не оставалось ни следа.
     *
     * Поведение не меняем — вернуть отказ отсюда значило бы сломать вызовы, где
     * ссылка И ЕСТЬ пермалинк. Но молчать перестаём.
     */
    console.warn(
      `[gumroad] пермалинк для "${reference}" не настроен ни одним именем ` +
        `(GUMROAD_PERMALINK_${ключ}, GUMROAD_${ключ}_PERMALINK, GUMROAD_DEFAULT_PERMALINK) — ` +
        `адрес кассы соберётся из самой ссылки`,
    );
  }
  return найденный ?? reference;
}

/**
 * Из значения переменной делаем СЛАГ.
 *
 * Значение может быть и слагом (`pyiaz`), и полной ссылкой, скопированной со
 * страницы товара (`https://aevion.gumroad.com/l/pyiaz`) — второе куда
 * естественнее при настройке. До 03.09.2026 префикс приклеивался слепо, и из
 * полной ссылки получалось `https://app.gumroad.com/l/https://aevion.gumroad.com/l/pyiaz`:
 * ручка отвечает 200, покупатель жмёт «оплатить» и попадает на 404 у Gumroad.
 * Тариф просто нельзя купить, и снаружи это неотличимо от исправной работы.
 *
 * Правило то же, что в devhub.ts (там этот случай уже предусмотрен): срезать
 * `https://хост/l/`, ведущие косые и хвост после `/?#`.
 */
function permalinkSlugFromEnv(raw: string): string {
  return raw.trim().replace(/^https?:\/\/[^/]+\/l\//i, "").replace(/^\/+|[/?#].*$/g, "");
}

// Мерж 06.09.2026: объединены обе стороны — нормализация слага (выше) и
// канал привлечения тем же именем, которое уже читает наш вебхук
// (`url_params[channel]`): иначе канал доезжает не всеми путями, а выручка
// по каналам считается только там, где известны И сумма, И канал.
function gumroadCheckoutUrl(
  permalink: string,
  email?: string | null,
  channel?: string | null,
): string {
  const q = new URLSearchParams();
  if (email) q.set("wanted_email", email);
  if (channel) q.set("url_params[channel]", channel);
  const qs = q.toString();
  const base = `https://app.gumroad.com/l/${permalinkSlugFromEnv(permalink)}`;
  return qs ? `${base}?${qs}` : base;
}

export const gumroadPaymentProvider: PaymentProvider = {
  id: "gumroad",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const permalink = resolvePermalink(input.reference, input.permalink);
    const checkoutUrl = gumroadCheckoutUrl(permalink, input.email, input.customData?.channel);
    // intentId = permalink:email:ts — used for loose dedup (Gumroad has no
    // server-created intent; sale_id from the webhook is the real id).
    const intentId = `gumroad:${permalink}:${Date.now()}`;
    return {
      intentId,
      checkoutUrl,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  async getIntent(intentId: string): Promise<PaymentResult> {
    // Gumroad doesn't support intent-style polling. If we stored the sale_id
    // (from webhook) we can look it up. intentId format: "gumroad:<saleId>"
    // for webhook-sourced ids, or the loose create-time id otherwise.
    const saleId = intentId.startsWith("gumroad:sale:")
      ? intentId.slice("gumroad:sale:".length)
      : null;
    if (!saleId) {
      return { status: "unpaid", paidAt: null, reason: "no_sale_id", raw: null };
    }
    try {
      const r = await fetch(`${GUMROAD_BASE}/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${accessToken()}` },
      });
      if (!r.ok) return { status: "failed", paidAt: null, reason: `api_${r.status}`, raw: null };
      const j = (await r.json()) as { sale?: { created_at?: string } };
      const sale = j.sale;
      if (!sale) return { status: "failed", paidAt: null, reason: "not_found", raw: j };
      return { status: "paid", paidAt: sale.created_at ?? null, reason: null, raw: sale };
    } catch (err) {
      return { status: "failed", paidAt: null, reason: err instanceof Error ? err.message : "unknown", raw: null };
    }
  },

  parseWebhook(headers: Record<string, string>, rawBody: string) {
    // Gumroad sends form-encoded POST. Parse manually.
    const params = new URLSearchParams(rawBody);
    const saleId = params.get("sale_id") ?? params.get("id") ?? "";
    const email = params.get("email") ?? "";
    const refunded = params.get("refunded") === "true";
    const disputed = params.get("disputed") === "true";
    const cancelled = params.get("subscription_cancelled") === "true";
    const failed = params.get("subscription_failed") === "true";

    // Optional passphrase check — Gumroad includes "url_params" field if
    // you set a passphrase. We use a simpler shared GUMROAD_WEBHOOK_SECRET:
    const secret = process.env.GUMROAD_WEBHOOK_SECRET;
    if (secret) {
      const presented = headers["x-gumroad-signature"] ?? params.get("signature") ?? "";
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      try {
        const a = Buffer.from(presented.padEnd(expected.length, "0"));
        const b = Buffer.from(expected);
        if (!timingSafeEqual(a, b)) {
          return {
            intentId: `gumroad:sale:${saleId}`,
            result: { status: "failed" as const, paidAt: null, reason: "invalid_signature", raw: {} },
          };
        }
      } catch {
        // signature lengths differ — treat as invalid
        return {
          intentId: `gumroad:sale:${saleId}`,
          result: { status: "failed" as const, paidAt: null, reason: "invalid_signature", raw: {} },
        };
      }
    }

    let status: "paid" | "failed" | "refunded" = "paid";
    if (refunded) status = "refunded";
    else if (disputed || cancelled || failed) status = "failed";

    return {
      intentId: `gumroad:sale:${saleId}`,
      eventId: saleId,
      result: {
        status,
        paidAt: params.get("sale_timestamp") ?? new Date().toISOString(),
        reason: refunded ? "refunded" : disputed ? "disputed" : cancelled ? "cancelled" : failed ? "failed" : null,
        raw: Object.fromEntries(params.entries()),
      },
    };
  },
};

/**
 * Подтверждение продажи через Gumroad API.
 *
 * ЗАЧЕМ. Ping-вебхук Gumroad по умолчанию НЕ подписан: проверка HMAC в
 * parseWebhook включается только при заданном GUMROAD_WEBHOOK_SECRET. На проде
 * 2026-07-26 секрет не задан (`/api/gumroad/webhook` отвечает `signed:false`),
 * а Ping-адрес публично известен — значит, любой POST с чужим email выдавал бы
 * платный тариф без единого платежа. Докстринг этого файла с самого начала
 * предполагал «own validation via GUMROAD_ACCESS_TOKEN API lookup», но она не
 * была написана; вот она.
 *
 * ПОЛИТИКА ОТКАЗА — намеренно консервативная. Отклоняем только когда Gumroad
 * ОПРЕДЕЛЁННО отвечает, что такой продажи нет. Если подтвердить не удалось
 * (нет токена, сеть, 5xx) — возвращаем "unverifiable", и вызывающий код ведёт
 * себя ровно как раньше. Так подделка отсекается детерминированно, а реальный
 * покупатель не теряет доступ из-за сбоя стороннего API.
 */
export type SaleVerdict = "confirmed" | "not_found" | "unverifiable";

/**
 * Подтверждение продажи ВМЕСТЕ С ЕЁ ДАННЫМИ.
 *
 * Зачем понадобилось (19.08.2026). Проверка существования продажи стоит здесь
 * с 26.07 и работает — поддельный номер отвергается, проверено на проде.
 * Но обработчик вебхука брал ТОВАР и АДРЕС из тела запроса, а не из
 * подтверждённой продажи. Значит обладатель настоящего дешёвого чека мог
 * прислать его номер, указав `product_id` дорогого тарифа, и получить дорогой;
 * и он же мог выписать права на чужой адрес.
 *
 * Прежняя `verifyGumroadSale` оставлена БЕЗ ИЗМЕНЕНИЙ по подписи: её зовут
 * четыре чужие незамёрженные ветки, и менять форму ответа значило бы создать
 * им конфликт на ровном месте. Обе функции делят одну реализацию.
 */
export async function verifyGumroadSaleDetailed(
  saleId: string,
): Promise<{ verdict: SaleVerdict; sale: Record<string, unknown> | null }> {
  const verdict = await verifyGumroadSaleImpl(saleId);
  return verdict;
}

export async function verifyGumroadSale(saleId: string): Promise<SaleVerdict> {
  return (await verifyGumroadSaleImpl(saleId)).verdict;
}

async function verifyGumroadSaleImpl(
  saleId: string,
): Promise<{ verdict: SaleVerdict; sale: Record<string, unknown> | null }> {
  if (!saleId) return { verdict: "unverifiable", sale: null };
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) return { verdict: "unverifiable", sale: null };

  try {
    const url = `${GUMROAD_BASE}/sales/${encodeURIComponent(saleId)}?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });

    // 404 — продажи с таким id у нас нет. Единственный случай, когда мы уверены,
    // что пинг поддельный или адресован не нам.
    if (r.status === 404) return { verdict: "not_found", sale: null };
    if (!r.ok) return { verdict: "unverifiable", sale: null };

    const body = (await r.json()) as { success?: boolean; sale?: unknown };
    if (body?.success === true && body.sale)
      return { verdict: "confirmed", sale: body.sale as Record<string, unknown> };
    // success:false с кодом 200 Gumroad отдаёт на несуществующий id.
    if (body?.success === false) return { verdict: "not_found", sale: null };
    return { verdict: "unverifiable", sale: null };
  } catch {
    return { verdict: "unverifiable", sale: null };
  }
}

/**
 * Какие тарифы Gumroad РЕАЛЬНО может продать — по именам, без значений.
 *
 * Токен доступа отвечает на вопрос «настроен ли провайдер», а продать тариф
 * Gumroad может только при заданной ссылке на товар:
 * GUMROAD_PERMALINK_<REFERENCE> либо общая GUMROAD_DEFAULT_PERMALINK. Это
 * разные вопросы, и снаружи второй виден не был — ровно как было у
 * LemonSqueezy до появления sellable.
 *
 * Важно это стало 29.08.2026: выбор провайдера уходит на Gumroad, когда
 * LemonSqueezy не может ВЫДАТЬ купленное. Уходить есть смысл только туда, где
 * тариф действительно продаётся; иначе покупатель получит честный 503, но
 * продажи в этот момент остановятся — и знать об этом надо заранее.
 *
 * Значения переменных не возвращаются никогда, только имена тарифов.
 */
export function gumroadSellable(references: string[]): {
  configured: string[];
  missing: string[];
} {
  const общая = Boolean(process.env.GUMROAD_DEFAULT_PERMALINK?.trim());
  const configured: string[] = [];
  const missing: string[] = [];
  for (const ref of references) {
    const key = `GUMROAD_PERMALINK_${ref.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    (process.env[key]?.trim() || общая ? configured : missing).push(ref);
  }
  return { configured: configured.sort(), missing: missing.sort() };
}

/**
 * Constitution checkout — LemonSqueezy (primary, Paddle blocked).
 *
 *   POST /api/constitution/checkout/session { tier: "pro"|"team", email? }
 *   → { checkoutUrl, tier, provider: "lemonsqueezy" }
 *
 * Required env:
 *   LEMON_SQUEEZY_API_KEY                      (from LS Settings → API)
 *   LEMON_SQUEEZY_STORE_ID                     (numeric, from LS dashboard)
 *   LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID  (e.g. 123456)
 *   LEMON_SQUEEZY_CONSTITUTION_TEAM_VARIANT_ID (e.g. 123457)
 *   AEVION_PUBLIC_BASE_URL = https://aevion.app
 *
 * How to get variant IDs:
 *   1. LS Dashboard → Store → Products
 *   2. Create product "Constitution Pro" (one-off or monthly recurring)
 *   3. Click product → Variants tab → copy variant ID from URL /variants/{id}
 *
 * Fallback (stub):
 *   If LEMON_SQUEEZY_API_KEY is missing, returns a stub response so the
 *   frontend stays functional during development.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { makeServiceCapture } from "../lib/sentry/platform";
import { CONSTITUTION_TIERS, constitutionTierLabel, type ConstitutionTier } from "../data/pricing";

const capture = makeServiceCapture("constitutionCheckout");

// Цены и названия берутся из общего прайса напрямую. Здесь БЫЛИ две
// собственные таблицы — из-за них цена Конституции жила в трёх местах сразу и
// могла разойтись молча. Даже локальный алиас, читающий общий источник, не
// оставляю: по форме он неотличим от своей таблицы, и следующий добавит в него
// строку, не заметив разницы. Единственный источник — data/pricing.ts.
type Tier = ConstitutionTier;

const priceOf = (tier: Tier): number => CONSTITUTION_TIERS[tier].priceUsd;
const nameOf = (tier: Tier): string => constitutionTierLabel(tier);

function lsVariantId(tier: Tier): string | null {
  const key = tier === "pro"
    ? "LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID"
    : "LEMON_SQUEEZY_CONSTITUTION_TEAM_VARIANT_ID";
  return process.env[key] ?? null;
}

function lsApiKey(): string | null { return process.env.LEMON_SQUEEZY_API_KEY ?? null; }
function lsStoreId(): string | null { return process.env.LEMON_SQUEEZY_STORE_ID ?? null; }

/**
 * Готов ли LemonSqueezy ПОЛНОСТЬЮ — то есть можно ли реально создать чек.
 *
 * Проверять один только ключ API нельзя, и это не педантизм: `createLsCheckout`
 * требует ТРИ значения (ключ, магазин, вариант тарифа) и бросает, если нет
 * любого. Пока здесь стоял `Boolean(lsApiKey())`, наполовину настроенный
 * LemonSqueezy ВКЛЮЧАЛ свою ветку, заслонял готовый запасной Gumroad — и
 * покупатель получал 500 вместо кассы. Ровно это и пришло в Sentry с прода:
 * "LemonSqueezy not configured. Required: LEMON_SQUEEZY_API_KEY,
 * LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID".
 *
 * Признак живёт в ОДНОЙ функции намеренно: у него два места вызова, и стоит
 * повторить условие копией — они разъедутся, а сторож этого не заметит.
 */
/**
 * Ссылка товара Gumroad для тарифа — ОДИН источник и для решения «можно ли
 * платить», и для самой ссылки.
 *
 * Раньше это были два РАЗНЫХ источника, и они не совпадали: готовность
 * проверялась по `GUMROAD_CONSTITUTION_<TIER>_PERMALINK`, а адрес строил
 * провайдер по `GUMROAD_PERMALINK_<REFERENCE>` / `GUMROAD_DEFAULT_PERMALINK`,
 * про наше имя не знающий вовсе. Совпадали они только по счастливой случайности.
 *
 * Чем это кончалось: настроена наша переменная — чекаут говорит «Gumroad готов»
 * и ведёт покупателя на `app.gumroad.com/l/constitution-pro`, то есть на
 * ПРИДУМАННЫЙ адрес (настоящие ссылки товаров видны в gumroadWebhook.ts:
 * `pyiaz` и `wjvquw`). Ответ при этом 200 и `provider: "gumroad"` — снаружи
 * неотличимо от успеха, а деньги не приходят. Обратная сторона тоже неверна:
 * настроено имя, которое читает провайдер, — а чекаут отвечает «не настроено».
 */
function gumroadPermalink(tier: Tier): string | null {
  const upper = tier.toUpperCase();
  // Запасное имя ...PRO_PERMALINK годится ТОЛЬКО для тарифа pro. Оно досталось
  // от прежней проверки готовности, где было почти безвредно: адрес всё равно
  // строился из другого источника. Как только адрес начал браться отсюда,
  // цена ошибки выросла — покупателя тарифа Team увело бы на товар Pro, то
  // есть на чужой продукт по чужой цене. Общий `GUMROAD_DEFAULT_PERMALINK`
  // оставлен намеренно: он задуман как catch-all для любого тарифа.
  const tierSpecific = process.env[`GUMROAD_CONSTITUTION_${upper}_PERMALINK`]
    ?? process.env[`GUMROAD_PERMALINK_CONSTITUTION_${upper}`]
    ?? (tier === "pro" ? process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK : undefined);
  return tierSpecific ?? process.env.GUMROAD_DEFAULT_PERMALINK ?? null;
}

function lsReady(tier: Tier): boolean {
  return Boolean(lsApiKey() && lsStoreId() && lsVariantId(tier));
}
function publicBase(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}

async function createLsCheckout(
  tier: Tier,
  email?: string,
  intentId = randomUUID(),
): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const variantId = lsVariantId(tier);
  const apiKey = lsApiKey();
  const storeId = lsStoreId();
  if (!apiKey || !storeId || !variantId) {
    throw new Error(
      `LemonSqueezy not configured. Required: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_CONSTITUTION_${tier.toUpperCase()}_VARIANT_ID`,
    );
  }
  const base = publicBase();
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
        },
        checkout_data: {
          email: email ?? undefined,
          custom: {
            intentId,
            tier,
            source: "constitution-pricing",
          },
        },
        product_options: {
          name: nameOf(tier),
          receipt_link_url: `${base}/constitution/pricing`,
          redirect_url: `${base}/constitution?upgrade=success&tier=${tier}`,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LemonSqueezy API ${res.status}: ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    data?: { id?: string; attributes?: { url?: string } };
  };
  const checkoutUrl = j.data?.attributes?.url;
  const checkoutId = j.data?.id ?? "";
  if (!checkoutUrl) throw new Error("LemonSqueezy: no checkout URL in response");
  return { checkoutUrl, checkoutId };
}

export const constitutionCheckoutRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "constitution-checkout" });

constitutionCheckoutRouter.post(
  "/session",
  limiter as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const tier = (body.tier === "team" ? "team" : "pro") as Tier;
      const email = typeof body.email === "string" ? body.email.trim() : undefined;

      // Provider priority: LemonSqueezy (if configured) → Gumroad → stub
      const hasLs = lsReady(tier);
      const hasGumroad = Boolean(gumroadPermalink(tier));

      if (!hasLs && !hasGumroad) {
        return res.json({
          checkoutUrl: `${publicBase()}/constitution/pricing?stub=1&tier=${tier}`,
          tier,
          tierName: nameOf(tier),
          priceUsd: priceOf(tier),
          provider: "stub",
          // 28.08.2026: в `note` стояли ИМЕНА переменных окружения. Заглушка
          // честно называет себя (`provider: "stub"`) — это правильно и
          // остаётся; имена настройки наружу не нужны, они в журнале.
          note: "Платёжный провайдер не настроен — это ответ-заглушка, оплата не произошла.",
        });
      }

      if (hasLs) {
        const { checkoutUrl, checkoutId } = await createLsCheckout(tier, email);
        return res.json({
          checkoutUrl,
          checkoutId,
          tier,
          tierName: nameOf(tier),
          priceUsd: priceOf(tier),
          provider: "lemonsqueezy",
        });
      }

      // Gumroad fallback
      const intent = await gumroadPaymentProvider.createIntent({
        reference: `constitution-${tier}`,
        permalink: gumroadPermalink(tier) ?? undefined,
        amountCents: priceOf(tier) * 100,
        currency: "USD",
        description: nameOf(tier),
        email,
      });
      res.json({
        checkoutUrl: intent.checkoutUrl,
        tier,
        tierName: nameOf(tier),
        priceUsd: priceOf(tier),
        provider: "gumroad",
      });
    } catch (err) {
      capture(err);
      // 28.08.2026: раньше в ответе уходили `detail` с текстом исключения и
      // `hint` с ИМЕНАМИ переменных окружения. Проверено пробой снаружи, без
      // авторизации: любой вызывающий получал
      //   "Required: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID,
      //    LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID"
      // то есть карту нашей настройки. Подсказка полезна НАМ, а читает её кто
      // угодно. Диагностика уходит в журнал и в Sentry (capture выше), наружу —
      // причина без внутренностей.
      const why = err instanceof Error ? err.message : "unknown";
      console.error("[constitution/checkout] отказ:", why);
      res.status(500).json({
        error: "checkout_failed",
        message_ru: "Касса сейчас недоступна. Мы уже знаем о сбое — попробуйте позже.",
        message_en: "Checkout is unavailable right now. We are on it — please try again later.",
      });
    }
  },
);

/** Convenience GET → redirect to checkout (for email links, QR codes, etc.) */
constitutionCheckoutRouter.get(
  "/go/:tier",
  limiter as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    const tier = (req.params.tier === "team" ? "team" : "pro") as Tier;
    const hasLs = lsReady(tier);
    const hasGumroad = Boolean(gumroadPermalink(tier));
    if (!hasLs && !hasGumroad) {
      return res.redirect(`${publicBase()}/constitution/pricing`);
    }
    try {
      if (hasLs) {
        const { checkoutUrl } = await createLsCheckout(tier);
        return res.redirect(303, checkoutUrl);
      }
      // Gumroad
      const intent = await gumroadPaymentProvider.createIntent({
        reference: `constitution-${tier}`,
        permalink: gumroadPermalink(tier) ?? undefined,
        amountCents: priceOf(tier) * 100,
        currency: "USD",
        description: nameOf(tier),
      });
      res.redirect(303, intent.checkoutUrl);
    } catch {
      res.redirect(`${publicBase()}/constitution/pricing?error=checkout_failed`);
    }
  },
);

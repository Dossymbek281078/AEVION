import { Router } from "express";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { lemonSqueezyPaymentProvider } from "../lib/payment/lemonSqueezyProvider";
import { payboxPaymentProvider, isPayboxConfigured } from "../lib/payment/payboxProvider";
import { paypalPaymentProvider, isPaypalConfigured } from "../lib/payment/paypalProvider";
import { resolveLemonSqueezyVariant } from "../data/lemonSqueezyVariants";
import {
  TIERS, getTier, getModulePrice, resolvePromoCode, CURRENCY_RATES, MAX_PROMO_DISCOUNT_RATIO,
  type TierId, type BillingPeriod, type CurrencyCode,
} from "../data/pricing";
import { provisionSubscription, countSubscriptions } from "./provisioning";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("checkout");

export const checkoutRouter = Router();

/**
 * Подписочный чекаут (Lite / Medium / Full) с каскадом процессингов:
 *   1. LemonSqueezy — основной живой процессинг (аккаунт активирован 2026-06-04).
 *      Провижининг — на POST /api/lemonsqueezy/webhook.
 *   2. Gumroad — fallback (one-time продукты). Провижининг — на POST /api/gumroad/webhook.
 *   3. Stub — если ни один не настроен для данного tier:period.
 *
 * Цена фиксируется в продукте процессинга (LS variant / Gumroad product) — она
 * ДОЛЖНА совпадать с tier-ценой из data/pricing.ts (lite 24/240, medium 39/390,
 * full 89/890 — repriced 2026-07-22, см. docs/PRICING_STRATEGY_2026-07.md).
 * Меняя цену в pricing.ts, не забудь обновить и сам LS variant / Gumroad
 * permalink на дашборде процессинга — этот файл не меняет, что реально спишут.
 *
 * ENV:
 *   LemonSqueezy: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID,
 *     LEMON_SQUEEZY_VARIANT_{LITE,MEDIUM,FULL}_{MONTHLY,ANNUAL}
 *   Gumroad (fallback): GUMROAD_PERMALINK_TIER_{LITE,MEDIUM,FULL}_{MONTHLY,ANNUAL},
 *     GUMROAD_DEFAULT_PERMALINK
 */

const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

/** A Gumroad checkout is "real" only when a product permalink is configured. */
function gumroadPermalinkConfigured(reference: string): boolean {
  const envKey = `GUMROAD_PERMALINK_${reference.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return Boolean(process.env[envKey] || process.env.GUMROAD_DEFAULT_PERMALINK);
}

interface CheckoutBody {
  tierId: TierId;
  period?: "monthly" | "annual";
  seats?: number;
  modules?: string[];
  promoCode?: string;
  email?: string;
  trial?: boolean;
  /** Валюта оплаты. "KZT" → локальный канал PayBox (если настроен), иначе USD/LS. */
  currency?: CurrencyCode;
  /** Способ оплаты. "paypal" → канал PayPal (если настроен), иначе дефолтный каскад. */
  method?: "card" | "paypal";
}

// ── POST /session ─────────────────────────────────────────────────────────────
checkoutRouter.post("/session", async (req, res) => {
  try {
    const body = (req.body ?? {}) as CheckoutBody;

    if (!body.tierId || !["free", "lite", "medium", "full", "pro", "enterprise"].includes(body.tierId)) {
      return res.status(400).json({ error: "invalid_tier" });
    }
    const tier = getTier(body.tierId)!;
    const period: BillingPeriod = body.period === "annual" ? "annual" : "monthly";
    const seats = Math.max(1, Math.min(1000, body.seats ?? 1));

    if (tier.id === "free") {
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=free`,
        mode: "stub",
      });
    }

    if (tier.id === "enterprise") {
      return res.json({
        url: `${FRONTEND_URL}/pricing/contact?tier=enterprise`,
        mode: "stub",
      });
    }

    const tierUsd = period === "annual" ? (tier.priceAnnualTotal ?? 0) : (tier.priceMonthly ?? 0);

    let totalUsd = tierUsd;

    // Extra seats
    const baseSeats = tier.limits.seats ?? 1;
    const extraSeats = Math.max(0, seats - baseSeats);
    if (extraSeats > 0) {
      totalUsd += 5 * extraSeats * (period === "annual" ? 12 : 1);
    }

    // Add-on modules.
    //
    // Lite grants "1 product of your choice" with full access to it (see its
    // tagline/features in data/pricing.ts). The chosen module covered by Lite's
    // module allowance must NOT also be billed its à-la-carte add-on — that
    // would double-charge the very thing Lite buys (e.g. Lite + qsign would
    // wrongly come to $19 + $9 = $28 instead of $19). Modules beyond the
    // allowance, or on tiers without a free-choice slot, still incur the add-on.
    const freeChoiceSlots = tier.id === "lite" ? (tier.limits.modules ?? 0) : 0;
    let usedChoiceSlots = 0;
    for (const mid of body.modules ?? []) {
      const m = getModulePrice(mid);
      if (!m || m.includedIn.includes(tier.id)) continue;
      if (usedChoiceSlots < freeChoiceSlots) { usedChoiceSlots++; continue; }
      if (!m.addonMonthly) continue;
      totalUsd += m.addonMonthly * (period === "annual" ? 12 : 1);
    }

    // Promo code discount
    let discountUsd = 0;
    if (body.promoCode) {
      const { promo } = resolvePromoCode(body.promoCode, tier.id, period);
      if (promo) {
        const subtotal = totalUsd;
        const rawDiscount = promo.kind === "percent"
          ? Math.round(subtotal * promo.amount) / 100
          : Math.min(subtotal, promo.amount * (period === "annual" ? 12 : 1));
        discountUsd = Math.min(rawDiscount, subtotal * MAX_PROMO_DISCOUNT_RATIO);
        totalUsd = Math.max(0, totalUsd - discountUsd);
      }
    }

    const trialDays = body.trial && (tier.id === "lite" || tier.id === "medium" || tier.id === "full") ? 14 : 0;
    const totalCents = Math.round(totalUsd * 100);

    const reference = `tier_${tier.id}_${period}`;

    // Free / fully discounted — no checkout needed, provision directly
    if (totalCents <= 0) {
      if (body.email) {
        provisionSubscription({
          email: body.email, tierId: tier.id, period, seats,
          modules: body.modules ?? [], trialDays, amountUsd: 0,
          promoCode: body.promoCode, source: "gumroad_zero",
        }).catch((e) => console.error("[provisioning] zero-price failed", e));
      }
      return res.json({
        url: `${FRONTEND_URL}/pricing/checkout/success?gumroad=true&tier=${tier.id}&period=${period}&total=0`,
        mode: "zero",
        provider: "gumroad",
      });
    }

    const description = `AEVION ${tier.name} ${period === "annual" ? "Annual" : "Monthly"}`;

    // 0) PayBox — локальный KZT-канал (карты КЗ + Kaspi). Срабатывает только
    //    когда плательщик явно выбрал KZT и провайдер настроен. Сумму USD
    //    конвертируем в тенге по курсу из CURRENCY_RATES; PayBox принимает
    //    pg_amount в основной единице (тенге), поэтому передаём amountCents в
    //    тыйынах (тенге*100), а провайдер делит на 100.
    if (body.currency === "KZT" && isPayboxConfigured()) {
      try {
        const kztCents = Math.round(totalCents * CURRENCY_RATES.KZT.rate);
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await payboxPaymentProvider.createIntent({
          reference, amountCents: kztCents, currency: "KZT", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
        });
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "paybox", intentId: intent.intentId });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] PayBox createIntent failed, falling back to LS/Gumroad/stub", e);
      }
    }

    // 0b) PayPal — глобальный карт/PayPal-канал. Срабатывает только когда
    //     плательщик явно выбрал method="paypal" и провайдер настроен.
    if (body.method === "paypal" && isPaypalConfigured()) {
      try {
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await paypalPaymentProvider.createIntent({
          reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
        });
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "paypal", intentId: intent.intentId });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] PayPal createIntent failed, falling back to LS/Gumroad/stub", e);
      }
    }

    // 1) LemonSqueezy — основной живой процессинг подписок (аккаунт активирован).
    //    Используется, когда задан LS API + variant для этого tier:period.
    const lsReady =
      Boolean(process.env.LEMON_SQUEEZY_API_KEY?.trim()) &&
      Boolean(process.env.LEMON_SQUEEZY_STORE_ID?.trim()) &&
      Boolean(resolveLemonSqueezyVariant(reference));
    if (lsReady) {
      try {
        // Lite = 1 продукт на выбор: пробрасываем выбранный модуль в custom_data,
        // чтобы вебхук провижинил подписку именно на него.
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await lemonSqueezyPaymentProvider.createIntent({
          reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
        });
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "lemonsqueezy", intentId: intent.intentId });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] LS createIntent failed, falling back to Gumroad/stub", e);
      }
    }

    // 2) Gumroad — fallback (one-time продукты / пока LS не настроен).
    if (gumroadPermalinkConfigured(reference)) {
      const intent = await gumroadPaymentProvider.createIntent({
        reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
      });
      return res.json({ url: intent.checkoutUrl, mode: "real", provider: "gumroad", intentId: intent.intentId });
    }

    // 3) Stub — ни один процессинг не настроен для этого tier:period.
    if (body.email) {
      provisionSubscription({
        email: body.email,
        tierId: tier.id,
        period,
        seats,
        modules: body.modules ?? [],
        trialDays,
        amountUsd: totalUsd,
        promoCode: body.promoCode,
        source: "stub_checkout",
      }).catch((e) => console.error("[stub_provisioning] failed", e));
    }
    return res.json({
      url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=${tier.id}&period=${period}&total=${totalCents}`,
      mode: "stub",
      provider: "none",
    });
  } catch (e: unknown) {
    capture(e);
    console.error("[checkout/session] failed", e);
    res.status(500).json({ error: "checkout_failed", message: e instanceof Error ? e.message : String(e) });
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
// Paddle webhook removed. Gumroad sale provisioning is handled centrally by
// POST /api/gumroad/webhook (routes/gumroadWebhook.ts). Keep this path as a
// 410 so any stale Paddle webhook config fails loudly instead of silently 200.
checkoutRouter.post("/webhook", (_req, res) => {
  res.status(410).json({
    error: "gone",
    message: "Paddle webhook removed — Gumroad sales are provisioned at POST /api/gumroad/webhook",
  });
});

// ── GET /subscriptions/count ──────────────────────────────────────────────────
checkoutRouter.get("/subscriptions/count", (_req, res) => {
  res.json({ total: countSubscriptions() });
});

// ── GET /healthz ──────────────────────────────────────────────────────────────
checkoutRouter.get("/healthz", (_req, res) => {
  const lsReady =
    Boolean(process.env.LEMON_SQUEEZY_API_KEY?.trim()) &&
    Boolean(process.env.LEMON_SQUEEZY_STORE_ID?.trim());
  res.json({
    ok: true,
    primaryProvider: lsReady ? "lemonsqueezy" : "gumroad",
    providers: {
      lemonsqueezy: { configured: lsReady, webhook: "/api/lemonsqueezy/webhook" },
      gumroad: { configured: Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim()), webhook: "/api/gumroad/webhook" },
      paybox: { configured: isPayboxConfigured(), trigger: "currency=KZT", webhook: "/api/paybox/webhook" },
      paypal: { configured: isPaypalConfigured(), trigger: "method=paypal", webhook: "/api/paypal/webhook" },
    },
    frontendUrl: FRONTEND_URL,
  });
});

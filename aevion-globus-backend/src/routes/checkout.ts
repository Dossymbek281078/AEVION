import { Router } from "express";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { lemonSqueezyPaymentProvider } from "../lib/payment/lemonSqueezyProvider";
import { payboxPaymentProvider, isPayboxConfigured } from "../lib/payment/payboxProvider";
import { paypalPaymentProvider, isPaypalConfigured } from "../lib/payment/paypalProvider";
import { resolveLemonSqueezyVariant } from "../data/lemonSqueezyVariants";
import {
  TIERS, getTier, CURRENCY_RATES,
  type TierId, type BillingPeriod, type CurrencyCode,
} from "../data/pricing";
import { buildQuoteWithFan } from "../data/fanDiscounts";
import { recordCheckoutSession, integritySummary } from "../lib/discountIntegrityLog";
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
  /** Уже купленные модули — источник веерной скидки (data/fanDiscounts.ts). */
  ownedModules?: string[];
  /** ISO-дата последней покупки: от неё считается окно веера. */
  lastPurchaseAt?: string;
}

/**
 * Умеет ли канал списать ПРОИЗВОЛЬНУЮ сумму (т.е. может ли скидка стать
 * реальной), или он спишет фиксированную цену продукта на своей стороне.
 *
 * Проверено по коду провайдеров 2026-07-26:
 *   - paybox  — `pg_amount` = наша сумма → да.
 *   - paypal  — Orders v2 `amount.value` = наша сумма → да.
 *   - lemonsqueezy — createIntent НЕ передаёт ни `custom_price`, ни
 *     `discount_code`: LS спишет цену варианта. `amountCents` в LS-провайдере
 *     только возвращается назад в ответе, на счёт не влияет.
 *   - gumroad — checkoutUrl = `app.gumroad.com/l/<permalink>` (+ email):
 *     цена продукта, скидку выразить нечем (нужен offer-code в URL).
 *
 * Из этого следует то, что до сих пор было незаметно: на LS и Gumroad
 * промокод/веер НЕ доходят до счёта. Раньше чекаут молча отдавал ссылку на
 * полную цену, показав пользователю скидку в смете. Теперь либо скидка
 * реальна, либо ответ прямо говорит `discountHonoured: false` и сумму, которую
 * действительно спишут; провижининг тоже пишет реальную сумму.
 *
 * `LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE=1` включает передачу custom_price в LS —
 * тогда скидка на LS становится настоящей (цена фиксируется на весь срок
 * подписки, это осознанная семантика «зафиксируй цену, пока веер открыт»).
 */
function channelHonoursAmount(provider: "paybox" | "paypal" | "lemonsqueezy" | "gumroad" | "stub"): boolean {
  switch (provider) {
    case "paybox":
    case "paypal":
    case "stub":
      return true;
    case "lemonsqueezy":
      return process.env.LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE === "1";
    case "gumroad":
      return false;
  }
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

    // Смета — ОДНА реализация и для показа, и для списания. До 2026-07-26 здесь
    // лежала вторая копия той же арифметики, и она уже разошлась с
    // /api/pricing/quote: процентное промо там округлялось до доллара, здесь до
    // цента (Full+AEVION20 — смета обещала итог $71, чекаут выставлял $71.20).
    // Правило: любой новый потребитель сметы зовёт buildQuoteWithFan, а не
    // считает сам. Веерные скидки (data/fanDiscounts.ts) приходят тем же путём.
    const quote = buildQuoteWithFan({
      tierId: tier.id,
      modules: body.modules ?? [],
      seats,
      period,
      currency: "USD",
      promoCode: body.promoCode,
      ownedModules: body.ownedModules ?? [],
      lastPurchaseAt: body.lastPurchaseAt,
    });

    /** Скидки-стимулы (промо + веер). Годовая скидка сюда НЕ входит — это цена периода. */
    const incentiveUsd = Math.round(((quote.promo?.applied ?? 0) + quote.fan.applied) * 100) / 100;
    /** Что списали бы без стимулов — по этой цене сверстаны LS-варианты и Gumroad-продукты. */
    const listUsd = Math.round((quote.total + incentiveUsd) * 100) / 100;

    const discountedCents = Math.round(quote.total * 100);
    const listCents = Math.round(listUsd * 100);

    const trialDays = body.trial && (tier.id === "lite" || tier.id === "medium" || tier.id === "full") ? 14 : 0;

    const reference = `tier_${tier.id}_${period}`;

    /**
     * Что реально спишет канал + правда об этом в ответе. Ни одна ветка
     * каскада не имеет права отдать ссылку на полную цену, показав скидку в
     * смете: либо скидка доходит до счёта, либо ответ это признаёт.
     */
    function charge(provider: "paybox" | "paypal" | "lemonsqueezy" | "gumroad" | "stub") {
      const honoured = channelHonoursAmount(provider);
      const cents = honoured ? discountedCents : listCents;
      // Учёт расхождения «обещали / списали» — в lib/discountIntegrityLog.ts
      // (Postgres, при недоступной базе — счётчики в памяти). Fire-and-forget:
      // упасть на учёте нельзя, это путь к оплате.
      recordCheckoutSession({
        provider, tier: tier.id, incentiveUsd, quotedUsd: quote.total, honoured,
      });
      const truth: Record<string, unknown> = {
        quotedUsd: quote.total,
        incentiveDiscountUsd: incentiveUsd,
        discountHonoured: incentiveUsd > 0 ? honoured : true,
        fan: { status: quote.fan.status, level: quote.fan.level, appliedUsd: quote.fan.applied },
      };
      if (honoured) {
        truth.chargedUsd = Math.round(cents) / 100;
      } else {
        // Канал спишет цену СВОЕГО продукта (LS-вариант / Gumroad-permalink),
        // а она сверстана только под tier:period — add-on модули и доп. seats
        // в ней не выражаются вовсе. Значит точную сумму мы отсюда не знаем и
        // называть её числом нельзя: назвали бы — получили бы вторую ложь
        // вместо первой. Отдаём то, что знаем: цену тарифа по конвенции из
        // шапки файла + прямое указание, что остальное каналом не берётся.
        truth.chargedUsd = null;
        truth.tierListUsd = period === "annual" ? (tier.priceAnnualTotal ?? 0) : (tier.priceMonthly ?? 0);
        truth.chargedNote =
          "Канал списывает фиксированную цену своего продукта (вариант tier:period). Add-on модули и доп. пользователи в этой цене не учтены.";
        console.warn(
          `[checkout/session] канал ${provider} не принимает нашу сумму: смета $${quote.total}` +
            (incentiveUsd > 0 ? `, скидка $${incentiveUsd} НЕ применена` : "") +
            `, спишется цена варианта ${reference}`,
        );
      }
      if (incentiveUsd > 0 && !honoured) {
        truth.discountNotHonouredReason =
          provider === "lemonsqueezy"
            ? "LemonSqueezy списывает цену варианта; включите LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE=1, чтобы скидка стала реальной"
            : "Gumroad списывает цену продукта по permalink; скидку нечем выразить (нужен offer-code)";
      }
      return { cents, honoured, truth };
    }

    // Free / fully discounted — no checkout needed, provision directly
    if (discountedCents <= 0) {
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
        const paid = charge("paybox");
        const kztCents = Math.round(paid.cents * CURRENCY_RATES.KZT.rate);
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await payboxPaymentProvider.createIntent({
          reference, amountCents: kztCents, currency: "KZT", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: true,
        });
        return res.json({
          url: intent.checkoutUrl, mode: "real", provider: "paybox", intentId: intent.intentId, ...paid.truth,
          // Плательщик через PayBox платит В ТЕНГЕ — сумма в долларах ему ни о
          // чём не говорит. Отдаём то, что реально уйдёт на счёт, в валюте
          // списания: остальные поля truth остаются в USD как общая база.
          chargedKzt: Math.round(kztCents) / 100,
          chargeCurrency: "KZT",
        });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] PayBox createIntent failed, falling back to LS/Gumroad/stub", e);
      }
    }

    // 0b) PayPal — глобальный карт/PayPal-канал. Срабатывает только когда
    //     плательщик явно выбрал method="paypal" и провайдер настроен.
    if (body.method === "paypal" && isPaypalConfigured()) {
      try {
        const paid = charge("paypal");
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await paypalPaymentProvider.createIntent({
          reference, amountCents: paid.cents, currency: "USD", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: true,
        });
        return res.json({
          url: intent.checkoutUrl, mode: "real", provider: "paypal", intentId: intent.intentId, ...paid.truth,
        });
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
        const paid = charge("lemonsqueezy");
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        const intent = await lemonSqueezyPaymentProvider.createIntent({
          reference, amountCents: paid.cents, currency: "USD", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: paid.honoured,
        });
        return res.json({
          url: intent.checkoutUrl, mode: "real", provider: "lemonsqueezy", intentId: intent.intentId, ...paid.truth,
        });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] LS createIntent failed, falling back to Gumroad/stub", e);
      }
    }

    // 2) Gumroad — fallback (one-time продукты / пока LS не настроен).
    if (gumroadPermalinkConfigured(reference)) {
      const paid = charge("gumroad");
      const intent = await gumroadPaymentProvider.createIntent({
        reference, amountCents: paid.cents, currency: "USD", description, email: body.email ?? null,
      });
      return res.json({
        url: intent.checkoutUrl, mode: "real", provider: "gumroad", intentId: intent.intentId, ...paid.truth,
      });
    }

    // 3) Stub — ни один процессинг не настроен для этого tier:period.
    const paidStub = charge("stub");
    if (body.email) {
      provisionSubscription({
        email: body.email,
        tierId: tier.id,
        period,
        seats,
        modules: body.modules ?? [],
        trialDays,
        // Реально списанная сумма, а не «обещанная». На каналах, которые скидку
        // не применяют, эти числа расходятся — в подписке должно лежать то, что
        // ушло со счёта, иначе вся выручка в отчётах поедет.
        amountUsd: Math.round(paidStub.cents) / 100,
        promoCode: body.promoCode,
        source: "stub_checkout",
      }).catch((e) => console.error("[stub_provisioning] failed", e));
    }
    return res.json({
      url: `${FRONTEND_URL}/pricing/checkout/success?stub=true&tier=${tier.id}&period=${period}&total=${paidStub.cents}`,
      mode: "stub",
      provider: "none",
      ...paidStub.truth,
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

// ── GET /discount-integrity ───────────────────────────────────────────────────
// Сколько скидок мы пообещали и не применили. Публично и read-only: только
// агрегаты по каналам, ни email, ни id. ?days=N (1..365, по умолчанию 30).
checkoutRouter.get("/discount-integrity", async (req, res) => {
  try {
    const summary = await integritySummary(Number(req.query.days) || 30);
    res.json({
      ...summary,
      // Что вообще может донести скидку до счёта, а что спишет цену своего
      // продукта — чтобы цифру выше было с чем сопоставить.
      channels: {
        honoursExactAmount: ["paybox", "paypal"],
        fixedProductPrice: [
          process.env.LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE === "1" ? null : "lemonsqueezy",
          "gumroad",
        ].filter(Boolean),
      },
      // sessions/withIncentive считаются только в памяти процесса (в базу пишутся
      // лишь расхождения). При source="db" они означают «с момента старта», а
      // notHonoured/droppedUsd — «за окно»: делить одно на другое нельзя.
      note:
        summary.source === "db"
          ? "notHonoured/droppedUsdTotal — за окно из базы; sessions/withIncentive — с момента старта процесса"
          : "база недоступна: все числа — с момента старта процесса",
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "integrity_summary_failed" });
  }
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

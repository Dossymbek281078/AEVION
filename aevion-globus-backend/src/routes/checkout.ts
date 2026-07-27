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
import { readOwnedModules } from "../lib/ownedModules";
import { makeServiceCapture } from "../lib/sentry/platform";
import jwt from "jsonwebtoken";

const capture = makeServiceCapture("checkout");

/**
 * Одно правило проверки email на весь файл. Раньше это же выражение стояло
 * инлайном при провижининге; вторая копия при первой правке разошлась бы с
 * первой — а от неё зависит и то, кому выпишут подписку, и то, чьё владение
 * подтянут для веера.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Чьё владение считать при расчёте ВЕЕРНОЙ скидки на списание.
 *
 * 🔴 Найдено вычиткой дифа 2026-07-26 и подтверждено прогоном: до этой функции
 * чекаут брал `ownedModules` и `lastPurchaseAt` прямо из тела запроса и
 * передавал в `buildQuoteWithFan`, а тот уменьшал `quote.total` — то есть
 * РЕАЛЬНОЕ списание. Заявив владение пятью соседями по кластеру, любой
 * анонимный клиент получал Medium+3 модуля за **$59.35 вместо $76** (−$16.65,
 * −22%). Ни авторизации, ни сверки со стором на этом пути не было.
 *
 * Правило: скидку даёт СЕРВЕР по своим данным, клиент про владение только
 * спрашивает. Личность берём из JWT, если он есть; иначе — из email, на
 * который и будет выписана подписка (подставить чужой можно, но тогда и
 * подписка уедет ему, а не атакующему — самоограничивающийся случай).
 * Не удалось установить личность → веера нет, платится прайс.
 *
 * `/api/pricing/quote` остаётся превью «сколько бы я заплатил» и по-прежнему
 * принимает заявленное владение — там ничего не списывается.
 */
async function resolveVerifiedOwnership(
  authHeader: string | undefined,
  bodyEmail: unknown,
): Promise<{ modules: string[]; anchorAt: string | undefined; source: "token" | "email" | "none" }> {
  let email: string | null = null;

  const raw = typeof authHeader === "string" ? authHeader.trim() : "";
  if (raw.toLowerCase().startsWith("bearer ")) {
    const token = raw.slice(7).trim();
    const secret = process.env.AUTH_JWT_SECRET;
    if (token && secret) {
      try {
        // Алгоритм пиннуем: без этого часть версий jsonwebtoken принимает
        // alg:"none" (см. tests/sharedSecretsHardening.test.ts).
        const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { email?: string };
        email = payload.email?.trim().toLowerCase() || null;
      } catch {
        email = null; // битый токен — не ошибка чекаута, просто нет веера
      }
    }
  }
  const viaToken = !!email;
  if (!email && typeof bodyEmail === "string" && EMAIL_RE.test(bodyEmail.trim())) {
    email = bodyEmail.trim().toLowerCase();
  }
  if (!email) return { modules: [], anchorAt: undefined, source: "none" };

  try {
    const owned = await readOwnedModules(email);
    return {
      modules: owned.modules,
      anchorAt: owned.fanAnchorAt ?? undefined,
      source: viaToken ? "token" : "email",
    };
  } catch (e) {
    // Стор недоступен — платится прайс. Молча дать скидку «на всякий случай»
    // здесь нельзя: это деньги.
    capture(e, { where: "resolveVerifiedOwnership" });
    return { modules: [], anchorAt: undefined, source: "none" };
  }
}

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
/**
 * Экспортируется, чтобы витрина спрашивала ТУ ЖЕ функцию, а не заводила своё
 * представление о том, доедет ли скидка до счёта. Второе представление здесь
 * означало бы ровно тот дефект, ради которого сделана вся ветка: страница
 * обещает одно, канал списывает другое.
 */
export function channelHonoursAmount(provider: "paybox" | "paypal" | "lemonsqueezy" | "gumroad" | "stub"): boolean {
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
    /**
     * Валидированные поля тела — ОДИН раз на весь обработчик.
     *
     * Тело приходит от клиента, а движок сметы и веера стоит на пути к оплате:
     * прогон враждебных входов 2026-07-26 показал, что `modules: 42` и
     * `promoCode: 42` роняли чекаут в 500 (поведение было и до веерных скидок).
     * Вторая линия обороны есть в самих `buildQuote`/`computeFan`, но чекаут не
     * должен на неё полагаться. Проверка объявлена здесь, до первого
     * использования: три копии одного правила разошлись бы при первой правке.
     */
    const requestedModules = Array.isArray(body.modules)
      ? body.modules.slice(0, 30).filter((x: unknown) => typeof x === "string")
      : [];
    const promoCode = typeof body.promoCode === "string" ? body.promoCode.slice(0, 40) : undefined;

    // 🔴 Владение для веера берём У СЕБЯ, а не из тела запроса. Тело здесь
    // управляет РЕАЛЬНЫМ списанием: прогон 2026-07-26 показал Medium+3 модуля
    // за $59.35 вместо $76 по одному лишь заявлению «я владею вот этими пятью».
    // body.ownedModules/body.lastPurchaseAt на этом пути больше не читаются —
    // они остались только у /api/pricing/quote, где ничего не списывается.
    const verified = await resolveVerifiedOwnership(req.headers.authorization, body.email);

    const quote = buildQuoteWithFan({
      tierId: tier.id,
      modules: requestedModules,
      seats,
      period,
      currency: "USD",
      promoCode,
      ownedModules: verified.modules,
      lastPurchaseAt: verified.anchorAt,
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
     * Email из тела запроса — только если он похож на email.
     *
     * Прогон враждебных входов 2026-07-26 показал, что чекаут провижинил
     * подписку на ЛЮБУЮ строку: в сторе оказались записи с email вида
     * `'; drop table users; --`, нулевыми байтами и строкой в 5000 символов.
     * Инъекции тут нет (стор — JSONL, не SQL), но провижининг на мусорный
     * адрес — это подписка, о которой владелец адреса не узнает, и мусор в
     * выручке. Проверка та же, что в /api/pricing/lead.
     */
    const email =
      typeof body.email === "string" && EMAIL_RE.test(body.email.trim())
        ? body.email.trim().toLowerCase().slice(0, 200)
        : undefined;


    /**
     * Что реально спишет канал + правда об этом в ответе. Ни одна ветка
     * каскада не имеет права отдать ссылку на полную цену, показав скидку в
     * смете: либо скидка доходит до счёта, либо ответ это признаёт.
     */
    function charge(provider: "paybox" | "paypal" | "lemonsqueezy" | "gumroad" | "stub") {
      const honoured = channelHonoursAmount(provider);
      const cents = honoured ? discountedCents : listCents;
      /**
       * Учёт расхождения «обещали / списали» пишется НЕ здесь, а в момент
       * ответа — через `paid.record()`.
       *
       * Почему: каскад пробует провайдеров по очереди, и `charge()` вызывается
       * ДО `createIntent()`, который может бросить и увести на следующего.
       * Пока запись шла отсюда, один запрос пользователя попадал в метрику
       * 2-4 раза — за каналы, которые ничего не отдали, — и «сколько скидок мы
       * потеряли» превращалось в вымысел. Найдено вычиткой дифа 2026-07-26.
       */
      let recorded = false;
      const record = () => {
        if (recorded) return;
        recorded = true;
        recordCheckoutSession({
          provider, tier: tier.id, incentiveUsd, quotedUsd: quote.total, honoured,
        });
      };
      const truth: Record<string, unknown> = {
        // Валюта списания есть в КАЖДОМ ответе, а не только там, где она не USD:
        // клиент не должен догадываться о ней по наличию/отсутствию поля.
        // PayBox-ветка дополняет её `chargedKzt` — там человек платит в тенге, и
        // сумма в долларах ему ни о чём не говорит.
        chargeCurrency: "USD",
        quotedUsd: quote.total,
        incentiveDiscountUsd: incentiveUsd,
        discountHonoured: incentiveUsd > 0 ? honoured : true,
        fan: {
          status: quote.fan.status,
          level: quote.fan.level,
          appliedUsd: quote.fan.applied,
          // Откуда сервер узнал о владении: "token" | "email" | "none".
          // Видно в логе расхождений — если скидка когда-нибудь применится при
          // source:"none", это баг, а не покупатель.
          ownershipSource: verified.source,
        },
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
      return { cents, honoured, truth, record };
    }

    // Free / fully discounted — no checkout needed, provision directly
    if (discountedCents <= 0) {
      // Заказ на ноль — это сессия, где скидка применена ПОЛНОСТЬЮ. Без этой
      // записи самые крупные скидки были невидимы в метрике: ветка отвечает до
      // каскада, а `charge()` здесь не вызывается вовсе.
      recordCheckoutSession({
        provider: "stub", tier: tier.id, incentiveUsd, quotedUsd: quote.total, honoured: true,
      });
      if (email) {
        provisionSubscription({
          email,
          tierId: tier.id,
          period,
          seats,
          modules: requestedModules,
          trialDays,
          amountUsd: 0,
          promoCode,
          source: "gumroad_zero",
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
          reference, amountCents: kztCents, currency: "KZT", description, email: email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: true,
        });
        paid.record();
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
          reference, amountCents: paid.cents, currency: "USD", description, email: email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: true,
        });
        paid.record();
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
          reference, amountCents: paid.cents, currency: "USD", description, email: email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          chargeExactAmount: paid.honoured,
        });
        paid.record();
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
        reference, amountCents: paid.cents, currency: "USD", description, email: email ?? null,
      });
      paid.record();
      return res.json({
        url: intent.checkoutUrl, mode: "real", provider: "gumroad", intentId: intent.intentId, ...paid.truth,
      });
    }

    // 3) Stub — ни один процессинг не настроен для этого tier:period.
    const paidStub = charge("stub");

    /**
     * 🔴 В ПРОДЕ stub НЕ выписывает подписку.
     *
     * Найдено 2026-07-26 сквозной проверкой денежного пути и подтверждено
     * прогоном: при незаданных процессингах эта ветка провижинила НАСТОЯЩУЮ
     * подписку без единой оплаты — включая Universe, и записывала
     * `amountUsd: 249.99`, как будто деньги пришли. Локально это ровно то, что
     * нужно (разработка без ключей), в проде — бесплатный доступ по запросу и
     * ложные $249.99 в отчёте о выручке.
     *
     * Ветка достижима на проде не гипотетически: у тарифа Universe (`pro`) нет
     * LS-варианта вовсе (см. комментарий в data/lemonSqueezyVariants.ts), то
     * есть его чекаут проваливается мимо LS по построению.
     *
     * Поведение в проде: честный отказ и ссылка на связь. Молча отдать доступ
     * или молча отдать ссылку «оплачено» — обе ветки хуже отказа.
     */
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[checkout] НЕТ ПРОЦЕССИНГА для ${tier.id}:${period} — подписка НЕ выписана. ` +
          `Настрой LS-вариант/Gumroad-permalink для этого тарифа.`,
      );
      capture(new Error(`no_payment_provider_configured:${tier.id}:${period}`), {
        where: "checkout/stub",
      });
      paidStub.record();
      return res.status(503).json({
        error: "no_payment_provider",
        message:
          "Оплата этого тарифа сейчас недоступна — ни один процессинг для него не настроен. " +
          "Мы не выписываем подписку без оплаты; напишите нам, и мы оформим вручную.",
        url: `${FRONTEND_URL}/pricing/contact?tier=${tier.id}&reason=no_provider`,
        tierId: tier.id,
        period,
        quotedUsd: quote.total,
      });
    }

    if (email) {
      provisionSubscription({
        email,
        tierId: tier.id,
        period,
        seats,
        modules: requestedModules,
        trialDays,
        // Реально списанная сумма, а не «обещанная». На каналах, которые скидку
        // не применяют, эти числа расходятся — в подписке должно лежать то, что
        // ушло со счёта, иначе вся выручка в отчётах поедет.
        amountUsd: Math.round(paidStub.cents) / 100,
        promoCode,
        source: "stub_checkout",
      }).catch((e) => console.error("[stub_provisioning] failed", e));
    }
    paidStub.record();
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

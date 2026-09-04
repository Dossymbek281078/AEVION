import { Router } from "express";
import { gumroadSellable } from "../lib/payment/gumroadProvider";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { lemonSqueezyPaymentProvider } from "../lib/payment/lemonSqueezyProvider";
import { payboxPaymentProvider, isPayboxConfigured } from "../lib/payment/payboxProvider";
import { paypalPaymentProvider, isPaypalConfigured } from "../lib/payment/paypalProvider";
import { resolveLemonSqueezyVariant, lemonSqueezySellable } from "../data/lemonSqueezyVariants";
import {
  TIERS, getTier, getModulePrice, resolvePromoCode, CURRENCY_RATES, MAX_PROMO_DISCOUNT_RATIO, buildQuote,
  type TierId, type BillingPeriod, type CurrencyCode,
} from "../data/pricing";
import { provisionSubscription, countSubscriptions, findSubscriptionByPaymentId } from "./provisioning";
import { makeServiceCapture } from "../lib/sentry/platform";
import { rateLimit } from "../lib/rateLimit";

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
  /** Срок обязательства в месяцах: 24 и 36 дают ступень веерной скидки. */
  commitmentMonths?: number;
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
/**
 * Предел темпа на создание платёжной сессии.
 *
 * ЗАЧЕМ. Ручка анонимная и на каждый вызов ходит ВО ВНЕШНЮЮ кассу
 * (payboxPaymentProvider.createIntent / paypalPaymentProvider.createIntent).
 * До 02.09.2026 предела не было ни здесь, ни на роутере, ни глобально
 * (проверено: в модуле 0 ограничителей, у checkoutRouter нет .use, в
 * index.ts до маршрутов только bodyLimitByPath). То есть темп обращений к
 * платёжному провайдеру задавал вызывающий, а не мы.
 *
 * ПОЧЕМУ 30, а не строже. Покупатель может нажать «оплатить» несколько раз
 * подряд — он видит задержку и не понимает, идёт ли что-то. Предел должен
 * ловить машинный поток, а не живого человека: 30 в минуту с одного адреса
 * это заведомо больше любого ручного темпа и заведомо меньше того, чем
 * можно выжечь квоту провайдера. Слишком строгий предел здесь опаснее
 * отсутствующего: он отсекает ПОКУПКУ, то есть стоит нам денег напрямую.
 *
 * keyFn НЕ переопределяем намеренно: умолчание уже нормализует адрес
 * (в том числе IPv6), а свой ключ — известный способ незаметно отказаться
 * от этой нормализации.
 */
const sessionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: "Слишком много попыток оплаты. Подождите минуту и попробуйте снова.",
});

/**
 * «Состоялась ли выдача по моей оплате».
 *
 * ЗАЧЕМ. Страница успеха до 03.09.2026 показывала тариф ПРЯМО ИЗ АДРЕСНОЙ
 * СТРОКИ. Это значение, во-первых, подделывается, а во-вторых ничего не знает
 * о неудаче: если выдача не состоялась, человек всё равно видел «всё готово»
 * и не обращался в поддержку.
 *
 * ТРИ ИСХОДА, и это главное:
 *   200 { ready: true, tier }  — выдано;
 *   200 { ready: false }       — ещё нет (вебхук в пути — норма первые секунды);
 *   503 { error: "lookup_failed" } — СПРОСИТЬ НЕ УДАЛОСЬ.
 *
 * Третий нельзя схлопывать во второй: сбой чтения, выданный за «ещё не
 * готово», сказал бы заплатившему «ждите» навсегда, и страница крутила бы
 * ожидание вечно.
 *
 * Ручка анонимная (покупатель ещё не вошёл), поэтому: свой предел темпа —
 * её будут опрашивать в цикле, — и в ответе НЕТ ничего личного, только
 * готовность и тариф.
 */
const statusLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: "Слишком много проверок. Подождите минуту.",
});

checkoutRouter.get("/status", statusLimiter, (req, res) => {
  const intentId = typeof req.query.intentId === "string" ? req.query.intentId.trim() : "";
  if (!intentId) return res.status(400).json({ error: "intent_required" });
  try {
    const итог = findSubscriptionByPaymentId(intentId);
    if (!итог.найдено) return res.json({ ready: false });
    return res.json({ ready: true, tier: итог.подписка.tierId, period: итог.подписка.period });
  } catch (e) {
    capture(e);
    console.error("[checkout/status] lookup failed", e);
    return res.status(503).json({
      error: "lookup_failed",
      message: "Не удалось проверить статус. Оплата не потеряна — обновите страницу через минуту.",
    });
  }
});

checkoutRouter.post("/session", sessionLimiter, async (req, res) => {
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

    // Единый расчёт. До 13.08.2026 здесь была СВОЯ арифметика — тариф, места,
    // модули и промо считались заново, отдельно от buildQuote. Из-за этого
    // веерные скидки не доезжали до кассы: витрина показывала одну сумму, а
    // списывали другую, и разойтись эти два расчёта могли молча в любой момент.
    // Валюта здесь всегда USD: KZT конвертируется ниже из этих же центов.
    const quote = buildQuote({
      tierId: tier.id,
      modules: body.modules,
      seats,
      period,
      currency: "USD",
      promoCode: body.promoCode,
      commitmentMonths: body.commitmentMonths,
    });
    const totalUsd = quote.total;

    // ЧТО СПИШУТ, ЕСЛИ КАССА НЕ ЗНАЕТ НАШЕЙ СУММЫ.
    //
    // Замер 04.09.2026 чтением кода. Из четырёх касс нашу сумму получают и
    // списывают только две: paybox (payboxProvider.ts:113) и paypal
    // (paypalProvider.ts:108). Lemon Squeezy и Gumroad её лишь возвращают
    // обратно в объекте намерения и списывают ЦЕНУ СВОЕГО ТОВАРА:
    //   • у LS в теле запроса нет поля цены вовсе (тело собирается в
    //     lemonSqueezyProvider.ts:139-165), вариант выбирается по ссылке;
    //   • у Gumroad адрес — это `l/<permalink>` без суммы
    //     (gumroadProvider.ts:84), товар тоже выбирается по ссылке (:58).
    //
    // Пока покупка обычная, расхождения нет: цена товара и есть цена тарифа.
    // Оно появляется, когда наша сумма ОТЛИЧАЕТСЯ от базовой цены тарифа —
    // добавочные места, добавочные модули, промокод, скидка за срок. И оно
    // несимметрично по цене ошибки:
    //   места/модули — страница показала больше, спишут меньше: теряем мы;
    //   промокод     — страница показала меньше, спишут больше: ПЕРЕПЛАЧИВАЕТ
    //                  ПОКУПАТЕЛЬ, которому мы сами назвали цену.
    //
    // Поведение здесь НЕ меняется: списывать правильную сумму через LS —
    // это либо custom_price на стороне магазина, либо отдельные варианты,
    // и это решение основателя, а не моё. Меняется одно: расхождение
    // перестаёт быть невидимым. Ровно та же развилка, что у пробного
    // периода ниже.
    //
    // Родственное: комментарий на строках выше про 13.08.2026 — тогда
    // свели РАСЧЁТ в один источник, потому что «витрина показывала одну
    // сумму, а списывали другую». На этих двух путях класс пережил ту
    // починку: считаем мы теперь одинаково, а до кассы сумма не доезжает.
    const базоваяЦенаCents = Math.round(
      buildQuote({ tierId: tier.id, modules: [], seats: 1, period, currency: "USD" }).total * 100
    );
    function предупредитьЕслиСуммаНеДоедет(провайдер: string): void {
      if (totalCents === базоваяЦенаCents) return;
      console.warn(
        `[checkout/session] сумма не доедет до кассы: провайдер=${провайдер} ` +
          `показано=${totalCents} спишут≈${базоваяЦенаCents} tier=${tier.id} period=${period} seats=${seats}`
      );
      capture(new Error("checkout_amount_not_sent_to_provider"), {
        route: "checkout/session",
        provider: провайдер,
        shownCents: totalCents,
        providerPriceCents: базоваяЦенаCents,
        tier: tier.id,
        period,
        seats,
        hasPromo: Boolean(body.promoCode),
        moduleCount: (body.modules ?? []).length,
      });
    }

    const trialDays = body.trial && (tier.id === "lite" || tier.id === "medium" || tier.id === "full") ? 14 : 0;
    const totalCents = Math.round(totalUsd * 100);

    // ЗАПРОШЕННЫЙ ПРОБНЫЙ ПЕРИОД НЕ ИГНОРИРУЕМ МОЛЧА.
    //
    // Замер 04.09.2026 пробой: `trial: true` и `trial: false` дают ПОЛНОСТЬЮ
    // одинаковый ответ — тот же платёжный адрес, та же сумма. Причина: число
    // дней используется только ниже, в ветке нулевой цены, а сумма считается
    // расчётом, который о пробном периоде не знает вовсе (в data/pricing.ts
    // слова trial нет). При обычной цене ветка не берётся, и 14 дней никуда
    // не попадают — все четыре кассы записывают потом trialDays: 0.
    //
    // При этом кнопка на странице цен обещает «Попробовать 14 дней бесплатно».
    //
    // Поведение НЕ меняю: как именно должен работать пробный период — решение
    // основателя (оно может жить и на стороне товара у провайдера, чего отсюда
    // не видно). Меняется одно: расхождение перестаёт быть невидимым.
    if (trialDays > 0 && totalCents > 0) {
      console.warn(
        `[checkout/session] пробный период запрошен, но НЕ применён: tier=${tier.id} ` +
          `period=${period} сумма=${totalCents}¢ — покупатель платит сразу`
      );
      capture(new Error("checkout_trial_requested_but_not_applied"), {
        route: "checkout/session",
        tier: tier.id,
        period,
      });
    }

    const reference = `tier_${tier.id}_${period}`;

    // Free / fully discounted — no checkout needed, provision directly.
    //
    // There is no payment provider on this path, so provisioning IS the
    // transaction: if it does not happen, nothing else will make it happen
    // later. It used to run fire-and-forget with the error going to
    // console.error, and the success URL was returned either way — including
    // when no email was given at all, in which case nothing was provisioned
    // and the customer still landed on the "success" page with no plan.
    if (totalCents <= 0) {
      if (!body.email) {
        return res.status(400).json({
          error: "email_required",
          message: "A free or fully-discounted plan needs an email to be issued to.",
        });
      }
      try {
        await provisionSubscription({
          email: body.email, tierId: tier.id, period, seats,
          modules: body.modules ?? [], trialDays, amountUsd: 0,
          promoCode: body.promoCode, source: "gumroad_zero",
        });
      } catch (e) {
        console.error("[provisioning] zero-price failed", e);
        return res.status(502).json({
          error: "provisioning_failed",
          message: "The plan could not be issued. Nothing was charged — please try again.",
        });
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
          // Модуль для адреса возврата: страница после оплаты обязана
          // назвать то, за что заплатили. Только при ОДНОМ купленном
          // модуле — на наборе называть один было бы враньём.
          successAppId:
            (body.modules ?? []).length === 1 ? (body.modules ?? [])[0] : undefined,
        });
        // 31.08.2026. Валюта в ответе, потому что страница обещает её ЗАРАНЕЕ: она
        // спрашивает состояние канала при загрузке и, если PayBox жив, говорит
        // «оплата в тенге». А здесь вызов PayBox может упасть, и тогда мы уходим
        // к запасным, которые считают в долларах. Обещание было дано по
        // состоянию, а исход у ЭТОГО запроса может быть другим — пусть витрина
        // узнаёт правду из ответа, а не выводит её из имени провайдера.
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "paybox", currency: "KZT", intentId: intent.intentId });
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
          // Модуль для адреса возврата: страница после оплаты обязана
          // назвать то, за что заплатили. Только при ОДНОМ купленном
          // модуле — на наборе называть один было бы враньём.
          successAppId:
            (body.modules ?? []).length === 1 ? (body.modules ?? [])[0] : undefined,
        });
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "paypal", currency: "USD", intentId: intent.intentId });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] PayPal createIntent failed, falling back to LS/Gumroad/stub", e);
      }
    }

    // 1) LemonSqueezy — основной живой процессинг подписок (аккаунт активирован).
    //    Используется, когда задан LS API + variant для этого tier:period.
    // ⚠️ 29.08.2026: сюда добавлен СЕКРЕТ ВЕБХУКА, и это не косметика.
    //
    // Раньше готовность считалась по ключу, магазину и варианту — то есть
    // отвечала на вопрос «сможем ли ВЗЯТЬ деньги» и молчала о том, сможем ли
    // их ОТРАБОТАТЬ. Без LEMON_SQUEEZY_WEBHOOK_SECRET маршрут вебхука — это
    // заглушка, отвечающая 200 OK и игнорирующая событие (см. его шапку).
    // LemonSqueezy считает доставку успешной, покупатель платит, и не
    // происходит НИЧЕГО: provisionSubscription зовут только два вебхука и
    // путь бесплатного заказа, опроса заказов у нас нет вовсе.
    //
    // Хуже всего, что запасной провайдер при этом ЕСТЬ и работает: у Gumroad
    // секрет вебхука необязателен, и выбор идёт как `lsReady ? ls : gumroad`.
    // То есть неполная проверка не просто молчала — она уводила покупателя
    // от единственного пути, который довёл бы товар.
    const lsReady =
      Boolean(process.env.LEMON_SQUEEZY_API_KEY?.trim()) &&
      Boolean(process.env.LEMON_SQUEEZY_STORE_ID?.trim()) &&
      Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim()) &&
      Boolean(resolveLemonSqueezyVariant(reference));
    if (lsReady) {
      try {
        // Lite = 1 продукт на выбор: пробрасываем выбранный модуль в custom_data,
        // чтобы вебхук провижинил подписку именно на него.
        const liteModule = tier.id === "lite" ? (body.modules ?? [])[0] : undefined;
        предупредитьЕслиСуммаНеДоедет("lemonsqueezy");
        const intent = await lemonSqueezyPaymentProvider.createIntent({
          reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
          customData: liteModule ? { module: liteModule } : undefined,
          // Модуль для адреса возврата: страница после оплаты обязана
          // назвать то, за что заплатили. Только при ОДНОМ купленном
          // модуле — на наборе называть один было бы враньём.
          successAppId:
            (body.modules ?? []).length === 1 ? (body.modules ?? [])[0] : undefined,
        });
        return res.json({ url: intent.checkoutUrl, mode: "real", provider: "lemonsqueezy", currency: "USD", intentId: intent.intentId });
      } catch (e) {
        capture(e);
        console.error("[checkout/session] LS createIntent failed, falling back to Gumroad/stub", e);
      }
    }

    // 2) Gumroad — fallback (one-time продукты / пока LS не настроен).
    if (gumroadPermalinkConfigured(reference)) {
      предупредитьЕслиСуммаНеДоедет("gumroad");
      const intent = await gumroadPaymentProvider.createIntent({
        reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
      });
      return res.json({ url: intent.checkoutUrl, mode: "real", provider: "gumroad", currency: "USD", intentId: intent.intentId });
    }

    // 3) Процессинга для этого tier:period нет.
    //
    // Раньше здесь стояла заглушка, которая ПРОВИЖИНИЛА подписку (source:
    // "stub_checkout") и уводила покупателя на /pricing/checkout/success?stub=true.
    // На проде 26.07.2026 в эту ветку попадал тариф Universe — самый дорогой
    // продукт платформы, $249.99/мес и $2499.90/год по ценам того дня → $149/мес и $1490/год сейчас: у него не заведён вариант
    // LemonSqueezy, поэтому любой POST с email выдавал платную подписку бесплатно
    // и показывал страницу «оплачено». Эндпоинт публичный, авторизации нет.
    // Счётчик подписок вырос с 28 до 31 от трёх диагностических запросов — то есть
    // часть накопленных записей, скорее всего, именно такого происхождения.
    //
    // Сюда доходят только ПЛАТНЫЕ суммы: бесплатные и полностью погашенные промо
    // обрабатываются веткой totalCents <= 0 выше и провижинятся законно. Значит,
    // отказ здесь ничего работающего не ломает — он лишь перестаёт раздавать
    // доступ даром и врать покупателю про успешную оплату.
    console.error(
      `[checkout/session] нет процессинга для ${reference} — отказ вместо заглушки ` +
        `(tier=${tier.id}, period=${period}, total=${totalCents}¢)`,
    );
    return res.status(503).json({
      error: "checkout_unavailable",
      tier: tier.id,
      period,
      message:
        "Оплата этого тарифа сейчас недоступна: платёжный вариант не настроен. " +
        "Подписка не оформлена и деньги не списаны — напишите нам, и мы оформим доступ вручную.",
      contactUrl: `${FRONTEND_URL}/pricing/contact?tier=${tier.id}`,
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
  // Смена типа сюда НЕ дошла бы типами: тело ответа не типизировано, и
  // объект вместо числа уехал бы молча (feedback_return_type_change_tsc_...).
  const подписки = countSubscriptions();
  res.json({
    total: подписки.ok ? подписки.total : null,
    // Ноль и «не знаю» — разные ответы: ноль читается как «никто не купил».
    unread: подписки.ok ? undefined : true,
  });
});

// ── GET /healthz ──────────────────────────────────────────────────────────────
checkoutRouter.get("/healthz", (_req, res) => {
  const лс = lemonSqueezySellable();
  // Тот же смысл, что и у маршрутизации выше: готовность включает СЕКРЕТ
  // ВЕБХУКА, иначе отчёт называл бы основным того, кто возьмёт деньги и не
  // выдаст купленное. Вариант тарифа здесь не проверяется намеренно — он
  // свой у каждого тарифа и сообщается отдельным полем `sellable`.
  // Два РАЗНЫХ вопроса, и путать их нельзя:
  //   lsReady      — можно ли ВЗЯТЬ деньги (ключ + магазин);
  //   lsCanDeliver — дойдёт ли покупка до выдачи (нужен секрет вебхука).
  // Поле `configured` отвечает на первый — таким его читают снаружи, и
  // отдельное `webhookConfigured` существует ровно чтобы разница была видна.
  // А вот ВЫБОР провайдера обязан идти по второму: иначе кассу назначаем
  // тому, кто возьмёт деньги и не выдаст купленное, тогда как у Gumroad
  // секрет вебхука необязателен и выдача работает.
  const lsReady =
    Boolean(process.env.LEMON_SQUEEZY_API_KEY?.trim()) &&
    Boolean(process.env.LEMON_SQUEEZY_STORE_ID?.trim());
  const lsCanDeliver =
    lsReady && Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim());
  res.json({
    ok: true,
    primaryProvider: lsCanDeliver ? "lemonsqueezy" : "gumroad",
    providers: {
      // `webhookConfigured` — отдельно от `configured`, и это не мелочь.
      //
      // `configured` отвечает «можно ли ВЗЯТЬ деньги» (есть ключ и магазин).
      // Секрет вебхука отвечает «дойдёт ли покупка до выдачи»: без него
      // обработчик отвечает провайдеру ok и молча игнорирует событие —
      // провайдер считает доставку успешной и НЕ повторяет. То есть
      // деньги списаны, а купленное не выдано, и снаружи всё зелено.
      //
      // Раньше healthz про секрет вебхука не спрашивал вовсе, и мог
      // рапортовать «lemonsqueezy настроен» при мёртвой выдаче.
      lemonsqueezy: {
        configured: lsReady,
        webhook: "/api/lemonsqueezy/webhook",
        // ЧТО РЕАЛЬНО МОЖНО КУПИТЬ. `configured` отвечает «есть ключ и
        // магазин», но начать покупку нельзя без ВАРИАНТА товара — а он
        // задаётся отдельной переменной на каждый тариф и модуль.
        // Два разных вопроса под одним словом; второй снаружи виден не был.
        sellable: lemonSqueezySellable(),
        webhookConfigured: Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim()),
      },
      gumroad: {
        configured: Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim()),
        // Какие тарифы Gumroad реально может продать. Токен отвечает «провайдер
        // настроен», а продажа тарифа требует ссылки на товар — разные вопросы.
        // Список тарифов берём тот же, что у LemonSqueezy: вселенная тарифов
        // одна, и два её написания разъехались бы молча.
        sellable: gumroadSellable([...лс.configured, ...лс.missing]),
        webhook: "/api/gumroad/webhook",
        webhookConfigured: Boolean(process.env.GUMROAD_WEBHOOK_SECRET?.trim()),
      },
      paybox: { configured: isPayboxConfigured(), trigger: "currency=KZT", webhook: "/api/paybox/webhook" },
      paypal: { configured: isPaypalConfigured(), trigger: "method=paypal", webhook: "/api/paypal/webhook" },
    },
    frontendUrl: FRONTEND_URL,
  });
});

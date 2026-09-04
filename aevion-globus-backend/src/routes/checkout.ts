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

/**
 * Дополнительные поля, которые касса вернёт в вебхуке.
 *
 * Одна функция на всех провайдеров: раньше объект собирался в трёх местах
 * одинаково, и добавить туда канал значило бы поправить три копии — а
 * разъехались бы они молча.
 */
function собратьCustomData(
  liteModule: string | undefined,
  channel: string,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  if (liteModule) out.module = liteModule;
  if (channel) out.channel = channel;
  return Object.keys(out).length ? out : undefined;
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
  /**
   * Канал привлечения ("tt", "ig", …) — тот же, что витрина кладёт в ссылку
   * LemonSqueezy как checkout[custom][channel].
   *
   * Без него покупки через PayBox, PayPal и серверные ссылки Gumroad попадают
   * в сводке выручки в ключ "direct": деньги не теряются, но ответа «что
   * окупилось» по ним нет. Едет общим путём — через customData, который PayBox
   * превращает в pg_param_channel, а Gumroad кладёт в url_params[channel];
   * оба поля наши вебхуки уже читают.
   */
  channel?: string;
  /** Валюта оплаты. "KZT" → локальный канал PayBox (если настроен), иначе USD/LS. */
  currency?: CurrencyCode;
  /** Способ оплаты. "paypal" → канал PayPal (если настроен), иначе дефолтный каскад. */
  method?: "card" | "paypal";
}

// ── POST /session ─────────────────────────────────────────────────────────────
checkoutRouter.post("/session", async (req, res) => {
  try {
    const body = (req.body ?? {}) as CheckoutBody;
    // Канал режем по длине: значение приходит из адресной строки, а оттуда
    // приезжает что угодно. Пустую строку не передаём вовсе — пустой канал
    // хуже отсутствующего: в сводке он стал бы отдельным безымянным ключом.
    const channel = typeof body.channel === "string" ? body.channel.trim().slice(0, 40) : "";

    if (!body.tierId || !["free", "lite", "medium", "full", "pro", "enterprise"].includes(body.tierId)) {
      // Единственный ответ чекаута без человеческого текста (замер 03.09.2026:
      // 5 с текстом против 1 без). Соседние ответы этого же файла его несут —
      // непоследовательность внутри одной функции почти всегда недосмотр,
      // а не решение.
      return res.status(400).json({
        error: "invalid_tier",
        message: "Такого тарифа нет. Вернитесь на страницу цен и выберите план заново.",
      });
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

    const trialDays = body.trial && (tier.id === "lite" || tier.id === "medium" || tier.id === "full") ? 14 : 0;
    const totalCents = Math.round(totalUsd * 100);

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
          customData: собратьCustomData(liteModule, channel),
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
          customData: собратьCustomData(liteModule, channel),
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
        const intent = await lemonSqueezyPaymentProvider.createIntent({
          reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
          customData: собратьCustomData(liteModule, channel),
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
      const intent = await gumroadPaymentProvider.createIntent({
        reference, amountCents: totalCents, currency: "USD", description, email: body.email ?? null,
        // Выбранного модуля в этой ветке нет — она для одноразовых продуктов,
        // а модуль выбирают только у тарифа Lite. Канал передаём: без него
        // покупка попадёт в сводке выручки в ключ "direct".
        customData: собратьCustomData(undefined, channel),
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
        // ⚠️ У Gumroad `false` здесь НЕ означает «не выдаст». Замер 03.09.2026:
        // на проде секрет вебхука не задан, и это осознанно — при его
        // отсутствии обработчик не принимает вслепую, а проверяет продажу
        // через API самого Gumroad по токену доступа. Отклоняет только при
        // определённом «нет такой продажи»; не смог проверить — ведёт себя
        // как раньше, чтобы настоящий покупатель не терял доступ из-за
        // чужого сбоя.
        //
        // Поле без этой пары читалось бы как тревога, а тревога на исправном
        // месте приучает не смотреть. Поэтому рядом стоит, чем оно заменено.
        salesVerifiedViaApi:
          Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim()) &&
          process.env.GUMROAD_VERIFY_SALES !== "0",
      },
      // ⚠️ У ЭТИХ ДВУХ КАСС БЫЛО ТОЛЬКО `configured`, и это асимметрия,
      // а не мелочь. У LemonSqueezy и Gumroad рядом стоит
      // `webhookConfigured` — признак того, что купленное ВЫДАДУТ: без
      // секрета вебхука оплата принимается, а права не начисляются.
      //
      // PayBox — касса казахстанского трафика, то есть ровно та, где
      // такая тишина дороже всего. Спрашивать про неё было нечем:
      // снаружи «настроено» и «выдаст» выглядели одинаково.
      paybox: {
        configured: isPayboxConfigured(),
        webhookConfigured: Boolean(process.env.PAYBOX_SECRET?.trim()),
        // 🔴 ЛОВУШКА ЗАПУСКА, сделанная видимой 04.09.2026.
        //
        // Тестовый режим у PayBox стоит ПО УМОЛЧАНИЮ: провайдер шлёт
        // `pg_testing_mode: "1"`, пока не задано `PAYBOX_TESTING=0`. Умолчание
        // безопасное и правильное — случайно взять настоящие деньги хуже, чем
        // случайно не взять.
        //
        // Но при включении кассы это ловушка: задать два секрета выглядит
        // достаточным, `configured` станет true, покупки пойдут — и ни одна
        // не будет настоящей. Снаружи «касса работает» и «касса играет в
        // песочнице» выглядели одинаково.
        //
        // Замер 04.09.2026: PAYBOX_TESTING на проде не задана.
        testMode: process.env.PAYBOX_TESTING !== "0",
        trigger: "currency=KZT",
        webhook: "/api/paybox/webhook",
      },
      paypal: {
        configured: isPaypalConfigured(),
        webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
        trigger: "method=paypal",
        webhook: "/api/paypal/webhook",
      },
    },
    frontendUrl: FRONTEND_URL,
  });
});

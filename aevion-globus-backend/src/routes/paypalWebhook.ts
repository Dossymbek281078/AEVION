/**
 * PayPal webhook — глобальный карт/PayPal-канал.
 *
 *   POST /api/paypal/webhook
 *
 * PayPal шлёт JSON-события. Подпись проверяется через verify-webhook-signature
 * API (нужен PAYPAL_WEBHOOK_ID + заголовки доставки). Провижиним на
 * PAYMENT.CAPTURE.COMPLETED.
 *
 * Email — из resource.payer.email_address; tier/period/module — из custom_id
 * (JSON { reference, module? }, который createIntent кладёт в purchase_unit).
 */

import { Router, type Request, type Response } from "express";
import { paypalPaymentProvider, verifyPaypalWebhook } from "../lib/payment/paypalProvider";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";
import type { TierId, BillingPeriod } from "../data/pricing";
import { makeServiceCapture } from "../lib/sentry/platform";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";
import { upsertAppSubscription } from "../lib/appEntitlements";
import { ссылкаПодписки } from "../lib/payment/subscriptionReference";

const capture = makeServiceCapture("paypalWebhook");

export const paypalWebhookRouter = Router();


/** Экспортируется ради теста: копия та же, что у PayBox, и ошибаться они
 *  обязаны одинаково — иначе сторож охраняет одну кассу из двух. */
export function tierForReference(ref: string): TierId {
  const r = ref.toLowerCase();
  // Касса строит ссылку как `tier_<id>_<период>` (checkout.ts), а наш каталог
  // продаёт ещё два тарифа, которых не было в списке ниже: `pro` («Universe»,
  // $149/мес) и `enterprise`. Оба принимаются ручкой чекаута явно — и оба
  // проваливались в дефолт `lite`, то есть человек платил за старший тариф и
  // получал самый дешёвый. Проверено прогоном: tier_pro_monthly -> "lite" при
  // контроле tier_medium_monthly -> "medium".
  //
  // Сверяем ТОЧНЫМ префиксом, а не подстрокой: `includes("pro")` поймал бы и
  // `tier_promo_*`. Ниже по течению оба значения понятны — normalizeTier
  // переводит "pro" в "full", "enterprise" оставляет как есть.
  if (r.startsWith("tier_pro_")) return "pro";
  if (r.startsWith("tier_enterprise_")) return "enterprise";
  if (r.includes("medium")) return "medium";
  if (r.includes("full") || r.includes("all-access") || r.includes("business") || r.includes("team")) return "full";
  return "lite";
}

function periodForReference(ref: string): BillingPeriod {
  return ref.toLowerCase().includes("annual") ? "annual" : "monthly";
}

/**
 * `custom_id` = JSON { reference, module?, channel? } (createIntent).
 *
 * ⚠️ ПОПРАВКА 02.09.2026, находка соседнего окна. Канал ДОЕЗЖАЛ сюда —
 * провайдер кладёт `{ reference, ...customData }`, а customData несёт
 * `channel`, — и выбрасывался здесь: разбор возвращал ровно две ключа.
 *
 * Следствие: каждая покупка через PayPal ложилась в записи как «direct», и
 * панель «фактически списано по каналам» занижала именно тот канал, который
 * приводит валютных покупателей. Ошибка тихая: цифра есть, она правдоподобна
 * и она неверна.
 */
function parseCustomId(customId?: string): { reference: string; module?: string; channel?: string } {
  if (!customId) return { reference: "" };
  try {
    const j = JSON.parse(customId) as { reference?: string; module?: string; channel?: string };
    return { reference: j.reference ?? "", module: j.module, channel: j.channel };
  } catch {
    return { reference: customId };
  }
}

paypalWebhookRouter.get("/webhook", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoint: "paypal webhook",
    accepts: "POST application/json",
    verified: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    info: "PayPal присылает события сюда. Подпись проверяется через verify-webhook-signature API.",
  });
});

paypalWebhookRouter.post("/webhook", async (req: Request, res: Response) => {
  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
  }

  // Криптопроверка подписи через PayPal API. Без подтверждения — 401.
  const verified = await verifyPaypalWebhook(headers, rawBody);
  if (!verified) {
    console.warn("[paypal/webhook] signature not verified — rejecting 401");
    return res.status(401).json({ ok: false, error: "unverified" });
  }

  let parsed: ReturnType<typeof paypalPaymentProvider.parseWebhook>;
  try {
    parsed = paypalPaymentProvider.parseWebhook(headers, rawBody);
  } catch (err) {
    capture(err);
    console.error("[paypal/webhook] parse error:", err);
    return res.status(400).json({ ok: false, error: "parse_failed" });
  }

  const { result, eventId } = parsed;
  const raw = (result.raw as Record<string, unknown> | null) ?? {};
  const payer = (raw.payer as { email_address?: string } | undefined);
  const email = (payer?.email_address ?? "").trim().toLowerCase();
  const { reference, module, channel } = parseCustomId(raw.custom_id as string | undefined);

  // Сумма заказа: PayPal кладёт её в purchase_units[0].amount.
  const paypalUnits = raw.purchase_units as
    | Array<{ amount?: { value?: string; currency_code?: string } }>
    | undefined;
  const paypalAmount = paypalUnits?.[0]?.amount;
  const paypalAmountValue = Number(paypalAmount?.value);
  const paypalAmountUsd =
    String(paypalAmount?.currency_code ?? "").toUpperCase() === "USD" &&
    Number.isFinite(paypalAmountValue) &&
    paypalAmountValue > 0
      ? paypalAmountValue
      : undefined;
  const paymentId = (raw.id as string | undefined) ?? eventId ?? reference;
  const refunded = result.status === "refunded";
  const failed = result.status === "failed";

  if (!email) {
    console.warn("[paypal/webhook] missing email, ignoring");
    return res.json({ ok: true, ignored: "no_email" });
  }

  const dedupKey = `${paymentId}:${result.status}`;
  if (hasSeenWebhook("paypal", dedupKey)) return res.json({ ok: true, deduped: true });
  markWebhookSeen("paypal", dedupKey);

  try {
    if (refunded || failed) {
      const downgrade: Subscription = {
        id: `sub_paypal_${paymentId}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `paypal:${result.status}`,
      };
      writeSubscription(downgrade);

      // Возврат обязан снимать И помодульную запись. Тариф понижается в
      // файле, а строка в AppSubscription живёт отдельно — и запасной путь
      // стены (planGate -> hasActiveAppSubscription) пускал бы по ней
      // человека, которому деньги вернули. Создаём запись при покупке —
      // обязаны снимать здесь, иначе пара разомкнута.
      //
      // ⚠ Направление отказа тут ОБРАТНОЕ покупке. При покупке сбой базы
      // безвреден: доступ уже выдан файлом, ронять нечего. При возврате
      // сбой означает, что человек ПРОДОЛЖАЕТ пользоваться оплаченным и
      // возвращённым. Поэтому не глотаем: внешний catch освобождает ключ
      // дедупликации, и касса повторит доставку. Понижение в файле
      // идемпотентно, повтор его не испортит.
      if (module) {
        try {
          await upsertAppSubscription(email, module, "cancelled", downgrade.id);
        } catch (e) {
          const причина = e instanceof Error ? e.message : String(e);
          console.error(`[paypal/webhook] возврат НЕ снял доступ к модулю -> ${email}/${module}: ${причина}`);
          capture(e, { route: "paypal/webhook/refund", email, module });
          throw e;
        }
      }
      console.log(`[paypal/webhook] ${result.status} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded", email });
    }

    if (result.status === "paid") {
      // Вебхук PayPal приходит на ВЕСЬ аккаунт, а не только на заказы нашего
      // чекаута. Прямой перевод, счёт, старая подписка — событие придёт, почта в
      // нём будет, а ссылки нашего формата не будет: `parseCustomId` вернёт пустую
      // строку, разбор тарифа уйдёт в умолчание, и человек, не покупавший у нас
      // ничего, получит подписку. Тот же класс, что закрыт у PayBox 04.09.
      if (!ссылкаПодписки(reference)) {
        console.warn(
          `[paypal/webhook] заказ "${reference}" не похож на подписку — тариф не выдаём`,
        );
        return res.json({ ok: true, ignored: "not_a_subscription_reference", reference });
      }

      const tierId = tierForReference(reference);
      const period = periodForReference(reference);
      const provResult = await provisionSubscription({
        email,
        tierId,
        period,
        modules: module ? [module] : [],
        source: "paypal",
        // Сумма ПРИХОДИТ в событии и до сегодня выбрасывалась: провайдер
        // отдаёт весь заказ PayPal, а вебхук читал из него только статус.
        // Из четырёх касс PayPal был единственным без суммы — значит его
        // покупки попадали в панель «фактически списано» БЕЗ денег, и
        // знаменатель withAmount занижал именно валютный канал.
        //
        // Валюту проверяем так же, как у PayBox: поле называется amountUsd, и
        // записать в него сумму в другой валюте значило бы соврать молча.
        ...(paypalAmountUsd !== undefined ? { amountUsd: paypalAmountUsd } : {}),
        // Канал приходит из custom_id — тем же путём, что у остальных касс.
        // Обрезка до 40 символов как у PayBox: одна длина на все кассы,
        // иначе один и тот же канал даст РАЗНЫЕ строки в сводке, и разбивка
        // «по каналам» распадётся на близнецов.
        ...(channel ? { channel: String(channel).trim().slice(0, 40) } : {}),
      });

      // Помодульную покупку записываем ЕЩЁ и в базу — см. тот же разбор в
      // payboxWebhook.ts: тариф живёт в файле, помодульная покупка в
      // Postgres, и её читает запасной путь стены. Через Lemon Squeezy обе
      // записи были, через PayPal — только файл.
      //
      // Не роняем: доступ уже выдан файлом. Но отказ обязан оставить след.
      if (module) {
        try {
          await upsertAppSubscription(email, module, "active", provResult.subscription.id);
        } catch (e) {
          const причина = e instanceof Error ? e.message : String(e);
          console.warn(`[paypal/webhook] долговечная запись не сохранена -> ${email}/${module}: ${причина}`);
          capture(e, { route: "paypal/webhook", email, module });
        }
      }
      console.log(`[paypal/webhook] paid → provisioned ${tierId}/${period} for ${email} (ref=${reference})`);
      return res.json({ ok: true, action: "activated", tierId, email, subscriptionId: provResult.subscription.id });
    }

    return res.json({ ok: true, ignored: result.status });
  } catch (err) {
    releaseWebhookKey("paypal", dedupKey);
    capture(err);
    console.error("[paypal/webhook] handler error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "handler_failed" });
  }
});

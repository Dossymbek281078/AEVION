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
import {
  provisionSubscription,
  writeSubscription,
  readLatestSubscription,
  возвратКасаетсяДействующей,
  type Subscription,
} from "./provisioning";
import type { TierId } from "../data/pricing";
import { тарифПоСсылкеЗаказа } from "../lib/payment/tierFromOrderReference";
import { купленныйМодуль, названныйМодуль } from "../lib/payment/purchasedModule";
import { termMonthsForReference, tierIdForReference } from "../lib/payment/billingPeriod";
import { местИзКассы, модулиИзКассы } from "../lib/payment/customData";
import { makeServiceCapture } from "../lib/sentry/platform";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";
import { upsertAppSubscription } from "../lib/appEntitlements";
import { ссылкаПодписки } from "../lib/payment/subscriptionReference";

const capture = makeServiceCapture("paypalWebhook");


export const paypalWebhookRouter = Router();


/** Экспортируется ради теста: копия та же, что у PayBox, и ошибаться они
 *  обязаны одинаково — иначе сторож охраняет одну кассу из двух. */
export function tierForReference(ref: string): TierId {
  // Правило живёт в lib/payment/tierFromOrderReference: у PayBox и PayPal оно
  // было ДВУМЯ копиями, и вторая отставала на починку (шумная запись о
  // незнакомой ссылке появилась у paypal отдельно, уже после paybox).
  return тарифПоСсылкеЗаказа(ref, "paypal", (e, ctx) => capture(e, ctx));
}


/**
 * `custom_id` = JSON { reference, module?, channel?, seats?, modules? }.
 *
 * Мерж 06.09.2026 двух починок одного разбора:
 * — канал (находка 02.09): он ДОЕЗЖАЛ сюда и выбрасывался, из-за чего каждая
 *   покупка PayPal ложилась как «direct», занижая валютный канал;
 * — места и модули (ветка платежей): без них оплаченные места и список
 *   модулей не доезжали до записи подписки.
 * Значения приходят СНАРУЖИ (через кассу), поэтому seats/modules проверяются
 * общими разборщиками — теми же, что у paybox.
 */
function parseCustomId(customId?: string): {
  reference: string;
  module?: string;
  channel?: string;
  seats: number;
  modules: string[];
} {
  if (!customId) return { reference: "", seats: 1, modules: [] };
  try {
    const j = JSON.parse(customId) as {
      reference?: string; module?: string; channel?: string; seats?: unknown; modules?: unknown;
    };
    return {
      reference: j.reference ?? "",
      module: j.module,
      channel: typeof j.channel === "string" ? j.channel : undefined,
      seats: местИзКассы(j.seats),
      modules: модулиИзКассы(j.modules, typeof j.module === "string" ? j.module : undefined),
    };
  } catch {
    return { reference: customId, seats: 1, modules: [] };
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
  const { reference, module, channel, seats, modules } = parseCustomId(raw.custom_id as string | undefined);

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
      const действующая = readLatestSubscription(email);
      const отзываем = возвратКасаетсяДействующей(действующая, paymentId);
      if (!отзываем) {
        console.warn(
          `[paypal/webhook] возврат за ДРУГУЮ покупку: действующая подписка ` +
            `${действующая?.tierId} не тронута, возврат по ${paymentId}`
        );
        capture(new Error("refund_for_older_purchase_kept_current_subscription"), {
          route: "paypal/webhook/refund",
          email,
          refundedPaymentId: paymentId,
          currentTier: действующая?.tierId,
        });
      }
      const downgrade: Subscription = {
        id: `sub_paypal_${paymentId}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        termMonths: null,
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `paypal:${result.status}`,
      };
      if (отзываем) writeSubscription(downgrade);

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
      // Тот же признак, что на выдаче: `if (module)` пропускал случай, когда
      // модуль назван самой ссылкой заказа (`app_qskyway_lite`), и право
      // осталось бы активным после возврата денег.
      const модульВозврата = названныйМодуль(reference, module);
      if (модульВозврата) {
        try {
          await upsertAppSubscription(email, модульВозврата, "cancelled", downgrade.id);
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
      // ⚠️ ПОРЯДОК ВАЖЕН: развилка стоит ДО проверки «похожа ли ссылка на
      // подписку», как и у PayBox. Ссылка приложения подписочной не считается,
      // поэтому оплаченная покупка модуля возвращала `ignored` — деньги без
      // доступа. Тариф ей выдавать нельзя, выдать надо ровно купленное.
      // 🔴 КУПЛЕН ОДИН МОДУЛЬ — ЗНАЧИТ И ПРАВО НА ОДИН МОДУЛЬ, НЕ ТАРИФ.
      //
      // Тариф с 15.09.2026 — это срок доступа ко ВСЕЙ планете ($400/мес):
      // normalizeTier превращает lite в full, и isModuleEntitled при full пускает
      // куда угодно. Покупка QSkyway за $16, записанная тарифом, отдала бы
      // планету за цену модуля. На Lemon Squeezy закрыто 29.09 (dc5d45658), здесь
      // утечка спала только потому, что касса выключена.
      //
      // Признак общий для всех касс — lib/payment/purchasedModule.
      const модульПокупки = купленныйМодуль(reference, module);
      if (модульПокупки) {
        await upsertAppSubscription(email, модульПокупки, "active", paymentId);
        console.log(`[paypal/webhook] paid → один модуль: ${модульПокупки} for ${email} (ref=${reference})`);
        return res.json({ ok: true, action: "app_activated", appSlug: модульПокупки, email });
      }

      if (!ссылкаПодписки(reference)) {
        console.warn(
          `[paypal/webhook] заказ "${reference}" не похож на подписку — тариф не выдаём`,
        );
        return res.json({ ok: true, ignored: "not_a_subscription_reference", reference });
      }

      const tierId = tierForReference(reference);
      const termMonths = termMonthsForReference(reference);
      const provResult = await provisionSubscription({
        email,
        tierId,
        termMonths,
        seats,
        modules,
        source: "paypal",
        // Сумма ПРИХОДИТ в событии и до сегодня выбрасывалась: PayPal был
        // единственной кассой без суммы — его покупки попадали в панель
        // «фактически списано» БЕЗ денег. Валюту проверяем как у PayBox.
        ...(paypalAmountUsd !== undefined ? { amountUsd: paypalAmountUsd } : {}),
        // Канал из custom_id, обрезка до 40 символов — одна длина на все
        // кассы, иначе один канал даст разные строки в сводке.
        ...(channel ? { channel: String(channel).trim().slice(0, 40) } : {}),
        // Идентификатор платежа (ветка платежей): по нему страница успеха
        // спрашивает, состоялась ли выдача.
        providerPaymentId: paymentId,
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
      console.log(`[paypal/webhook] paid → provisioned ${tierId}/${termMonths}m for ${email} (ref=${reference})`);
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

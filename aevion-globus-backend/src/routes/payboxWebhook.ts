/**
 * PayBox / Freedom Pay webhook (result_url) — KZT канал.
 *
 *   POST /api/paybox/webhook
 *
 * PayBox шлёт application/x-www-form-urlencoded POST на result_url после
 * попытки оплаты. Подпись (pg_sig) проверяется провайдером по имени скрипта
 * (PAYBOX_RESULT_SCRIPT_NAME, по умолчанию "webhook").
 *
 * Провижининг:
 *   - email берём из pg_user_contact_email (PayBox возвращает контакт плательщика)
 *   - tier/period — из pg_order_id (формат "tier_<tier>_<period>_<ts>")
 *   - выбранный модуль (для Lite) — из pg_param_module
 *
 * Без email подтверждённую оплату провижинить некому → отвечаем 200 с ignored,
 * как и Gumroad-канал (PayBox считает доставку успешной и не ретраит).
 */

import { Router, type Request, type Response } from "express";
import { payboxPaymentProvider } from "../lib/payment/payboxProvider";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";
import type { TierId, BillingPeriod } from "../data/pricing";
import { makeServiceCapture } from "../lib/sentry/platform";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";

const capture = makeServiceCapture("payboxWebhook");

export const payboxWebhookRouter = Router();


/** "tier_lite_monthly_1699999999" → "tier_lite_monthly" (отрезаем хвост-таймстамп). */
function referenceFromOrderId(orderId: string): string {
  return orderId.replace(/_\d+$/, "");
}

function tierForReference(ref: string): TierId {
  const r = ref.toLowerCase();
  if (r.includes("medium")) return "medium";
  if (r.includes("full") || r.includes("all-access") || r.includes("business") || r.includes("team")) return "full";
  return "lite";
}

function periodForReference(ref: string): BillingPeriod {
  return ref.toLowerCase().includes("annual") ? "annual" : "monthly";
}

// Liveness probe — PayBox шлёт только POST; GET для ручной проверки URL в ЛК.
payboxWebhookRouter.get("/webhook", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoint: "paybox webhook",
    accepts: "POST application/x-www-form-urlencoded",
    info: "PayBox/Freedom Pay присылает сюда result_url-колбэк (pg_result=1 успех). GET — только liveness.",
  });
});

payboxWebhookRouter.post("/webhook", async (req: Request, res: Response) => {
  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : "";

  let parsed: ReturnType<typeof payboxPaymentProvider.parseWebhook>;
  try {
    parsed = payboxPaymentProvider.parseWebhook({}, rawBody);
  } catch (err) {
    capture(err);
    console.error("[paybox/webhook] parse error:", err);
    return res.status(400).json({ ok: false, error: "parse_failed" });
  }

  const { result, eventId } = parsed;

  if (result.reason === "invalid_signature") {
    console.warn("[paybox/webhook] invalid signature — rejecting 401");
    return res.status(401).json({ ok: false, error: "invalid_signature" });
  }

  const raw = (result.raw as Record<string, string> | null) ?? {};
  const email = (raw.pg_user_contact_email ?? "").trim().toLowerCase();
  const orderId = raw.pg_order_id ?? "";
  const paymentId = raw.pg_payment_id ?? eventId ?? orderId;
  const refunded = result.status === "refunded";
  const failed = result.status === "failed";

  if (!email) {
    console.warn("[paybox/webhook] missing email, ignoring");
    return res.json({ ok: true, ignored: "no_email" });
  }

  const dedupKey = `${paymentId}:${result.status}`;
  if (hasSeenWebhook("paybox", dedupKey)) return res.json({ ok: true, deduped: true });
  markWebhookSeen("paybox", dedupKey);

  const reference = referenceFromOrderId(orderId);
  const module = raw.pg_param_module || undefined;

  try {
    if (refunded || failed) {
      const downgrade: Subscription = {
        id: `sub_paybox_${paymentId}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `paybox:${result.status}`,
      };
      writeSubscription(downgrade);
      console.log(`[paybox/webhook] ${result.status} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded", email });
    }

    if (result.status === "paid") {
      const tierId = tierForReference(reference);
      const period = periodForReference(reference);
      // СУММА — только если касса рассчиталась в долларах.
      //
      // 🔴 Ловушка единиц, из-за которой поле должно оставаться пустым в
      // остальных случаях: pg_amount приходит в ОСНОВНОЙ единице валюты
      // платежа, а у PayBox это тенге. Поле в записи подписки называется
      // amountUsd. Записать одно в другое значило бы завысить выручку в сотни
      // раз, и заметили бы это только по абсурдной цифре в панели.
      //
      // Пересчёт по курсу здесь делать нельзя: курса на день платежа мы не
      // храним, а «сегодняшний» сделал бы прошлые суммы плавающими. Пустое
      // поле честнее приблизительного — рядом в сводке всегда идёт
      // знаменатель withAmount, и он покажет пробел как пробел.
      const payboxCurrency = (raw.pg_currency ?? "").trim().toUpperCase();
      const payboxAmount = Number(raw.pg_amount);
      const amountUsd =
        payboxCurrency === "USD" && Number.isFinite(payboxAmount) && payboxAmount > 0
          ? payboxAmount
          : undefined;

      // ⚠️ КАНАЛ привлечения сюда не доходит вовсе, и это измерено, а не
      // предположено: в payboxProvider ссылка на кассу собирается без
      // pg_param_channel (0 вхождений). Читать его здесь значило бы завести
      // мёртвый код, поэтому не читаем. Пока так, покупки через PayBox
      // попадают в сводке в ключ "direct" — это не потеря денег, но канал
      // у них неизвестен. Чинится в ССЫЛКЕ кассы, а не тут.
      const provResult = await provisionSubscription({
        email,
        tierId,
        period,
        modules: module ? [module] : [],
        source: "paybox",
        ...(amountUsd === undefined ? {} : { amountUsd }),
      });
      console.log(`[paybox/webhook] paid → provisioned ${tierId}/${period} for ${email} (ref=${reference})`);
      return res.json({ ok: true, action: "activated", tierId, email, subscriptionId: provResult.subscription.id });
    }

    return res.json({ ok: true, ignored: result.status });
  } catch (err) {
    releaseWebhookKey("paybox", dedupKey);
    capture(err);
    console.error("[paybox/webhook] handler error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "handler_failed" });
  }
});

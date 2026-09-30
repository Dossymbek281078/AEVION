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
import { ссылкаПодписки } from "../lib/payment/subscriptionReference";
import { payboxPaymentProvider } from "../lib/payment/payboxProvider";
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

const capture = makeServiceCapture("payboxWebhook");


export const payboxWebhookRouter = Router();


/** "tier_lite_monthly_1699999999" → "tier_lite_monthly" (отрезаем хвост-таймстамп). */
function referenceFromOrderId(orderId: string): string {
  return orderId.replace(/_\d+$/, "");
}

/**
 * Тариф выводится ТОЛЬКО из строки заказа: суммы в обработчике нет вовсе.
 *
 * Дефолт `lite` для незнакомой ссылки безопасен, пока номер заказа строит
 * `payboxProvider.ts` — он делает его из известной ссылки. Но 29.08.2026
 * выяснилось, что второй путь (`routes/payments.ts`) шлёт подтверждение по
 * другому адресу и строит номер иначе; стоит кому-нибудь «починить» адрес
 * одной строкой — и незнакомый заказ пойдёт сюда, не совпадёт ни с одним
 * образцом и человек получит САМЫЙ ДЕШЁВЫЙ тариф за любые деньги.
 *
 * Поведение не меняю — менять выдачу тарифов вслепую нельзя. Меняю одно:
 * дефолт перестаёт быть молчаливым. Незнакомая ссылка теперь видна в
 * Sentry, то есть расхождение обнаружится ДО того, как о нём напишет
 * покупатель.
 */
/** Экспортируется ради теста: молчаливый дефолт стоит проверять отдельно. */
export function tierForReference(ref: string): TierId {
  // Правило живёт в lib/payment/tierFromOrderReference: у PayBox и PayPal оно
  // было ДВУМЯ копиями, и вторая отставала на починку (шумная запись о
  // незнакомой ссылке появилась у paypal отдельно, уже после paybox).
  return тарифПоСсылкеЗаказа(ref, "paybox", (e, ctx) => capture(e, ctx));
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
  const seats = местИзКассы(raw.pg_param_seats);
  const modules = модулиИзКассы(raw.pg_param_modules, module);

  try {
    if (refunded || failed) {
      const действующая = readLatestSubscription(email);
      const отзываем = возвратКасаетсяДействующей(действующая, paymentId);
      if (!отзываем) {
        console.warn(
          `[paybox/webhook] возврат за ДРУГУЮ покупку: действующая подписка ` +
            `${действующая?.tierId} не тронута, возврат по ${paymentId}`
        );
        capture(new Error("refund_for_older_purchase_kept_current_subscription"), {
          route: "paybox/webhook/refund",
          email,
          refundedPaymentId: paymentId,
          currentTier: действующая?.tierId,
        });
      }
      const downgrade: Subscription = {
        id: `sub_paybox_${paymentId}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        termMonths: null,
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `paybox:${result.status}`,
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
      // Тот же признак, что на выдаче: возврат по покупке ОДНОГО модуля должен
      // снять право на модуль. Прежде здесь стояло `if (module)` — оно пропускало
      // случай, когда модуль назван не полем кассы, а самой ссылкой заказа
      // (`app_qskyway_lite`): право осталось бы активным после возврата денег.
      const модульВозврата = названныйМодуль(reference, module);
      if (модульВозврата) {
        try {
          await upsertAppSubscription(email, модульВозврата, "cancelled", downgrade.id);
        } catch (e) {
          const причина = e instanceof Error ? e.message : String(e);
          console.error(`[paybox/webhook] возврат НЕ снял доступ к модулю -> ${email}/${модульВозврата}: ${причина}`);
          capture(e, { route: "paybox/webhook/refund", email, module: модульВозврата });
          throw e;
        }
      }
      console.log(`[paybox/webhook] ${result.status} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded", email });
    }

    if (result.status === "paid") {
      // ─── Платёж БЕЗ тарифа не выдаёт тариф ──────────────────────────
      //
      // Прежний автор оставил здесь дефолт `lite` для незнакомой ссылки и
      // написал, при каком условии решение перестаёт быть верным: «стоит
      // кому-нибудь строить номер заказа иначе — и незнакомый заказ пойдёт
      // сюда, а человек получит самый дешёвый тариф за любую сумму».
      //
      // 04.09.2026: условие ВЫПОЛНЕНО, проверено. Второй путь оплаты
      // (`routes/payments.ts` → POST /paybox/init) строит номер как
      // `aevion-<время>-<id>`, а разбор снимает только хвост `_цифры`.
      // Ссылка не распознаётся и падает в `lite`. Этот путь принимает
      // «сумму и валюту» и тарифа НЕ ЗНАЕТ вовсе — то есть произвольный
      // платёж выдавал бы подписку.
      //
      // Класс не теоретический: у Gumroad по такому же пути прошли ТРИ
      // настоящие продажи книг (27 и 29 мая, 2 июня) — покупка файла за
      // $9.99 выдавала платный тариф. Там его закрыли картой известных
      // ссылок; здесь карты нет.
      //
      // Дефолт СОХРАНЁН для ссылок, которые выглядят подписочными: менять
      // выдачу тарифов вслепую действительно нельзя, и прежний автор был
      // прав. Меняется одно — заказ, который тарифом не является, тарифа
      // и не получает. Деньги при этом не теряются: платёж записан, а
      // оплата бюро узнаёт о себе сама, опрашивая провайдера.
      // ⚠️ ПОРЯДОК ВАЖЕН: эта развилка стоит ДО проверки «похожа ли ссылка на
      // подписку». Ссылка приложения подписочной не считается, поэтому раньше
      // оплаченная покупка модуля через PayBox не выдавалась ВООБЩЕ — ответ
      // `ignored: not_a_subscription_reference`, то есть деньги без доступа.
      // Тариф ей выдавать нельзя (это была бы планета за цену модуля), а
      // выдать надо ровно купленное.
      // 🔴 КУПЛЕН ОДИН МОДУЛЬ — ЗНАЧИТ И ПРАВО НА ОДИН МОДУЛЬ, НЕ ТАРИФ.
      //
      // Тариф с 15.09.2026 означает срок доступа ко ВСЕЙ планете ($400/мес):
      // normalizeTier превращает lite в full, а isModuleEntitled при full пускает
      // куда угодно. Записав покупку QSkyway за $16 платформенным тарифом, мы
      // отдали бы планету за цену модуля — замер 29.09 на Lemon Squeezy, где эта
      // утечка и была закрыта (dc5d45658). Здесь она спала только потому, что
      // касса выключена.
      //
      // Признак покупки — общий для всех касс (lib/payment/purchasedModule):
      // переданный кассой модуль либо ссылка приложения. Платформенную подписку
      // в этом случае НЕ создаём вовсе, иначе тариф снова откроет всё.
      const модульПокупки = купленныйМодуль(reference, module);
      if (модульПокупки) {
        // Порядок как у Lemon Squeezy: сперва выдать доступ, потом учёт. Отказ
        // записи не глотаем — иначе «заплатил, доступа нет, следов нет».
        // ⚠️ НОМЕР НАМЕРЕНИЯ ЗДЕСЬ НЕ ПЕРЕДАЁТСЯ, И ЭТО ИЗВЕСТНЫЙ ПРОБЕЛ.
        //
        // Экран после оплаты подтверждает покупку приложения через
        // `findAppSubscriptionByIntent(intentId)` (routes/checkout.ts). У Lemon
        // Squeezy номер приезжает в `custom_data.bureauIntentId` и передаётся
        // пятым аргументом; у этой кассы его в вебхуке НЕТ вовсе — проверено
        // грепом по файлу, ни одного упоминания.
        //
        // Следствие: покупка одного модуля через эту кассу выдаётся правильно
        // (право на модуль есть), но экран «оплата принята» не превратится в
        // «доступ открыт» — тот же класс, что 22.09.2026 у покупателей приложений
        // на Lemon Squeezy. Пока касса выключена на проде, вреда нет.
        //
        // Чинить надо ДО включения кассы, три варианта в очереди работ
        // (00-НАЧНИ-ОТСЮДА/2026-09-17-ОРКЕСТРАТОР-приоритеты.md, раздел 30.09):
        // провести номер намерения в customData; научить поиск сопоставлять по
        // номеру платежа; либо подтверждать по адресу и слагу.
        await upsertAppSubscription(email, модульПокупки, "active", paymentId);
        console.log(`[paybox/webhook] paid → один модуль: ${модульПокупки} for ${email} (ref=${reference})`);
        return res.json({ ok: true, action: "app_activated", appSlug: модульПокупки, email });
      }

      if (!ссылкаПодписки(reference)) {
        console.warn(
          `[paybox/webhook] заказ "${reference}" не похож на подписку — тариф НЕ выдан`,
        );
        capture(new Error(`paybox: платёж без тарифа, ссылка "${reference}"`), {
          route: "paybox/webhook",
          reference,
        });
        return res.json({ ok: true, ignored: "not_a_subscription_reference", reference });
      }

      const tierId = tierForReference(reference);
      const termMonths = termMonthsForReference(reference);
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

      // КАНАЛ привлечения. Едет общим путём: витрина кладёт его в тело
      // чекаута, провайдер превращает customData в pg_param_*, сюда он
      // приходит как pg_param_channel — тем же способом, что и выбранный
      // модуль строкой выше.
      //
      // До 01.09.2026 этого звена не было, и покупки через PayBox попадали в
      // сводке выручки в ключ "direct": деньги не терялись, но ответа на
      // вопрос «что окупилось» по ним не было.
      const purchaseChannel = raw.pg_param_channel?.trim().slice(0, 40) || undefined;

      const provResult = await provisionSubscription({
        email,
        tierId,
        termMonths,
        seats,
        modules,
        source: "paybox",
        ...(amountUsd === undefined ? {} : { amountUsd }),
        ...(purchaseChannel ? { channel: purchaseChannel } : {}),
        providerPaymentId: paymentId,
      });

      // Помодульную покупку записываем ЕЩЁ и в базу. Тарифная запись живёт
      // в файле, а помодульная — в Postgres, и её читает запасной путь
      // стены (planGate -> hasActiveAppSubscription). Через Lemon Squeezy
      // та же покупка получала обе записи, через PayBox — только файл: то
      // есть надёжность доступа зависела от кассы, а не от покупки.
      //
      // Не роняем обработчик: доступ УЖЕ выдан файлом, и повторная доставка
      // вебхука выдавала бы его второй раз. Но и молчать нельзя — отказ
      // обязан оставить след с тем, ЧТО и КОМУ не сохранилось.
      if (module) {
        try {
          await upsertAppSubscription(email, module, "active", provResult.subscription.id);
        } catch (e) {
          const причина = e instanceof Error ? e.message : String(e);
          console.warn(`[paybox/webhook] долговечная запись не сохранена -> ${email}/${module}: ${причина}`);
          capture(e, { route: "paybox/webhook", email, module });
        }
      }
      console.log(`[paybox/webhook] paid → provisioned ${tierId}/${termMonths}m for ${email} (ref=${reference})`);
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

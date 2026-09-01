/**
 * Lemon Squeezy SUBSCRIPTION webhook → plan provisioning.
 *
 * Distinct from the bureau one-off payment webhook (/api/bureau/payment/webhook,
 * which confirms a single Verified-tier purchase). This endpoint handles
 * recurring bundle / All-Access subscriptions and maps them to a user plan:
 *
 *   subscription_created | subscription_updated(active) |
 *   subscription_resumed | subscription_unpaused
 *     → provisionSubscription(...) — writes data/subscriptions.jsonl +
 *       welcome email. /api/pricing/subscription/me then reports the plan.
 *
 *   subscription_cancelled | subscription_expired | subscription_paused
 *     → writes a tierId:"free" downgrade record so /subscription/me reflects it.
 *
 * Activation tier (variant_id → reference → tier):
 *   - LEMON_SQUEEZY_VARIANT_MEDIUM_* → "medium" (modules = MEDIUM_BUNDLE)
 *   - LEMON_SQUEEZY_VARIANT_FULL_*   → "full"   (modules = [] == all)
 *   - LEMON_SQUEEZY_VARIANT_LITE_*   → "lite"   (modules = [], 1 product chosen in cabinet)
 *   - LEMON_SQUEEZY_VARIANT_<app>_*  → app_*    (доступ к одному модулю)
 *   - unrecognised variant id        → 500 `unmapped_variant`, НИЧЕГО не выдаём
 *
 * 🔴 Про «unrecognised → lite» (было до 12.08.2026). Дефолт выглядел
 * безопасным, а был самым дорогим: DevHub Studio Pro продаётся подпиской
 * $149/мес, ссылки `app_devhub` в таблице не было, обратный поиск возвращал
 * null — и покупатель за $149 получал доступ уровня $19. Ответ при этом 200,
 * то есть магазин не повторял доставку и следа не оставалось. Тариф наугад
 * не выдаём: неизвестный вариант — это «мы не знаем, что человек купил»,
 * и это должно быть видно. Охраняется `tests/lemonSqueezyWebhookEntitlement.test.ts`.
 *
 * Signature: HMAC-SHA256(rawBody, LEMON_SQUEEZY_WEBHOOK_SECRET) compared to
 * the x-signature header (hex). See
 * https://docs.lemonsqueezy.com/help/webhooks/signing-requests
 *
 * Env:
 *   LEMON_SQUEEZY_WEBHOOK_SECRET — required; if unset the route is a no-op
 *     stub (200 OK, logs) so a misconfigured deploy doesn't 500 on every hit.
 */

import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";
import {
  referenceForVariantId,
  tierForLemonSqueezyReference,
  isAppReference,
  appSlugForReference,
  type LemonSqueezyReference,
} from "../data/lemonSqueezyVariants";
import { MEDIUM_BUNDLE, TIERS } from "../data/pricing";
import { makeServiceCapture } from "../lib/sentry/platform";
import { getPool } from "../lib/dbPool";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";
import { safeErrorText } from "../lib/safeError";
import { upsertAppSubscription } from "../lib/appEntitlements";

/**
 * Запись прав живёт в lib/appEntitlements и НЕ дублируется здесь.
 *
 * Копия была, и она разошлась с оригиналом ровно так, как предсказывал
 * комментарий в самой библиотеке: молча и в трёх местах сразу.
 *   • не создавала таблицу прав — первая же покупка на базе без миграции
 *     падала в 500 и повторялась вечно;
 *   • не приводила адрес к нижнему регистру, а ЧТЕНИЕ прав приводит —
 *     покупка с адресом Ivan@Mail.ru не находилась никогда;
 *   • не сбрасывала кэш прав, и только что заплативший до минуты упирался
 *     в отказ.
 *
 * Через Gumroad те же покупки шли через библиотеку и работали. Один и тот
 * же товар выдавался по-разному в зависимости от кассы.
 */

async function upgradeDevHubByEmail(email: string, tier: "free" | "pro"): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(`
      INSERT INTO "DevHubEmailTier" ("email","tier","updatedAt") VALUES ($1,$2,NOW())
      ON CONFLICT ("email") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
    `, [email, tier]);
    const ur = await pool.query(`SELECT "id" FROM "AEVIONUser" WHERE LOWER("email")=$1 LIMIT 1`, [email]);
    if (ur.rows[0]?.id) {
      await pool.query(`
        INSERT INTO "DevHubTier" ("userId","tier","updatedAt") VALUES ($1,$2,NOW())
        ON CONFLICT ("userId") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
      `, [ur.rows[0].id, tier]);
    }
  } catch (err) {
    console.error("[ls/devhub] upgradeByEmail error:", err instanceof Error ? err.message : err);
    throw err; // см. комментарий в upsertAppSubscription — молчаливый 200 недопустим
  }
}

const capture = makeServiceCapture("lemonSqueezyWebhook");

export const lemonSqueezyWebhookRouter = Router();

interface LsSubscriptionPayload {
  meta?: {
    event_name?: string;
    custom_data?: { reference?: string; email?: string; module?: string; channel?: string };
  };
  data?: {
    id?: string;
    attributes?: {
      user_email?: string;
      variant_id?: number | string;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      /**
       * Фактически списанная сумма, в минорных единицах.
       *
       * Поле объявлено 01.09.2026: до этого вебхук суммы не касался вовсе
       * (грепом 0 упоминаний при 20 у слов variant/custom/order). У событий
       * подписки его может не быть — отсутствие тут нормально и тревогой не
       * считается.
       */
      total?: number | string | null;
    };
  };
}

const ACTIVATE_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_resumed",
  "subscription_unpaused",
]);

const DEACTIVATE_EVENTS = new Set([
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
]);

// Dedup survives restarts (see lib/webhookDedup): LS delivers at-least-once.
// Key on subscription id + event + the renews/ends timestamp so a redelivery is
// a no-op but a genuine later state change (new renews_at) still provisions.
//
// This used to be a process-lifetime Set, and the comment here said a missed
// dedup was tolerable because /subscription/me is latest-wins. That reasoning
// only covered the subscription record — a second provisioning run also sends
// the customer a second welcome email, which no reader tolerates.

function modulesForReference(ref: LemonSqueezyReference | null): string[] {
  if (!ref) return [];
  if (ref.includes("medium")) return [...MEDIUM_BUNDLE];
  // full → [] is read as "all" by the welcome email + access is granted by tier;
  // lite → [] (1 product of choice, selected in the cabinet after checkout).
  return [];
}

function verifySignature(rawBody: string, presented: string | undefined, secret: string): boolean {
  if (!presented) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Состояние вебхука — GET, для человека и для сторожа.
 *
 * Раньше ручки не было вовсе, и снаружи нельзя было отличить рабочий вебхук
 * от заглушки. Разница при этом денежная: без секрета POST ниже отвечает
 * `{ok:true, mode:"stub"}` — то есть говорит магазину «доставлено», ничего не
 * провижинит, и повторной доставки не будет. Покупка исчезает молча, а через
 * этот вебхук идут ВСЕ семь товаров каталога.
 *
 * Секрет наружу не отдаётся — только признак наличия. Сделано по образцу
 * такой же ручки у Gumroad, чтобы у обоих денежных каналов ответ читался
 * одинаково.
 */
lemonSqueezyWebhookRouter.get("/webhook", (_req, res) => {
  const configured = Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim());
  res.json({
    ok: true,
    endpoint: "lemon squeezy webhook",
    accepts: "POST application/json with x-signature",
    signed: configured,
    // Поле названо ОТРИЦАНИЕМ и означает ровно то, что измеряет.
    //
    // Сперва здесь стояло `provisioningLive: configured`, и это обещало
    // больше, чем проверено: секрет задан — ещё не значит, что провижининг
    // работает (нужны и база, и разбор варианта, и живой Postgres). Поле с
    // именем шире собственного замера — тот самый класс, из-за которого
    // `/health.qsign` однажды прочитали как состояние всей подписи.
    //
    // `true` здесь утверждает узкое и проверенное: секрета нет, POST ниже
    // отвечает магазину «доставлено» и НЕ провижинит. Обратное не обещает,
    // что всё хорошо, — только что этой конкретной поломки нет.
    purchasesDropped: !configured,
    mode: configured ? "live" : "stub",
    info: "GET is a status check. Without LEMON_SQUEEZY_WEBHOOK_SECRET the POST route is a no-op stub.",
  });
});

lemonSqueezyWebhookRouter.post("/webhook", async (req, res) => {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Отвечаем 200 намеренно: 5xx заставил бы магазин повторять доставку, а
    // при СОЗНАТЕЛЬНО пустом секрете (превью, локальный запуск) это был бы
    // поток повторов. Но молчать нельзя: в бою это означает, что оплаченная
    // покупка исчезла и никто не узнал. Поэтому след громкий — ошибка в
    // журнал и в Sentry, а не строчка console.log среди тысяч других.
    console.error(
      "[ls/webhook] STUB — LEMON_SQUEEZY_WEBHOOK_SECRET unset: покупка НЕ провижинена и повтора не будет",
    );
    capture(
      new Error("lemonSqueezy webhook received while unconfigured — purchase dropped"),
      { route: "lemonsqueezy/webhook", mode: "stub" },
    );
    return res.json({ ok: true, mode: "stub" });
  }

  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});

  const sig = (req.headers["x-signature"] as string | undefined) ?? undefined;
  if (!verifySignature(rawBody, sig, secret)) {
    console.error("[ls/webhook] signature mismatch");
    return res.status(401).json({ ok: false, error: "signature mismatch" });
  }

  let payload: LsSubscriptionPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "body is not JSON" });
  }

  const event = (payload.meta?.event_name ?? "").toLowerCase();
  const attrs = payload.data?.attributes ?? {};
  const email = (attrs.user_email ?? payload.meta?.custom_data?.email ?? "").trim().toLowerCase();

  if (event === "order_created" || event === "order_refunded") {
    // Возврат ЗАБИРАЕТ то, что выдала покупка. До 13.08.2026 слова «refund» в
    // этом обработчике не было вовсе: деньги вернули, а доступ к DevHub Pro
    // оставался навсегда. У Gumroad это обработано (`refunded → free`), у
    // Lemon Squeezy — нет; асимметрия нашлась сверкой двух рельсов.
    //
    // Осознанно НЕ трогаем `subscription_payment_refunded`: возврат одного
    // платежа не означает конца подписки (продавец может вернуть один счёт и
    // продолжить обслуживание), и снимать доступ по нему — значит отключать
    // платящего. Это решение о политике, а не о коде.
    const revoke = event === "order_refunded";
    // DevHub Studio Pro. В магазине это ПОДПИСКА, поэтому основной путь выдачи
    // доступа — ветка subscription_* ниже; здесь остаётся разовая покупка того
    // же варианта. Оба пути ведут в одну и ту же выдачу, повтор безвреден
    // (upgradeDevHubByEmail — upsert).
    const studioVariant = process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO?.trim();
    const variantId = String(attrs.variant_id ?? "");
    if (studioVariant && variantId === studioVariant && email) {
      const tier = revoke ? "free" : "pro";
      try {
        await upgradeDevHubByEmail(email, tier);
      } catch (err) {
        capture(err);
        console.error(`[ls/webhook] ${event} devhub tier NOT set for ${email}:`, err instanceof Error ? err.message : err);
        return res.status(500).json({ ok: false, error: "devhub_upgrade_failed" });
      }
      console.log(`[ls/webhook] ${event} devhub-studio-pro → ${tier} for ${email}`);
      return res.json({
        ok: true,
        action: revoke ? "devhub_studio_pro_revoked" : "devhub_studio_pro_activated",
        email,
      });
    }
    return res.json({ ok: true, ignored: event });
  }

  if (!event.startsWith("subscription_")) {
    return res.json({ ok: true, ignored: event || "unknown" });
  }
  if (!email) {
    return res.status(400).json({ ok: false, error: "missing user_email" });
  }

  // Dedup
  const dedupKey = `${payload.data?.id ?? "?"}:${event}:${attrs.renews_at ?? attrs.ends_at ?? ""}`;
  if (hasSeenWebhook("lemonsqueezy", dedupKey)) {
    return res.json({ ok: true, deduped: true });
  }
  markWebhookSeen("lemonsqueezy", dedupKey);

  try {
    const ref = referenceForVariantId(attrs.variant_id);
    const lsSubId = payload.data?.id ?? undefined;

    // СУММА. Сверять её точным равенством нельзя: скидочные коды делают
    // меньшую сумму законной, а у годового периода она другая по устройству.
    // Поэтому здесь только два случая, у которых нет законного прочтения.
    //
    // Цену берём из ЕДИНСТВЕННОГО источника — data/pricing.ts, тем же путём,
    // которым её показывает витрина. Второй список цен на бэкенде разошёлся бы
    // с первым молча.
    // Проверка на undefined/null ИЗБЫТОЧНА: Number(undefined) даёт NaN, а он не
    // проходит isFinite ниже. Мутация, снимающая её, поэтому и не ловится — это
    // честный результат, а не дыра. Условие оставлено: оно называет намерение
    // (отсутствие суммы у события подписки — норма, а не тревога) и стоит ноль.
    if (attrs.total !== undefined && attrs.total !== null) {
      const paid = Number(attrs.total);
      const tier = TIERS.find((t) => t.id === tierForLemonSqueezyReference(ref));
      const monthlyCents = tier && tier.priceMonthly != null ? Math.round(tier.priceMonthly * 100) : null;
      if (Number.isFinite(paid) && paid === 0) {
        // Ноль у платного тарифа — это не «дешевле», а «доступ бесплатно».
        console.warn(
          `[ls/webhook] ${event}: сумма 0 при тарифе ${tier?.id ?? "?"} — доступ выдаётся БЕСПЛАТНО ` +
            `(купон на 100% или ошибка настройки варианта)`,
        );
        capture(new Error(`ls_zero_total_provisioned:${payload.data?.id ?? "?"}`), { route: "ls/webhook" });
      } else if (Number.isFinite(paid) && monthlyCents !== null && paid > monthlyCents * 12) {
        // Порог — годовая стоимость по МЕСЯЧНОЙ цене. Годовой тариф у нас
        // дешевле двенадцати месяцев, скидки только уменьшают, поэтому всё,
        // что выше этой границы, законного прочтения не имеет: с человека
        // взяли больше, чем мы где-либо обещали. И он этого не увидит — наш
        // экран успеха показывает ОЖИДАЕМУЮ сумму из адреса возврата.
        console.warn(
          `[ls/webhook] ${event}: списано ${paid} при потолке ${monthlyCents * 12} для тарифа ` +
            `${tier?.id ?? "?"} — с покупателя взяли БОЛЬШЕ обещанного`,
        );
        capture(new Error(`ls_overcharge:${payload.data?.id ?? "?"}`), { route: "ls/webhook" });
      }
    }

    // ── Individual app subscription (app_* variants) ──────────────────
    if (isAppReference(ref)) {
      const appSlug = appSlugForReference(ref)!;
      if (ACTIVATE_EVENTS.has(event)) {
        await upsertAppSubscription(email, appSlug, "active", lsSubId);
        // У DevHub доступ открывает НЕ ТОЛЬКО строка AppSubscription: у него есть
        // свой тариф в DevHubTier/DevHubEmailTier, его и ставим отдельно.
        //
        // Формулировка «строку прав пока никто не читает» здесь была и устарела:
        // её читает planGate (hasActiveAppSubscription) и маршрут /api/apps/access.
        // Комментарий, объявляющий живой механизм мёртвым, опаснее отсутствия
        // комментария: по нему следующий заведёт второй такой же.
        if (appSlug === "devhub") await upgradeDevHubByEmail(email, "pro");
        console.log(`[ls/webhook] ${event} → app_sub activated: ${appSlug} for ${email}`);
        return res.json({ ok: true, action: "app_activated", appSlug, email });
      }
      if (DEACTIVATE_EVENTS.has(event)) {
        // ПОРЯДОК ЗДЕСЬ ЗНАЧИМ, и он обратный порядку активации.
        //
        // Записей две: строка прав (AppSubscription) и тариф, который РЕАЛЬНО
        // открывает доступ (DevHubTier/DevHubEmailTier). Строку прав читает
        // planGate. Между ними возможен сбой, и тогда важно, в какую
        // сторону мы промахнёмся.
        //
        // Было: сперва «отменено» в правах, потом снятие тарифа. Упади второе
        // — права говорят «отменено», а доступ ОСТАЁТСЯ. Магазин повторит
        // доставку (ниже 500 и освобождение ключа дедупликации), но если
        // повторы кончатся, платный доступ останется навсегда после отмены.
        //
        // Стало: сперва снимаем тариф. Упади вторая запись — доступа уже нет,
        // а строка прав всего лишь отстала, и её поправит повтор. Отказ
        // направлен в безопасную сторону.
        //
        // На активации порядок остаётся прежним намеренно: там безопасная
        // сторона другая — человек заплатил, и открыть доступ раньше, чем
        // дописать учёт, для него лучше.
        if (appSlug === "devhub") await upgradeDevHubByEmail(email, "free");
        await upsertAppSubscription(email, appSlug, "cancelled", lsSubId);
        console.log(`[ls/webhook] ${event} → app_sub cancelled: ${appSlug} for ${email}`);
        return res.json({ ok: true, action: "app_cancelled", appSlug, email });
      }
      return res.json({ ok: true, ignored: event });
    }

    // ── Platform tier subscription (tier_* variants) ─────────────────
    if (ACTIVATE_EVENTS.has(event)) {
      // Товар, которого нет ни в одной переменной окружения, — это НЕ повод
      // выдать тариф наугад. Прежде здесь срабатывал дефолт "lite": подписка за
      // $149 или $250 молча превращалась в доступ уровня $19, и магазин получал
      // 200 OK, то есть повтора и следа не было. Отвечаем 500 — доставка
      // повторится, событие останется видимым в панели магазина.
      if (!ref) {
        const err = new Error(
          `unmapped LS variant_id=${String(attrs.variant_id ?? "?")} (email=${email}, event=${event}) — ` +
          `добавьте переменную варианта в data/lemonSqueezyVariants.ts, тариф наугад не выдаём`,
        );
        capture(err);
        console.error(`[ls/webhook] ${err.message}`);
        // Отпускаем ключ дедупликации: иначе повторная доставка после
        // нашего 500 была бы отброшена как «уже видели», и покупка
        // осталась бы без выдачи навсегда. Тот же вызов, что в общем
        // обработчике ошибок ниже — хранилище дедупликации теперь
        // переживает перезапуск (lib/webhookDedup), и in-memory Set,
        // на который эта строка ссылалась, больше не существует.
        releaseWebhookKey("lemonsqueezy", dedupKey);
        return res.status(500).json({ ok: false, error: "unmapped_variant", variantId: String(attrs.variant_id ?? "") });
      }
      const tierId = tierForLemonSqueezyReference(ref);
      // Lite = 1 продукт на выбор: берём его из custom_data (передан на чекауте).
      const customModule = payload.meta?.custom_data?.module;
      const modules = tierId === "lite" && customModule ? [customModule] : modulesForReference(ref);
      // Канал приходит из ссылки: withChannel() кладёт его в
      // checkout[custom][channel] для LemonSqueezy. До 19.08.2026 вебхук его
      // не читал, и метка терялась на последнем шаге: клик по «Купить» мы
      // видели в своих событиях, а связать оплату с роликом было нечем.
      //
      // Пишем в ОТДЕЛЬНОЕ поле `channel`, а не суффиксом к `source`.
      // Сперва сделал суффиксом — у LemonSqueezy дословных сравнений нет, и
      // казалось безопасным. Но у Gumroad такие сравнения есть: страница
      // /revenue рисует бейдж провайдера через `s.source === "gumroad"`.
      // Значит `source` — это «через какую кассу прошли деньги», а канал —
      // другая ось, и складывать их в одно поле нельзя ни там, ни здесь.
      const channel = payload.meta?.custom_data?.channel?.trim().slice(0, 40);
      const result = await provisionSubscription({
        email,
        tierId,
        period: "monthly",
        modules,
        source: "lemonsqueezy",
        ...(channel ? { channel } : {}),
      });
      console.log(`[ls/webhook] ${event} → provisioned ${tierId} for ${email} (ref=${ref ?? "default"})`);
      return res.json({ ok: true, action: "activated", tierId, subscriptionId: result.subscription.id });
    }

    if (DEACTIVATE_EVENTS.has(event)) {
      const downgrade: Subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
        source: "lemonsqueezy:cancel",
      };
      writeSubscription(downgrade);
      console.log(`[ls/webhook] ${event} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded" });
    }

    // Known subscription_* event we don't act on (e.g. subscription_payment_success).
    return res.json({ ok: true, ignored: event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ls webhook failed"; // только для журнала
    const msgPublic = safeErrorText(err, "ls webhook failed", "lemonSqueezyWebhook");
    capture(err);
    console.error("[ls/webhook] handler error:", msg);
    // 500 so LS retries — provisioning is idempotent enough (latest-wins).
    releaseWebhookKey("lemonsqueezy", dedupKey);
    return res.status(500).json({ ok: false, error: msgPublic });
  }
});

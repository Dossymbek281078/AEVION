/**
 * Gumroad webhook handler — platform-wide.
 *
 *   POST /api/gumroad/webhook
 *
 * Handles Gumroad "ping" events for ALL AEVION products:
 *   - Bureau single-purchase (Verified tier, All-Access, bundles)
 *   - Constitution Pro / Team memberships
 *   - Any product whose Gumroad ping points to this URL
 *
 * Gumroad sends application/x-www-form-urlencoded POST.
 * Required env: GUMROAD_ACCESS_TOKEN (for identity confirmation if needed)
 * Optional env: GUMROAD_WEBHOOK_SECRET (for signature verification)
 *
 * Product routing:
 *   product_id / short_product_id is matched against
 *   GUMROAD_PRODUCT_<ID>=<reference>  env vars.
 *   If no match, falls back to "default" → generic Pro upgrade.
 *
 * References:
 *   https://help.gumroad.com/article/53-webhooks
 *   https://help.gumroad.com/article/56-ping
 */

import { Router, type Request, type Response } from "express";
import { gumroadPaymentProvider, verifyGumroadSaleDetailed } from "../lib/payment/gumroadProvider";
import {
  provisionSubscription,
  writeSubscription,
  readLatestSubscription,
  возвратКасаетсяДействующей,
  type Subscription,
} from "./provisioning";
import { termMonthsForReference } from "../lib/payment/billingPeriod";
import {
  STOREFRONT_NAME_TO_REFERENCE,
  tierForLemonSqueezyReference,
  appSlugForReference,
  type LemonSqueezyReference,
} from "../data/lemonSqueezyVariants";
import { TIERS, TERM_TIERS, standaloneApp, termTotal, type TierId, type TermTier } from "../data/pricing";
import { getPool } from "../lib/dbPool";
import { makeServiceCapture } from "../lib/sentry/platform";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";
import { upsertAppSubscription } from "../lib/appEntitlements";
import { logBureauAudit } from "./bureau";

// DevHub Studio Pro: upgrade DevHubTier + DevHubEmailTier on purchase
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
    console.error("[gumroad/devhub] upgradeByEmail error:", err instanceof Error ? err.message : err);
    // Ошибку НЕ глотаем. Раньше сбой записи оставался здесь, а вызывающий печатал
    // «devhub-studio-pro → tier=pro» и отвечал 200 с action "devhub_tier_set" —
    // оба утверждения ложные. Gumroad считал доставку успешной и не повторял её:
    // человек заплатил, доступа не получил, следов нет.
    throw err;
  }
}

const capture = makeServiceCapture("gumroadWebhook");

export const gumroadWebhookRouter = Router();


// Tier products are sold via the same GUMROAD_PERMALINK_TIER_* permalinks the
// checkout layer builds the buy-URL from. Gumroad pings that permalink back, so
// we can reverse-map it to a tier reference here — no separate opaque
// GUMROAD_PRODUCT_<id> mapping needed for the four subscription tiers.
// С 15.09.2026 ступени лестницы сроков: GUMROAD_PERMALINK_TIER_LITE … _MAX.
// Порядок важен: при общем товаре первой узнаётся самая короткая ступень.
const TIER_PERMALINK_ENV: Record<string, string> = Object.fromEntries(
  TERM_TIERS.map((t) => [`GUMROAD_PERMALINK_TIER_${t.toUpperCase()}`, `tier_${t}`]),
);

/**
 * Code-level defaults for the permalinks that actually exist in the AEVION
 * Gumroad account (verified against the live dashboard 2026-07-26 — 8 products
 * Published). Env still wins: this map is consulted only AFTER the env-driven
 * branches, and only replaces the legacy `constitution-pro` catch-all below.
 *
 * WHY THIS EXISTS — without it, entitlement depended on env vars nobody had set,
 * and the catch-all silently mis-provisioned real money:
 *   - a $9.99 BOOK buyer fell through to "constitution-pro" → tierForReference()
 *     → "lite", i.e. a book purchase handed out a paid subscription tier. The
 *     comment on branch 0 already warned about exactly this, but the protection
 *     was opt-in via GUMROAD_EXTERNAL_PERMALINKS. Three book sales have already
 *     gone through this path (27/29 May, 2 June).
 *   - an "AEVION All-Access" $59/mo buyer likewise landed on "lite" unless
 *     GUMROAD_PERMALINK_TIER_FULL_MONTHLY happened to be set to xpxzam.
 *
 * Deliberately NOT listed: `wjvquw` (Constitution Team $49/mo). tierForReference()
 * maps anything containing "team" to `full` = the whole ecosystem, which is very
 * likely not what a Constitution-scoped product should grant. Leaving it on the
 * catch-all keeps today's behaviour; deciding what Team actually unlocks is a
 * product call, not a silent code change.
 */
const KNOWN_PERMALINK_REFERENCE: Record<string, string> = {
  // Books and one-off guides — files, not subscriptions. "external" stops
  // provisioning from granting any tier at all.
  orcfbo: "external", // Gratitude ∞ Forever Young — Book (PDF + EPUB) $9.99
  lelzw: "external",  // Gratitude ∞ Forever Young — Book + Audiobook $14.99
  ghvzq: "external",  // Gratitude ∞ Forever Young — Complete Pack $29.99
  tmuyxw: "external", // Протокол «Анти-седина» (RU) $9
  oijxmq: "external", // Протокол долголетия — 12 недель (RU) $19
  kkiavh: "external", // The Anti-Grey Protocol (EN) $19
  // Platform bundle — the whole ecosystem.
  xpxzam: "tier_lite", // AEVION All-Access $59/mo — снят с продажи 15.09.2026; продление выдаётся как Lite (1 месяц)
  // Constitution entry tier — same as the legacy default, made explicit.
  pyiaz: "constitution-pro", // Constitution Pro $9/mo
  // Team задан ЯВНО с 13.08.2026. Раньше он проваливался в общую ветку, и это
  // было осознанным решением — пока общая ветка вела в тариф. Теперь она ведёт
  // в модуль, и молчаливое падение сюда делало бы Team за $49 равным Pro за $9.
  // Что именно Team добавляет (места? модули?) — вопрос к продукту, но
  // «неявно то же самое» ответом быть не может.
  wjvquw: "constitution-team", // Constitution Team $49/mo
};

/** Last path segment of a Gumroad permalink or full product URL, lowercased.
 *  "https://aevion.gumroad.com/l/xpxzam?x=1" → "xpxzam"; "xpxzam" → "xpxzam". */
function permalinkSlug(v?: string | null): string {
  if (!v) return "";
  const noQuery = v.trim().replace(/\/+$/, "").split("?")[0];
  return (noQuery.split("/").pop() ?? noQuery).toLowerCase();
}

function resolveReference(raw: Record<string, string>): string {
  const pingSlug = permalinkSlug(raw.product_permalink ?? raw.permalink ?? raw.short_product_id);

  // 0. Explicit external / non-AEVION products (e.g. books on the shared Gumroad
  //    account) — comma-separated permalinks in GUMROAD_EXTERNAL_PERMALINKS.
  //    Without this they hit the constitution-pro default and wrongly grant a
  //    subscription to a book buyer.
  if (pingSlug) {
    const externals = (process.env.GUMROAD_EXTERNAL_PERMALINKS ?? "")
      .split(",").map((s) => permalinkSlug(s)).filter(Boolean);
    if (externals.includes(pingSlug)) return "external";
  }

  // 1. Subscription tiers — reverse-map the ping's permalink to a tier reference.
  if (pingSlug) {
    for (const [envKey, reference] of Object.entries(TIER_PERMALINK_ENV)) {
      if (permalinkSlug(process.env[envKey]) === pingSlug && pingSlug) return reference;
    }
    // 1б. ВСЕ позиции кассы — по тому же правилу имени, по которому касса решает,
    //     что товар продаётся (gumroadSellable: GUMROAD_PERMALINK_<ССЫЛКА>).
    //     Замер 15.09.2026: касса умела продавать 17 позиций, а вебхук узнавал
    //     только шесть тарифов — Planet и девять приложений человек мог оплатить,
    //     но получал 500 «неизвестный товар» вместо доступа.
    for (const reference of new Set(Object.values(STOREFRONT_NAME_TO_REFERENCE))) {
      const envKey = `GUMROAD_PERMALINK_${reference.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
      if (permalinkSlug(process.env[envKey]) === pingSlug) return reference;
    }
    // 1в. Прежние тарифы (до 15.09.2026): tier_<слово>_<monthly|annual>. Замер на проде
    //     17.09.2026: заданы GUMROAD_PERMALINK_TIER_{LITE,MEDIUM,FULL}_{MONTHLY,ANNUAL}, все
    //     ведут на живые товары aevion-lite/medium/full, а вебхук их не читал — покупка и
    //     ПРОДЛЕНИЕ старого тарифа кончались 500 unmapped_product: деньги списаны, доступа
    //     нет. У Lemon Squeezy тот же случай решён (LEGACY_VARIANT_ENV). Снятие товара с
    //     публикации новые продажи останавливает, продления уже проданного — нет.
    //     Месячная раньше годовой: у Gumroad это один адрес, узнаётся самый короткий срок,
    //     а настоящий решает проверенная продажа (срокПоПродаже).
    for (const слово of ["lite", "medium", "full", "planet", "pro"]) {
      for (const период of ["monthly", "annual"]) {
        const reference = `tier_${слово}_${период}`;
        if (permalinkSlug(process.env[`GUMROAD_PERMALINK_${reference.toUpperCase()}`]) === pingSlug) return reference;
      }
    }
  }

  // 2. Explicit per-product override by product_id.
  const productId = raw.product_id ?? raw.short_product_id ?? "";
  if (productId) {
    const envKey = `GUMROAD_PRODUCT_${productId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const mapped = process.env[envKey];
    if (mapped) return mapped;
  }

  // 3. DevHub Studio Pro — matched by env or default slug "studio-pro"
  const studioPro = permalinkSlug(process.env.GUMROAD_PERMALINK_DEVHUB_STUDIO_PRO ?? "studio-pro");
  if (pingSlug && pingSlug === studioPro) return "devhub-studio-pro";

  // 4. Known AEVION permalinks — code-level default so entitlement never depends
  //    on an env var that was never set. See KNOWN_PERMALINK_REFERENCE above.
  // hasOwnProperty.call, а не просто KNOWN_PERMALINK_REFERENCE[pingSlug]: слаг
  // приходит из ТЕЛА вебхука, а обычный объект наследует ключи прототипа.
  // POST с `product_permalink=constructor` (адрес ping-ручки публично известен)
  // возвращал отсюда функцию `Object` вместо строки-ссылки, и падало дальше —
  // на `ref.toLowerCase()` в tierForReference, то есть 500 вместо честного
  // разбора. Доступ никому не выдавался, но денежная ручка роняется одной
  // строкой в теле запроса. Тот же класс, что и три другие находки 27.07.2026.
  if (pingSlug && Object.prototype.hasOwnProperty.call(KNOWN_PERMALINK_REFERENCE, pingSlug)) {
    return KNOWN_PERMALINK_REFERENCE[pingSlug];
  }

  // 5. Неизвестный товар. Раньше здесь стоял catch-all "constitution-pro" — он
  //    существовал, чтобы Pro работал без явной строки в карте. Pro теперь задан
  //    явно, а молчаливая выдача чего-либо незнакомому товару — ровно тот
  //    шаблон, что запрещён в вебхуке Lemon Squeezy: «мы не знаем, что человек
  //    купил» обязано быть видно, а не превращаться в подарок.
  return "unknown";
}

function tierForReference(ref: string): TierId {
  // Тариф кассы решает ОБЩЕЕ правило, то же, что у Lemon Squeezy. Своя догадка
  // по словам отправляла Planet в lite: человек платил за Planet и получал входной тариф.
  if (ref.startsWith("tier_")) return tierForLemonSqueezyReference(ref as LemonSqueezyReference);
  const r = ref.toLowerCase();
  if (r.includes("medium")) return "medium";
  // all-access / business / team / full → вся экосистема
  if (r.includes("full") || r.includes("all-access") || r.includes("business") || r.includes("team")) return "full";
  // lite / pro / constitution-pro → входной тир
  return "lite";
}

function isConstitutionProduct(ref: string): boolean {
  return ref.includes("constitution");
}

/**
 * Ссылка товара → slug модуля, если товар продаёт ровно один модуль.
 * Пока это только Конституция; список явный, чтобы новый товар не попал сюда
 * случайно по совпадению подстроки.
 */
function moduleSlugForReference(ref: string): string | null {
  const r = ref.toLowerCase();
  if (r === "constitution-pro" || r === "constitution-team") return "constitution";
  // Приложение кассы → тот же slug, что пишет вебхук Lemon Squeezy.
  if (r.startsWith("app_")) return appSlugForReference(r as LemonSqueezyReference);
  return null;
}

/**
 * Годовая или месячная — по ПРОВЕРЕННОЙ продаже, когда один товар Gumroad задан
 * для обоих периодов тарифа. Замер 15.09.2026: `aevion-lite` — одна подписка с
 * месячной и годовой ценой, вебхук брал первое совпадение (месячное), и
 * заплативший за год терял доступ через месяц — тот же класс, что 03.09.
 * Пинг не подписан, его `recurrence` НЕ читаем: иначе любой POST «yearly»
 * превращал бы месячную оплату в годовой доступ. Не удалось решить — месячная.
 */
/**
 * 15.09.2026: тариф — это срок. Один товар Gumroad может нести несколько сроков
 * (месяц, квартал, полгода, год; девяти месяцев Gumroad не умеет). Узнанная по
 * адресу ссылка тогда — первая ступень с этим адресом, самая короткая и дешёвая,
 * а настоящий срок решает ПРОВЕРЕННАЯ продажа: её recurrence, иначе оплаченная
 * сумма (±10% к платежу за срок). Не решилось — остаётся самая короткая ступень.
 */
const ПОВТОР_В_СРОК: Record<string, TermTier> = {
  monthly: "lite",
  quarterly: "medium",
  biannually: "pro",
  yearly: "max",
  annually: "max",
  annual: "max",
};

function срокПоПродаже(
  reference: string,
  sale: Record<string, unknown> | null,
  paidUsd: number | undefined,
): string {
  // Прежний тариф на общем адресе: месяц и год продавались одним товаром Gumroad, и по
  // адресу период не узнать. Ошибка дорогая — годовой покупатель с месячной ссылкой
  // теряет доступ через месяц (billingPeriod: _monthly = 1 мес, _annual = 12). Решает
  // recurrence проверенной продажи; не решилось — самый короткий срок, как у лестницы.
  // По сумме не угадываем: прежние цены жили в магазине, в коде их больше нет.
  const прежний = /^tier_([a-z]+)_(monthly|annual)$/.exec(reference);
  if (прежний) {
    const слагПрежней = (ref: string) => permalinkSlug(process.env[`GUMROAD_PERMALINK_${ref.toUpperCase()}`]);
    const месячная = `tier_${прежний[1]}_monthly`;
    const годовая = `tier_${прежний[1]}_annual`;
    const общий = слагПрежней(месячная) !== "" && слагПрежней(месячная) === слагПрежней(годовая);
    if (!общий) return reference;
    const r = sale?.recurrence;
    const повтор = typeof r === "string" ? r.toLowerCase() : "";
    if (повтор === "yearly" || повтор === "annually" || повтор === "annual") return годовая;
    return месячная;
  }
  const m = /^(tier|app_[a-z_]+?)_(lite|medium|pro|full|max)$/.exec(reference);
  if (!m) return reference;
  const семья = m[1];
  const ссылка = (t: TermTier) => `${семья}_${t}`;
  const слаг = (ref: string) =>
    permalinkSlug(process.env[`GUMROAD_PERMALINK_${ref.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`]);
  const свой = слаг(reference);
  if (!свой) return reference;
  const соседи = TERM_TIERS.filter((t) => слаг(ссылка(t)) === свой);
  if (соседи.length < 2) return reference;
  const r = sale?.recurrence;
  const повтор = typeof r === "string" ? r.toLowerCase() : "";
  if (Object.prototype.hasOwnProperty.call(ПОВТОР_В_СРОК, повтор)) {
    const поПовтору = ПОВТОР_В_СРОК[повтор];
    return соседи.includes(поПовтору) ? ссылка(поПовтору) : reference;
  }
  if (paidUsd === undefined || !(paidUsd > 0)) return reference;
  const цена = (t: TermTier): number | null => {
    if (семья === "tier") return TIERS.find((x) => x.id === t)?.priceTermTotal ?? null;
    const app = standaloneApp(семья.slice(4));
    return app ? termTotal(app.baseMonthly, t) : null;
  };
  let лучший: TermTier | null = null;
  let разница = Infinity;
  for (const t of соседи) {
    const p = цена(t);
    if (p === null || p <= 0) continue;
    const d = Math.abs(paidUsd - p) / p;
    if (d <= 0.1 && d < разница) {
      лучший = t;
      разница = d;
    }
  }
  return лучший ? ссылка(лучший) : reference;
}

/** Для сторожа «что продаётся — то выдаётся». Поведение не меняет. */
export const __testables = { resolveReference, tierForReference, moduleSlugForReference, срокПоПродаже };

/**
 * Какие позиции вебхук ВЫДАСТ, если их купят через Gumroad. Пара к
 * `gumroadSellable` (что касса продаёт): позиция, которая продаётся, но не
 * выдаётся, — это деньги без доступа. Отдаётся в /checkout/healthz, чтобы
 * расхождение было видно без покупки. Замер 15.09.2026: такое расхождение
 * (17 продаваемых при 6 узнаваемых) не видел ни один прибор.
 */
export function gumroadProvisionable(references: string[]): { configured: string[]; missing: string[] } {
  const configured: string[] = [];
  const missing: string[] = [];
  for (const ref of references) {
    const ключ = ref.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const slug = permalinkSlug(
      process.env[`GUMROAD_PERMALINK_${ключ}`]?.trim() ||
        process.env[`GUMROAD_${ключ}_PERMALINK`]?.trim() ||
        process.env.GUMROAD_DEFAULT_PERMALINK,
    );
    const узнан = slug ? resolveReference({ product_permalink: slug }) : "unknown";
    // Ступень на ОБЩЕМ товаре (один адрес у нескольких сроков) выдаётся своим
    // сроком: его решает проверенная продажа (срокПоПродаже), а не порядок совпадения.
    const семья = (x: string) => x.replace(/_(lite|medium|pro|full|max)$/, "");
    const ступеньНаОбщем = семья(ref) !== ref && узнан !== "unknown" && семья(узнан) === семья(ref);
    (узнан === ref || ступеньНаОбщем ? configured : missing).push(ref);
  }
  return { configured: configured.sort(), missing: missing.sort() };
}

// Liveness probe — Gumroad sends only POST, but a GET in the browser used to
// answer "Cannot GET" which looks like the URL is broken when configuring the
// webhook. Return a tiny JSON manifest instead so admins can sanity-check the
// endpoint by visiting it.
gumroadWebhookRouter.get("/webhook", (_req: Request, res: Response) => {
  // Поля названы так, чтобы по ответу было видно, ЗАЩИЩЁН ли денежный путь,
  // а не только жив ли адрес.
  //
  // Раньше ручка сообщала одно `signed` — и этого недостаточно. Замер на
  // проде 28.08.2026: `signed: false`, то есть подпись не проверяется, а
  // Ping-адрес публично известен. Единственная защита в этом режиме —
  // подтверждение продажи через API Gumroad, и оно требует
  // GUMROAD_ACCESS_TOKEN. Без токена `verifyGumroadSaleImpl` возвращает
  // "unverifiable", а обработчик на этом вердикте ПРОВИЖИНИТ (сознательно:
  // настоящий покупатель не должен терять доступ из-за сбоя у Gumroad).
  //
  // То есть «подписи нет» + «токена нет» = любой POST выдаёт платный тариф.
  // Ответ молчал ровно о второй половине этой пары, и снаружи отличить
  // защищённое состояние от беззащитного было нельзя.
  //
  // Ни секрет, ни токен наружу не отдаются — только признак наличия.
  const signed = Boolean(process.env.GUMROAD_WEBHOOK_SECRET?.trim());
  const saleCheckEnabled = process.env.GUMROAD_VERIFY_SALES !== "0";
  const canVerifySales = Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim());
  res.json({
    ok: true,
    endpoint: "gumroad webhook",
    accepts: "POST application/x-www-form-urlencoded",
    signed,
    saleVerification: !saleCheckEnabled
      ? "disabled"
      : canVerifySales
        ? "api"
        : "unavailable",
    // Поле названо ОТРИЦАНИЕМ, как у Lemon Squeezy, и по той же причине.
    //
    // Сперва здесь стояло `pingAuthenticated`, и это обещало больше, чем
    // проверено: наличие механизма — не то же самое, что проверенность
    // каждого пинга. Подтверждение продажи «падает открыто»: если запрос к
    // Gumroad не удался (сеть, 5xx, нет токена), обработчик провижинит, и
    // это ОСОЗНАННО — настоящий покупатель не должен терять доступ из-за
    // чужого сбоя.
    //
    // `true` здесь утверждает узкое и проверенное: удостоверять пинг нечем
    // вовсе, значит платный тариф выдаст ЛЮБОЙ POST на публично известный
    // адрес.
    anyPingProvisions: !signed && !(saleCheckEnabled && canVerifySales),
    info: "Gumroad sends sale/refund pings here as POST form-encoded. GET is for liveness check only.",
  });
});

gumroadWebhookRouter.post("/webhook", async (req: Request, res: Response) => {
  // Gumroad sends form-encoded — grab raw body for signature check
  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : "";

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
  }

  let parsed: ReturnType<typeof gumroadPaymentProvider.parseWebhook>;
  try {
    parsed = gumroadPaymentProvider.parseWebhook(headers, rawBody);
  } catch (err) {
    capture(err);
    console.error("[gumroad/webhook] parse error:", err);
    return res.status(400).json({ ok: false, error: "parse_failed" });
  }

  const { result, eventId } = parsed;

  // Reject a bad HMAC explicitly. parseWebhook signals a signature mismatch
  // via reason:"invalid_signature" with an emptied raw — without this guard
  // that would fall through to the no_email branch and answer 200, masking a
  // forged/misconfigured ping as a benign "no email" and telling Gumroad the
  // delivery succeeded. 401 makes rejection observable and retryable.
  if (result.reason === "invalid_signature") {
    console.warn("[gumroad/webhook] invalid signature — rejecting 401");
    return res.status(401).json({ ok: false, error: "invalid_signature" });
  }

  const raw = result.raw as Record<string, string> | null ?? {};

  // ФАКТИЧЕСКИ списанное, в долларах. Объявлено здесь, у начала тела, а не
  // рядом с проверкой: читателей два и они в РАЗНЫХ вложенных блоках —
  // тревоги о нулевой оплате и запись суммы в подписку. Первая редакция
  // объявляла её внутри проверки, и до записи переменная не доживала.
  let paidUsd: number | undefined;
  const saleId = raw.sale_id ?? raw.id ?? eventId ?? "";
  const email = (raw.email ?? "").trim().toLowerCase();
  const productId = raw.product_id ?? raw.short_product_id ?? "";
  const refunded = result.status === "refunded";
  const failed = result.status === "failed";

  if (!email) {
    console.warn("[gumroad/webhook] missing email, ignoring");
    return res.json({ ok: true, ignored: "no_email" });
  }

  // Dedup on sale_id + status
  const dedupKey = `${saleId}:${result.status}`;
  if (hasSeenWebhook("gumroad", dedupKey)) return res.json({ ok: true, deduped: true });
  markWebhookSeen("gumroad", dedupKey);

  // Канал покупки. withChannel() добавляет его в ссылку Gumroad вместе с
  // UTM-тройкой, а Gumroad возвращает параметры адреса плоскими ключами
  // `url_params[...]` — тело приходит form-urlencoded и разбирается через
  // Object.fromEntries(params.entries()).
  //
  // До 19.08.2026 вебхук их не читал: метка доезжала до кассы и терялась ровно
  // так же, как у LemonSqueezy. Клик по «Купить» мы видели в своих событиях,
  // а связать ОПЛАТУ с роликом было нечем.
  //
  // Запасным берём utm_source: withChannel кладёт туда то же значение, и если
  // Gumroad когда-нибудь перестанет возвращать наш собственный ключ, метка
  // всё равно доедет.
  const purchaseChannel = (
    raw["url_params[channel]"] ??
    raw["url_params[utm_source]"] ??
    ""
  ).trim().slice(0, 40);

  let reference = resolveReference(raw);

  // Products from other services (book platform etc.) share this Gumroad account
  // but don't need AEVION subscription provisioning — skip them silently.
  if (reference === "external") {
    console.log(`[gumroad/webhook] external product ${productId} — skipping`);
    return res.json({ ok: true, ignored: "external_product" });
  }

  // Подтверждение продажи, когда пинг не подписан.
  //
  // parseWebhook проверяет HMAC только при заданном GUMROAD_WEBHOOK_SECRET. На
  // проде 26.07.2026 секрет не задан, а Ping-адрес публично известен — то есть
  // любой POST с чужим email выдавал бы платный тариф без единого платежа.
  // Здесь мы спрашиваем у самого Gumroad, существует ли такая продажа.
  //
  // Отклоняем ТОЛЬКО при определённом «нет такой продажи». Если подтвердить не
  // удалось (нет токена, сеть, 5xx) — ведём себя как раньше и провижиним:
  // реальный покупатель не должен терять доступ из-за сбоя стороннего API.
  // Аварийный выключатель: GUMROAD_VERIFY_SALES=0.
  const signatureEnforced = Boolean(process.env.GUMROAD_WEBHOOK_SECRET);
  if (!signatureEnforced && process.env.GUMROAD_VERIFY_SALES !== "0") {
    // eslint-disable-next-line prefer-const
    let { verdict, sale } = await verifyGumroadSaleDetailed(saleId);
    // Флаг, а не ранний выход. Причина техническая и важная: освобождение
    // ключа дедупликации живёт в ОДНОЙ строке ниже, и ветка
    // launch/2026-08-30 заменяет её на общий модуль (`releaseWebhookKey`),
    // убирая набор `SEEN` целиком. Два МОИХ новых обращения к `SEEN`
    // пережили бы мерж без конфликта и сломали бы сборку: проверено
    // `git merge-tree` — в слитом файле 2 обращения и 0 объявлений.
    // Расширяя условие существующей строки, я не создаю новых обращений.
    let claimMismatch: "email" | "product" | null = null;

    // ЗАЯВЛЕННОЕ СВЕРЯЕТСЯ С ПОДТВЕРЖДЁННЫМ (19.08.2026).
    //
    // Проверка выше отвечает только на вопрос «такая продажа есть?». Товар и
    // адрес до сих пор брались из ТЕЛА ЗАПРОСА, а его пишет отправитель. То
    // есть обладатель настоящего дешёвого чека мог прислать его номер,
    // подставив `product_id` дорогого тарифа, — существование продажи
    // подтверждалось, и выдавался дорогой. Тем же способом права выписывались
    // на чужой адрес.
    //
    // Сверяем только то, что Gumroad действительно вернул: если поля в ответе
    // нет, молча пропускаем — придумывать за провайдера нельзя, а ложный
    // отказ здесь означал бы, что оплативший человек не получил товар.
    if (verdict === "confirmed" && sale) {
      const saleEmail = String(sale.purchase_email ?? sale.email ?? "").trim().toLowerCase();
      if (saleEmail && saleEmail !== email) claimMismatch = "email";
      const saleProduct = String(sale.product_id ?? "").trim();
      const saleShort = String(sale.short_product_id ?? "").trim();
      const claimed = String(productId ?? "").trim();
      if (claimed && (saleProduct || saleShort) && claimed !== saleProduct && claimed !== saleShort)
        claimMismatch = "product";
    }

    // Несовпадение заявки ПРИРАВНИВАЕТСЯ к «такой продажи нет»: продажи,
    // отвечающей этой заявке, действительно не существует. Так блок отказа
    // ниже остаётся байт в байт как в main — а его переписывает ветка
    // launch/2026-08-30, переводя освобождение ключа на общий модуль.
    // Точная причина уходит в Sentry выше, наружу её не отдаём.
    if (claimMismatch) {
      console.warn(`[gumroad/webhook] ${claimMismatch} в пинге не совпал с продажей ${saleId} — отказ`);
      capture(new Error(`gumroad_ping_${claimMismatch}_mismatch`), { route: "gumroad/webhook" });
      verdict = "not_found";
    }
    if (verdict === "not_found") {
      console.warn(`[gumroad/webhook] sale ${saleId} not found in Gumroad API — rejecting 401`);
      releaseWebhookKey("gumroad", dedupKey); // не занимать ключ отклонённым пингом
      return res.status(401).json({ ok: false, error: "sale_not_found" });
    }
    if (verdict === "unverifiable") {
      // Выдаём непроверенное НАМЕРЕННО: сверка не удалась по НАШЕЙ причине
      // (нет токена, API кассы недоступен), и наказывать за это настоящего
      // покупателя нельзя. Поведение оставлено как было.
      //
      // Но след обязан быть. Замер 02.09.2026: у Gumroad подписи на проде
      // НЕТ — пустое тело получает 200, тогда как остальные три кассы
      // отвечают 401. Значит сверка продажи — ЕДИНСТВЕННЫЙ замок. Истеки
      // токен — непроверяемым станет каждый вебхук, мы начнём выдавать
      // подписки кому угодно, и узнать об этом было бы неоткуда: раньше
      // здесь стоял только console.warn, а лог процесса живёт недолго и
      // его никто не читает.
      //
      // Поэтому отказ ЗАМКА идёт в Sentry — канал, который читают.
      console.warn(
        `[gumroad/webhook] sale ${saleId} unverifiable (no token or API unavailable) — provisioning anyway`,
      );
      // И в Sentry, а не только в консоль.
      //
      // Это ЕДИНСТВЕННЫЙ путь, на котором доступ выдаётся без подтверждения
      // продажи. Подписи у Gumroad нет — `GUMROAD_WEBHOOK_SECRET` на проде не
      // задан (проверено 29.08.2026 запросом ИМЁН переменных у сервиса), — и
      // если спросить сам Gumroad не удалось, мы намеренно открываем доступ,
      // чтобы настоящий покупатель не остался ни с чем.
      //
      // Направление отказа выбрано верно, а вот видимость не выбирается.
      // Консоль Railway пролистывается и никем не читается; смотрят Sentry.
      // Пока эта ветка там молчит, всплеск выдач без подтверждения выглядит
      // ровно как обычный день.
      // Текст ошибки ПОСТОЯННЫЙ, saleId — в контексте: приклеенный к тексту
      // идентификатор дробил бы группировку Sentry (каждая продажа — свой
      // issue), и всплеск из ста выдач выглядел бы как сто разных мелочей.
      capture(new Error("gumroad_sale_unverifiable_provisioned"), {
        route: "gumroad/webhook",
        saleId,
      });
    }

    // СУММА — только у продажи, которая ДЕЙСТВИТЕЛЬНО будет выдана.
    //
    // Сперва я поставил эту проверку выше, рядом со сверкой почты и товара, и
    // она заговорила о «выданном бесплатно доступе» на пингах, которые тут же
    // отклонялись как подделка. Хуже того, её тревога вытесняла из Sentry
    // настоящую — про несовпадение заявки. Утверждение о выдаче имеет смысл
    // только после того, как выдача решена.
    //
    // Сверить сумму с нашей ценой нечем: девять позиций каталога продаются
    // ПРЯМОЙ ссылкой Gumroad, наша сумма в неё не передаётся вовсе, а цен
    // модулей бэкенд не хранит. Поэтому здесь не сверка, а два однозначных
    // случая, для которых наша цена не нужна.
    //
    // Доступ НЕ отбираем ни в одном из них: купон основателя на 100% выглядит
    // так же, как ошибка настройки товара, а отказать оплатившему дороже, чем
    // выдать лишнее. Меняется одно — случай перестаёт быть невидимым.
    // Проверка `verdict === "confirmed"` сегодня ИЗБЫТОЧНА: провайдер отдаёт
    // непустой `sale` только вместе с этим вердиктом (проверено по всем шести
    // точкам возврата verifyGumroadSaleImpl). Мутация, снимающая её, поэтому и
    // не ловится ни одним тестом — и это честный результат, а не дыра: писать
    // тест на состояние, которого не бывает, значит закреплять выдумку.
    // Условие оставлено намеренно: оно называет намерение и переживёт смену
    // контракта провайдера, а стоит ноль.
    if (verdict === "confirmed" && sale) {
      const paidCents = Number.parseInt(String(sale.price ?? ""), 10);
      const pingCents = Number.parseInt(String(raw.price ?? ""), 10);
      // Наружу блока — её пишем в запись подписки ниже.
      if (Number.isFinite(paidCents) && paidCents > 0) paidUsd = paidCents / 100;
      // Один товар Gumroad на два периода: пинг не подписан, поэтому период
      // берём из ПРОВЕРЕННОЙ продажи (см. периодПоПродаже).
      const уточнённая = срокПоПродаже(reference, sale, paidUsd);
      if (уточнённая !== reference) {
        console.log(`[gumroad/webhook] sale ${saleId}: ${reference} → ${уточнённая} по проверенной продаже`);
        reference = уточнённая;
      }
      if (!Number.isFinite(paidCents) || paidCents <= 0) {
        console.warn(
          `[gumroad/webhook] sale ${saleId}: сумма ${JSON.stringify(sale.price ?? null)} — ` +
            `доступ выдаётся БЕСПЛАТНО (купон на 100% или ошибка настройки товара)`,
        );
        capture(new Error(`gumroad_zero_price_provisioned:${saleId}`), { route: "gumroad/webhook" });
      } else if (Number.isFinite(pingCents) && pingCents !== paidCents) {
        // Пинг не подписан (GUMROAD_WEBHOOK_SECRET на проде не задан), а адрес
        // ручки публично известен: расхождение сумм здесь — признак подделки.
        console.warn(
          `[gumroad/webhook] sale ${saleId}: в пинге ${pingCents}, в продаже ${paidCents} — ` +
            `пинг не подписан, расхождение суммы это признак подделки`,
        );
        capture(new Error(`gumroad_ping_price_mismatch:${saleId}`), { route: "gumroad/webhook" });
      }
    }
  }

  // DevHub Studio Pro — upgrades DevHubTier, not the main subscription tier.
  if (reference === "devhub-studio-pro") {
    const devhubTier = (refunded || failed) ? "free" : result.status === "paid" ? "pro" : null;
    if (devhubTier) {
      try {
        await upgradeDevHubByEmail(email, devhubTier);
      } catch (err) {
        capture(err);
        console.error(`[gumroad/webhook] devhub tier NOT set for ${email}:`, err instanceof Error ? err.message : err);
        // 500, чтобы доставка повторилась и событие осталось видимым у Gumroad.
        // Сообщить «успех» здесь — значит закрыть вопрос, не решив его.
        return res.status(500).json({ ok: false, error: "devhub_tier_failed" });
      }
      console.log(`[gumroad/webhook] devhub-studio-pro → tier=${devhubTier} for ${email}`);
      return res.json({ ok: true, action: "devhub_tier_set", tier: devhubTier, email });
    }
    return res.json({ ok: true, ignored: result.status });
  }

  // Bureau Verified one-time upgrade: match by email to the latest pending
  // BureauVerification row (KYC approved but payment not yet confirmed).
  if (reference === "bureau-verified") {
    if (refunded || failed) {
      // Значок НЕ отзываем: проверка личности реально проводилась, и
      // отзывать её за денежный спор — продуктовое решение, а не моё.
      // Оно ждёт слова основателя.
      //
      // Но БЕЗ СЛЕДА оставлять нельзя ни при какой политике: раньше
      // ветка возвращала ignored, не тронув запись, и "paymentStatus"
      // навсегда оставался 'paid'. То есть деньги вернули, а наши
      // собственные данные говорили "оплачено", и единственным следом
      // был console.log — на проде это память процесса, то есть ничто.
      //
      // Поле "paymentStatus" намеренно НЕ трогаем: его читают ворота
      // значка (bureau.ts: ready = kycStatus === "approved" &&
      // paymentStatus === "paid"), и запись 'refunded' отозвала бы
      // значок молча, приняв за основателя решение, которое он не принимал.
      await logBureauAudit({
        action: `payment_${result.status}_badge_kept`,
        certId: null,
        verificationId: null,
        actor: `gumroad:${saleId}`,
        payload: { email, saleId, status: result.status, reference },
      });
      // Мерж 06.09.2026: обе ветки чинили ВИДИМОСТЬ этого случая разными
      // каналами — запись в журнал аудита (выше) и Sentry. Оставлены оба:
      // журнал — durable-след, Sentry — то, что человек реально смотрит.
      // Механизм отзыва существует
      // (POST /api/bureau/admin/cert/:certId/revoke-verification), решение
      // принимает человек — но узнаёт о поводе сразу.
      console.error(
        `[gumroad/webhook] bureau ${result.status} for ${email}: статус Verified СОХРАНЁН (разовая покупка). ` +
          "Отозвать вручную: POST /api/bureau/admin/cert/:certId/revoke-verification",
      );
      capture(
        new Error("bureau Verified refunded — badge kept, manual review needed"),
        { route: "gumroad/webhook", reference: "bureau-verified", status: result.status },
      );
      return res.json({ ok: true, ignored: `bureau_${result.status}`, recorded: true });
    }
    if (result.status === "paid") {
      try {
        const pool = getPool();
        const intentId = `gumroad:sale:${saleId}`;
        const { rowCount } = await pool.query(
          `UPDATE "BureauVerification"
              SET "paymentStatus" = 'paid',
                  "paymentProvider" = 'gumroad',
                  "paymentIntentId" = $1
            WHERE "email" = $2
              AND "kycStatus" = 'approved'
              AND "paymentStatus" = 'unpaid'
              AND "id" = (
                SELECT "id" FROM "BureauVerification"
                 WHERE "email" = $2
                   AND "kycStatus" = 'approved'
                   AND "paymentStatus" = 'unpaid'
                 ORDER BY "createdAt" DESC
                 LIMIT 1
              )`,
          [intentId, email],
        );
        if ((rowCount ?? 0) > 0) {
          console.log(`[gumroad/webhook] bureau paid — marked verification for ${email}`);
          return res.json({ ok: true, action: "bureau_verified", email });
        } else {
          console.warn(`[gumroad/webhook] bureau paid — no pending verification for ${email}`);
          return res.json({ ok: true, action: "bureau_no_match", email });
        }
      } catch (err) {
        capture(err);
        console.error("[gumroad/webhook] bureau DB error:", err instanceof Error ? err.message : err);
        return res.status(500).json({ ok: false, error: "bureau_db_failed" });
      }
    }
    return res.json({ ok: true, ignored: result.status });
  }

  try {
    // Неизвестный товар: деньги пришли, а что за них выдать — неизвестно.
    // Молчать нельзя (получится подарок наугад), и выдавать наугад тоже.
    // 500 — доставка повторится, событие останется видимым в панели Gumroad.
    if (reference === "unknown") {
      const err = new Error(`неизвестный товар Gumroad: permalink=${raw.product_permalink ?? raw.permalink ?? "?"} product=${productId} email=${email}`);
      capture(err);
      console.error(`[gumroad/webhook] ${err.message}`);
      return res.status(500).json({ ok: false, error: "unmapped_product", permalink: String(raw.product_permalink ?? raw.permalink ?? "") });
    }

    // Товар, который продаёт ОДИН модуль, и должен давать этот модуль. Раньше
    // Constitution Pro за $9 превращался в тариф lite ($19) со свободным
    // выбором ЛЮБОГО модуля — включая те, что стоят $29–49. Человек платил за
    // одну вещь и получал право на другую, более дорогую, а по логам это
    // выглядело как обычная успешная выдача.
    const moduleSlug = moduleSlugForReference(reference);
    if (moduleSlug) {
      const active = result.status === "paid";
      // У DevHub доступ открывает ещё и его собственный тариф (DevHubTier) —
      // так же, как в вебхуке Lemon Squeezy. Порядок: при отзыве сперва снимаем
      // тариф, при выдаче — после строки прав; сбой → 500, чтобы Gumroad повторил.
      if (moduleSlug === "devhub" && !active) {
        try {
          await upgradeDevHubByEmail(email, "free");
        } catch (err) {
          capture(err);
          return res.status(500).json({ ok: false, error: "devhub_tier_failed" });
        }
      }
      await upsertAppSubscription(email, moduleSlug, active ? "active" : "cancelled", saleId);
      if (moduleSlug === "devhub" && active) {
        try {
          await upgradeDevHubByEmail(email, "pro");
        } catch (err) {
          capture(err);
          return res.status(500).json({ ok: false, error: "devhub_tier_failed" });
        }
      }
      console.log(`[gumroad/webhook] ${result.status} → app_sub ${active ? "active" : "cancelled"}: ${moduleSlug} for ${email}`);
      return res.json({
        ok: true,
        action: active ? "app_activated" : "app_cancelled",
        appSlug: moduleSlug,
        email,
      });
    }

    if (refunded || failed) {
      // Downgrade to free
      // Отзываем ТУ подписку, за которую вернули деньги, а не любую.
      // Правило общее на все кассы — provisioning.возвратКасаетсяДействующей.
      const действующая = readLatestSubscription(email);
      const отзываем = возвратКасаетсяДействующей(действующая, saleId);
      if (!отзываем) {
        console.warn(
          `[gumroad/webhook] событие возврата за ДРУГУЮ покупку: действующая ` +
            `подписка ${действующая?.tierId} не тронута`
        );
        capture(new Error("refund_for_older_purchase_kept_current_subscription"), {
          route: "gumroad/webhook/refund",
          email,
          currentTier: действующая?.tierId,
        });
      }
      const downgrade: Subscription = {
        id: `sub_gumroad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        termMonths: null,
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `gumroad:${result.status}`,
      };
      if (отзываем) writeSubscription(downgrade);
      console.log(`[gumroad/webhook] ${result.status} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded", email });
    }

    if (result.status === "paid") {
      const tierId = tierForReference(reference);
      // ПЕРИОД БЕРЁМ ИЗ ССЫЛКИ, а не считаем всех месячными.
      //
      // Здесь стоял `isMembership ? "monthly" : "monthly"` — тернарник, у
      // которого обе ветки одинаковы, то есть флаг не влиял ни на что.
      // Замер 03.09.2026: Gumroad продаёт ГОДОВЫЕ тарифы (tier_lite_annual,
      // tier_medium_annual, tier_full_annual — у каждого своя переменная
      // товара), и все они записывались как месячные. Срок доступа считается
      // по периоду, а годовая покупка у Gumroad — РАЗОВЫЙ платёж: продления
      // не будет. То есть человек платил за год и терял доступ через месяц,
      // а следующего события пришлось бы ждать одиннадцать месяцев.
      //
      // Правило то же, что у paybox и paypal (periodForReference): решает
      // слово в ссылке заказа.
      const termMonths = termMonthsForReference(reference);

      const provResult = await provisionSubscription({
        email,
        tierId,
        termMonths,
        modules: [],
        source: "gumroad",
        // Сумма из ПРОДАЖИ (API), а не из пинга: пинг не подписан. Если сумма
        // неизвестна или нулевая — поле не проставляем вовсе: ноль в выручке
        // хуже пустоты, по нему потом посчитают деньги.
        ...(paidUsd === undefined ? {} : { amountUsd: paidUsd }),
        providerPaymentId: saleId,
        ...(purchaseChannel ? { channel: purchaseChannel } : {}),
      });

      console.log(`[gumroad/webhook] paid → provisioned ${tierId} for ${email} (ref=${reference} product=${productId})`);

      return res.json({
        ok: true,
        action: "activated",
        tierId,
        email,
        subscriptionId: provResult.subscription.id,
        isConstitution: isConstitutionProduct(reference),
      });
    }

    return res.json({ ok: true, ignored: result.status });
  } catch (err) {
    releaseWebhookKey("gumroad", dedupKey);
    capture(err);
    console.error("[gumroad/webhook] handler error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "handler_failed" });
  }
});

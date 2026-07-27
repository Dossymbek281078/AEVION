/**
 * AEVION Revenue Hub — /api/revenue/*
 *
 * Централизованная точка сбора метрик монетизации по всем приложениям.
 *
 * Архитектура:
 *   - Gumroad (ОСНОВНОЙ и единственный живой процессинг): продажи через
 *     GET /v2/sales (access_token = GUMROAD_ACCESS_TOKEN) → /api/revenue/gumroad/*
 *   - Paddle Billing: KYC не пройдена → заглушка, не использовать как живой канал
 *   - PayBox: KZT локальные платежи
 *   - YouTube Analytics API (read-only)
 *   - Twitch Helix API (client-credentials)
 *
 * Все источники graceful-stub при отсутствии ключей.
 */

import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { REVENUE_APPS, getLiveRevenueApps, getRevenueApp } from "../data/revenueApps";
import { PADDLE_KEY, IS_PADDLE_SANDBOX, paddleGet } from "../lib/paddleClient";
import { makeServiceCapture } from "../lib/sentry/platform";
import { getPool } from "../lib/dbPool";

const capture = makeServiceCapture("revenue");

export const revenueRouter = Router();

const snapshotWriteLimit = rateLimit({ windowMs: 60_000, max: 6, standardHeaders: true, legacyHeaders: false });
const snapshotReadLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

// ─── ENV helpers ────────────────────────────────────────────────────────────

const PADDLE_SANDBOX = IS_PADDLE_SANDBOX;
const YT_API_KEY = () => process.env.YOUTUBE_API_KEY?.trim() || "";
const TWITCH_CLIENT_ID = () => process.env.TWITCH_CLIENT_ID?.trim() || "";
const TWITCH_CLIENT_SECRET = () => process.env.TWITCH_CLIENT_SECRET?.trim() || "";
const GUMROAD_TOKEN = () => process.env.GUMROAD_ACCESS_TOKEN?.trim() || "";
const LS_KEY = () => process.env.LEMON_SQUEEZY_API_KEY?.trim() || "";
const LS_STORE = () => process.env.LEMON_SQUEEZY_STORE_ID?.trim() || "";

// ─── Revenue goals (New Year targets) ──────────────────────────────────────
// Overridable via ENV so the numbers/deadline can change without a deploy;
// defaults match the $1M / $20M goals tracked on the dashboard.
const GOAL_PRIMARY_USD = () => Number(process.env.REVENUE_GOAL_PRIMARY_USD) || 1_000_000;
const GOAL_STRETCH_USD = () => Number(process.env.REVENUE_GOAL_STRETCH_USD) || 20_000_000;
const GOAL_DEADLINE = () => process.env.REVENUE_GOAL_DEADLINE?.trim() || "2027-01-01";

/** Адреса, покупки с которых — проверка платёжного пути, а не выручка.
 *  Их две в базе на 27.07.2026, и вместе они дают 89% брутто: своя книга за
 *  $9.99 и свой DevHub Studio Pro за $149. Пока они считались продажами,
 *  `/pitch` показывал инвестору $178.97 там, где снаружи пришло $19.98.
 *  Суммы не выбрасываются, а выносятся в отдельные поля — цифра должна
 *  становиться честнее, а не тише. */
const INTERNAL_EMAILS = (): Set<string> =>
  new Set(
    (process.env.REVENUE_INTERNAL_EMAILS ?? "yahiin1978@gmail.com,dossymbek@mail.ru")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export function isInternalPurchase(email: string | undefined | null, internal = INTERNAL_EMAILS()): boolean {
  return internal.has((email ?? "").trim().toLowerCase());
}

/**
 * Свод последних продаж по приложению и по источнику трафика.
 *
 * Вынесено из обработчика, чтобы правило «что считать продажей» можно было
 * проверить тестом: до этого оно жило внутри маршрута и расходилось с тем же
 * правилом в расчёте выручки, а увидеть расхождение можно было только глазами.
 *
 * Исключаются возвраты И наши собственные тестовые покупки. Второе — то, из-за
 * чего свод и разъехался с выручкой (issue #1039): выручка перестала считать
 * внутренние покупки в 49e238dd, а этот свод продолжал.
 *
 * Цена ошибки здесь выше, чем кажется. Метки `?c=` заводились ради вопроса
 * «какой канал окупается», а проверять их естественнее всего собственной
 * покупкой. Внешних продаж пока ноль — значит одна проверочная покупка дала бы
 * каналу 100% приписанной выручки, и бюджет распределялся бы по собственному
 * следу.
 */
export function aggregateRecentSales(
  rows: Array<{ appId: string; email?: string | null; amountUsd: number; refunded?: boolean; channel?: string | null }>,
): {
  byApp: Record<string, { count: number; totalUsd: number }>;
  bySource: Record<string, { count: number; totalUsd: number }>;
} {
  const byApp: Record<string, { count: number; totalUsd: number }> = {};
  const bySource: Record<string, { count: number; totalUsd: number }> = {};
  for (const s of rows) {
    if (s.refunded) continue;
    if (isInternalPurchase(s.email)) continue;
    // Продажи без метки собираются в "unattributed", а не выбрасываются: молча
    // терять часть выручки из сводки хуже, чем честно показать неразмеченное.
    const src = s.channel ?? "unattributed";
    if (!bySource[src]) bySource[src] = { count: 0, totalUsd: 0 };
    bySource[src].count++;
    bySource[src].totalUsd += s.amountUsd;
    if (!byApp[s.appId]) byApp[s.appId] = { count: 0, totalUsd: 0 };
    byApp[s.appId].count++;
    byApp[s.appId].totalUsd += s.amountUsd;
  }
  return { byApp, bySource };
}

// ─── LemonSqueezy orders (живой канал подписок) ───────────────────────────
interface LsOrder {
  id: string; total: number; status: string; refunded: boolean;
  currency: string; created_at: string; email: string; product: string;
  variantId: string;
}
/**
 * Fetch all pages of GET /v1/orders, following the JSON:API `links.next` URL.
 * Mirrors gumroadSalesUncached: partial pages already collected are returned
 * if a later page errors, and a maxPages cap stops a huge history from
 * hanging the request (logged, never silently truncated).
 */
async function lsOrdersUncached(maxPages = 10): Promise<LsOrder[] | null> {
  const key = LS_KEY();
  if (!key) return null;
  const store = LS_STORE();
  const all: LsOrder[] = [];
  let url: string | null =
    `https://api.lemonsqueezy.com/v1/orders?${store ? `filter[store_id]=${store}&` : ""}page[size]=50`;
  let pages = 0;
  try {
    while (url && pages < maxPages) {
      const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json" } });
      if (!r.ok) return all.length ? all : null;
      const j = await r.json() as {
        data?: { id: string; attributes: Record<string, unknown> }[];
        links?: { next?: string | null };
      };
      for (const o of j.data ?? []) {
        const a = o.attributes as Record<string, unknown>;
        const foi = (a.first_order_item ?? {}) as Record<string, unknown>;
        all.push({
          id: o.id,
          total: typeof a.total === "number" ? a.total : 0,
          status: String(a.status ?? ""),
          refunded: Boolean(a.refunded),
          currency: String(a.currency ?? "USD").toUpperCase(),
          created_at: String(a.created_at ?? ""),
          email: String(a.user_email ?? ""),
          product: String(foi.product_name ?? foi.variant_name ?? "AEVION"),
          variantId: String(foi.variant_id ?? ""),
        });
      }
      pages++;
      url = j.links?.next || null;
    }
    if (url && pages >= maxPages) {
      console.warn(`[revenue/lemonsqueezy] maxPages=${maxPages} reached — totals may undercount older orders`);
    }
    return all;
  } catch {
    return all.length ? all : null;
  }
}

/**
 * In-process cache for the LS orders walk (same TTL/shape as Gumroad's
 * salesCache). Without this, every hit to /lemonsqueezy/*, /summary, or the
 * header goal badge (polled sitewide every 60s) would re-walk the full LS
 * order history on every request — this bounds it to one fetch per window.
 */
const LS_ORDERS_TTL_MS = 60_000;
let lsOrdersCache: { at: number; data: LsOrder[] } | null = null;

async function lsOrders(force = false): Promise<LsOrder[] | null> {
  if (!force && lsOrdersCache && Date.now() - lsOrdersCache.at < LS_ORDERS_TTL_MS) {
    return lsOrdersCache.data;
  }
  const fresh = await lsOrdersUncached();
  if (fresh) lsOrdersCache = { at: Date.now(), data: fresh };
  return fresh;
}

/** Built-in permalink -> appId fallback (aevion.gumroad.com/l/<permalink>).
 *  Railway env vars with the GUMROAD_APP_ or GUMROAD_PRODUCT_ prefix still win;
 *  this only ensures known products attribute correctly even if their env var
 *  isn't set. Keep in sync with the Gumroad catalog. */
const GUMROAD_PERMALINK_APP: Record<string, string> = {
  orcfbo: "gratitude-book",     // Gratitude ∞ Forever Young — Book (PDF + EPUB)
  ghvzq: "gratitude-book",      // Gratitude ∞ Forever Young — Complete Pack
  lelzw: "gratitude-book",      // Gratitude ∞ Forever Young — Book + Audiobook
  pyiaz: "constitution",        // Constitution Pro ($9/mo)
  wjvquw: "constitution",       // Constitution Team ($49/mo)
  xpxzam: "aevion-all-access",  // AEVION All-Access ($59/mo, platform bundle)
  tmuyxw: "qrenew",             // Протокол «Анти-седина» (RU)
  kkiavh: "qrenew",             // The Anti-Grey Protocol (EN)
};

/** Permalink → appId. Set GUMROAD_APP_<PERMALINK>=<appId> to attribute a
 *  product's sales to a specific AEVION app. Falls back to the checkout layer's
 *  GUMROAD_PRODUCT_<PERMALINK> mapping (already set on Railway), then the
 *  built-in GUMROAD_PERMALINK_APP catalog; otherwise "platform". */
function appIdForPermalink(permalink?: string | null): string {
  if (!permalink) return "platform";
  const slug = permalink.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return (
    process.env[`GUMROAD_APP_${slug}`]?.trim() ||
    process.env[`GUMROAD_PRODUCT_${slug}`]?.trim() ||
    GUMROAD_PERMALINK_APP[permalink.toLowerCase()] ||
    "platform"
  );
}

/**
 * LemonSqueezy variant → appId, mirroring appIdForPermalink's approach for
 * Gumroad. LS checkout already sets one `LEMON_SQUEEZY_VARIANT_<NAME>` env
 * var per product (see aevion-globus-backend/.env.example) to know which
 * variant ID to charge for a given purchase — this just reads the same
 * vars in reverse to recover the appId from an order's variant_id.
 *
 * Deliberately excludes the generic plan-tier variants (LITE/MEDIUM/FULL,
 * DEFAULT_VARIANT_ID) — a "Full plan" subscription is a platform-wide
 * bundle, not one specific app's revenue, so those stay bucketed under
 * "platform" same as before.
 */
const LS_VARIANT_APP_ENV_SUFFIXES: Record<string, string> = {
  DEVHUB_STUDIO_PRO: "devhub",
  CYBERCHESS: "cyberchess",
  CONSTITUTION: "constitution",
  QVENTURE: "qventure",
  QCONTRACT: "qcontract",
  QPAYNET: "qpaynet-embedded",
  SMETA: "smeta-trainer",
  IP_BUREAU: "ip-bureau",
  QRENEW: "qrenew",
  PLANET_MONTHLY: "planet",
  PLANET_ANNUAL: "planet",
};

let lsVariantAppCache: Record<string, string> | null = null;

function appIdForLsVariant(variantId?: string | null): string {
  if (!variantId) return "platform";
  if (!lsVariantAppCache) {
    lsVariantAppCache = {};
    for (const [suffix, appId] of Object.entries(LS_VARIANT_APP_ENV_SUFFIXES)) {
      const v = process.env[`LEMON_SQUEEZY_VARIANT_${suffix}`]?.trim();
      if (v) lsVariantAppCache[v] = appId;
    }
  }
  return (
    process.env[`LEMON_SQUEEZY_APP_${variantId}`]?.trim() ||
    lsVariantAppCache[variantId] ||
    "platform"
  );
}

// ─── Twitch OAuth token (cached in-process) ───────────────────────────────

let twitchToken: string | null = null;
let twitchTokenExpiry = 0;

async function getTwitchToken(): Promise<string | null> {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  const cid = TWITCH_CLIENT_ID();
  const secret = TWITCH_CLIENT_SECRET();
  if (!cid || !secret) return null;
  try {
    const r = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${cid}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!r.ok) return null;
    const d = await r.json() as { access_token: string; expires_in: number };
    twitchToken = d.access_token;
    twitchTokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
    return twitchToken;
  } catch { return null; }
}

// ─── Paddle helpers ───────────────────────────────────────────────────────

// ─── YouTube helpers ──────────────────────────────────────────────────────

async function youtubeChannelStats(channelId: string): Promise<{
  subscribers: number; views: number; videoCount: number;
} | null> {
  const key = YT_API_KEY();
  if (!key || !channelId) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json() as { items?: { statistics: { subscriberCount: string; viewCount: string; videoCount: string } }[] };
    const s = d.items?.[0]?.statistics;
    if (!s) return null;
    return {
      subscribers: parseInt(s.subscriberCount || "0"),
      views: parseInt(s.viewCount || "0"),
      videoCount: parseInt(s.videoCount || "0"),
    };
  } catch { return null; }
}

// ─── Twitch helpers ───────────────────────────────────────────────────────

async function twitchChannelStats(login: string): Promise<{
  followers: number; viewerCount: number; isLive: boolean; displayName: string;
} | null> {
  const token = await getTwitchToken();
  const cid = TWITCH_CLIENT_ID();
  if (!token || !cid || !login) return null;
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Client-Id": cid,
    };
    const ur = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, { headers });
    if (!ur.ok) return null;
    const ud = await ur.json() as { data?: { id: string; display_name: string }[] };
    const user = ud.data?.[0];
    if (!user) return null;
    const sr = await fetch(`https://api.twitch.tv/helix/streams?user_login=${login}`, { headers });
    const sd = sr.ok ? await sr.json() as { data?: { viewer_count: number }[] } : { data: [] };
    const stream = sd.data?.[0];
    const fr = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`, { headers });
    const fd = fr.ok ? await fr.json() as { total?: number } : {};
    return {
      followers: (fd as { total?: number }).total ?? 0,
      viewerCount: stream?.viewer_count ?? 0,
      isLive: !!stream,
      displayName: user.display_name,
    };
  } catch { return null; }
}

// ─── Gumroad helpers ──────────────────────────────────────────────────────

interface GumroadSale {
  id?: string;
  /** Произвольные query-параметры со страницы оплаты. Сюда приезжает метка
   *  канала (?channel=instagram), которую ставит /go и /shop — благодаря ей
   *  видно не только ЧТО купили, но и откуда пришёл покупатель. */
  url_params?: Record<string, string>;
  email?: string;
  product_name?: string;
  product_permalink?: string;
  product_id?: string;
  price?: number;        // amount buyer paid, in cents
  gumroad_fee?: number;  // Gumroad's cut, in cents
  currency?: string;
  created_at?: string;
  refunded?: boolean;
  disputed?: boolean;
  chargedback?: boolean;
}

/**
 * In-process cache for the sales walk. Gumroad rate-limits the API and the
 * dashboard hits balance+recent on every load, so we serve a <=60s snapshot.
 * The Ping webhook (POST /gumroad/webhook) busts it the moment a sale lands.
 */
const SALES_TTL_MS = 60_000;
let salesCache: { at: number; data: GumroadSale[] } | null = null;

/** Drop the cached snapshot so the next read re-fetches from Gumroad. */
function invalidateGumroadSales(): void {
  salesCache = null;
}

/**
 * Fetch sales from Gumroad's GET /v2/sales, following next_page_url.
 * Returns null only when the token is missing or the very first call fails;
 * partial pages already collected are returned if a later page errors.
 * maxPages caps the walk so a huge history can't hang the request — if the cap
 * is hit we log it (no silent truncation).
 */
async function gumroadSalesUncached(maxPages = 10): Promise<GumroadSale[] | null> {
  const token = GUMROAD_TOKEN();
  if (!token) return null;
  const all: GumroadSale[] = [];
  let url: string | null =
    `https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(token)}`;
  let pages = 0;
  try {
    while (url && pages < maxPages) {
      const r: Response = await fetch(url);
      if (!r.ok) return all.length ? all : null;
      const d = (await r.json()) as {
        success?: boolean;
        sales?: GumroadSale[];
        next_page_url?: string;
      };
      if (!d.success || !Array.isArray(d.sales)) break;
      all.push(...d.sales);
      pages++;
      if (d.next_page_url) {
        let next = d.next_page_url.startsWith("http")
          ? d.next_page_url
          : `https://api.gumroad.com${d.next_page_url}`;
        if (!/[?&]access_token=/.test(next)) {
          next += (next.includes("?") ? "&" : "?") + `access_token=${encodeURIComponent(token)}`;
        }
        url = next;
      } else {
        url = null;
      }
    }
    if (url && pages >= maxPages) {
      console.warn(`[revenue/gumroad] maxPages=${maxPages} reached — totals may undercount older sales`);
    }
    return all;
  } catch {
    return all.length ? all : null;
  }
}

/**
 * Cached wrapper around gumroadSalesUncached (TTL 60s). Pass force=true to
 * bypass the cache. A null result (no token / first page failed) is never
 * cached, so a transient failure won't stick.
 */
async function gumroadSales(force = false): Promise<GumroadSale[] | null> {
  if (!force && salesCache && Date.now() - salesCache.at < SALES_TTL_MS) {
    return salesCache.data;
  }
  const fresh = await gumroadSalesUncached();
  if (fresh) salesCache = { at: Date.now(), data: fresh };
  return fresh;
}

// ─── Revenue snapshots (Postgres time-series for history/trend) ────────────
//
// The rest of the hub is stateless — it re-aggregates live channels on every
// read, so it can only show "now". A snapshot freezes the combined live totals
// (Gumroad net + LemonSqueezy gross) into a row, giving the dashboard a trend
// line and day-over-day growth. Capture on-demand (dashboard button) or from a
// cron hitting POST /snapshot (send x-revenue-token if REVENUE_SNAPSHOT_TOKEN
// is set).

let snapshotTableReady = false;
async function ensureSnapshotTable(): Promise<void> {
  if (snapshotTableReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "RevenueSnapshot" (
      "id"             TEXT PRIMARY KEY,
      "capturedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "grossUsd"       NUMERIC(14,2) NOT NULL DEFAULT 0,
      "netUsd"         NUMERIC(14,2) NOT NULL DEFAULT 0,
      "feesUsd"        NUMERIC(14,2) NOT NULL DEFAULT 0,
      "saleCount"      INT NOT NULL DEFAULT 0,
      "refundedCount"  INT NOT NULL DEFAULT 0,
      "byApp"          JSONB NOT NULL DEFAULT '{}'::jsonb,
      "byChannel"      JSONB NOT NULL DEFAULT '{}'::jsonb,
      "source"         TEXT NOT NULL DEFAULT 'combined',
      "internalUsd"    NUMERIC(14,2),
      "internalCount"  INT
    );
  `);
  // Таблица уже существует на проде с 26.05.2026 — CREATE ... IF NOT EXISTS её
  // не тронет, поэтому колонки добавляются отдельно. NULL здесь значимый: он
  // отмечает снимки, снятые ДО 27.07.2026, когда свои проверочные покупки ещё
  // входили в grossUsd. Без этой отметки график тренда покажет падение выручки
  // там, где на самом деле её просто перестали завышать.
  await pool.query(`ALTER TABLE "RevenueSnapshot" ADD COLUMN IF NOT EXISTS "internalUsd" NUMERIC(14,2);`);
  await pool.query(`ALTER TABLE "RevenueSnapshot" ADD COLUMN IF NOT EXISTS "internalCount" INT;`);
  // Отдельный явный признак вместо «internalUsd IS NULL значит гросс завышен».
  // Эта перегрузка сломалась ровно в тот момент, когда досчёт заполнил колонку:
  // у снимков, снятых ПОСЛЕ 27.07.2026, гросс уже без своих покупок, и вычитать
  // их повторно нельзя — на графике выходило минус сто тридцать девять долларов.
  await pool.query(`ALTER TABLE "RevenueSnapshot" ADD COLUMN IF NOT EXISTS "grossIncludesInternal" BOOLEAN;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "RevenueSnapshot_time_idx" ON "RevenueSnapshot" ("capturedAt" DESC);`);
  snapshotTableReady = true;
}

interface LiveTotals {
  grossUsd: number;
  /** Покупки с внутренних адресов — вынесены из выручки, но показаны отдельно. */
  internalUsd: number;
  internalCount: number;
  netUsd: number;
  feesUsd: number;
  saleCount: number;
  refundedCount: number;
  byApp: Record<string, { count: number; grossUsd: number }>;
  byChannel: Record<string, { grossUsd: number; netUsd: number; count: number }>;
  channelsUsed: string[];
}

/** Aggregate the live channels that are configured into one combined total.
 *  Gumroad contributes net (gross - fee) and per-app attribution; LemonSqueezy
 *  contributes gross (LS doesn't expose per-order fees). Missing channels are
 *  simply skipped — a snapshot with only one live channel is still valid. */
async function computeLiveTotals(): Promise<LiveTotals> {
  const t: LiveTotals = {
    grossUsd: 0, netUsd: 0, feesUsd: 0, saleCount: 0, refundedCount: 0,
    internalUsd: 0, internalCount: 0,
    byApp: {}, byChannel: {}, channelsUsed: [],
  };

  if (GUMROAD_TOKEN()) {
    const sales = await gumroadSales();
    if (sales) {
      const paid = sales.filter((s) => !s.refunded && !s.disputed && !s.chargedback);
      const internal = paid.filter((s) => isInternalPurchase(s.email));
      const valid = paid.filter((s) => !isInternalPurchase(s.email));
      t.internalUsd += internal.reduce((sum, s) => sum + (s.price ? s.price / 100 : 0), 0);
      t.internalCount += internal.length;
      const gross = valid.reduce((sum, s) => sum + (s.price ? s.price / 100 : 0), 0);
      const fees = valid.reduce((sum, s) => sum + (s.gumroad_fee ? s.gumroad_fee / 100 : 0), 0);
      t.grossUsd += gross;
      t.feesUsd += fees;
      t.netUsd += gross - fees;
      t.saleCount += valid.length;
      t.refundedCount += sales.length - paid.length;
      t.byChannel.gumroad = { grossUsd: round2(gross), netUsd: round2(gross - fees), count: valid.length };
      t.channelsUsed.push("gumroad");
      for (const s of valid) {
        const appId = appIdForPermalink(s.product_permalink);
        if (!t.byApp[appId]) t.byApp[appId] = { count: 0, grossUsd: 0 };
        t.byApp[appId].count++;
        t.byApp[appId].grossUsd = round2(t.byApp[appId].grossUsd + (s.price ? s.price / 100 : 0));
      }
    }
  }

  if (LS_KEY()) {
    const orders = await lsOrders();
    if (orders) {
      const paid = orders.filter((o) => o.status === "paid" && !o.refunded);
      const internal = paid.filter((o) => isInternalPurchase(o.email));
      const valid = paid.filter((o) => !isInternalPurchase(o.email));
      t.internalUsd += internal.reduce((sum, o) => sum + o.total / 100, 0);
      t.internalCount += internal.length;
      const gross = valid.reduce((sum, o) => sum + o.total / 100, 0);
      t.grossUsd += gross;
      t.netUsd += gross; // LS net (after ~5%+pp) only known at payout time
      t.saleCount += valid.length;
      t.refundedCount += orders.length - paid.length;
      t.byChannel.lemonsqueezy = { grossUsd: round2(gross), netUsd: round2(gross), count: valid.length };
      t.channelsUsed.push("lemonsqueezy");
      for (const o of valid) {
        const appId = appIdForLsVariant(o.variantId);
        const cur = t.byApp[appId] ?? { count: 0, grossUsd: 0 };
        cur.count += 1;
        cur.grossUsd = round2(cur.grossUsd + o.total / 100);
        t.byApp[appId] = cur;
      }
    }
  }

  t.grossUsd = round2(t.grossUsd);
  t.netUsd = round2(t.netUsd);
  t.feesUsd = round2(t.feesUsd);
  return t;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface SnapshotRow {
  id: string;
  capturedAt: string;
  grossUsd: string | number;
  netUsd: string | number;
  feesUsd: string | number;
  saleCount: number;
  refundedCount: number;
  byApp: Record<string, unknown>;
  byChannel: Record<string, unknown>;
  source: string;
  /** NULL у снимков до 27.07.2026 — тогда свои покупки ещё сидели в grossUsd. */
  internalUsd: string | number | null;
  internalCount: number | null;
  /** true — свои покупки СИДЯТ в grossUsd (снимки до 27.07.2026). */
  grossIncludesInternal: boolean | null;
}

function serializeSnapshot(r: SnapshotRow) {
  return {
    id: r.id,
    capturedAt: r.capturedAt,
    grossUsd: Number(r.grossUsd),
    netUsd: Number(r.netUsd),
    feesUsd: Number(r.feesUsd),
    saleCount: r.saleCount,
    refundedCount: r.refundedCount,
    byApp: r.byApp,
    byChannel: r.byChannel,
    source: r.source,
    internalUsd: r.internalUsd === null || r.internalUsd === undefined ? null : Number(r.internalUsd),
    internalCount: r.internalCount ?? null,
    // Строки старше самой колонки трактуем как «гросс завышен» — это
    // консервативная сторона: показать предупреждение там, где его можно было
    // не показывать, дешевле, чем вычесть свои покупки дважды.
    includesInternal: r.grossIncludesInternal ?? true,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/revenue/health
 */
revenueRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      lemonsqueezy: { configured: Boolean(LS_KEY()), primary: false, note: "вторичный канал подписок (Lite/Medium/Full)" },
      gumroad: { configured: Boolean(GUMROAD_TOKEN()), primary: true, note: "основной живой процессинг (подписки + one-time)" },
      paddle: {
        configured: Boolean(PADDLE_KEY()),
        sandbox: PADDLE_SANDBOX(),
        note: "KYC не пройдена — не используется; /api/paddle/* routes удалены (PR #779)",
      },
      paybox: { configured: Boolean(process.env.PAYBOX_MERCHANT_ID?.trim() && process.env.PAYBOX_SECRET?.trim()), note: "KZT — карты КЗ + Kaspi (12 приложений). Каскад checkout: currency=KZT → PayBox." },
      paypal: { configured: Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_SECRET?.trim()), sandbox: process.env.PAYPAL_SANDBOX !== "0", note: "Глобальный карт/PayPal-канал. Каскад checkout: method=paypal → PayPal Orders v2." },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    appsTotal: REVENUE_APPS.length,
    appsLive: getLiveRevenueApps().length,
  });
});

/**
 * GET /api/revenue/apps
 */
revenueRouter.get("/apps", (_req, res) => {
  res.json({
    apps: REVENUE_APPS.map((a) => ({
      appId: a.appId,
      appName: a.appName,
      channels: a.channels,
      color: a.color,
      description: a.description,
      live: a.live,
      hasYoutube: Boolean(a.youtubeChannelEnvKey && process.env[a.youtubeChannelEnvKey]),
      hasTwitch: Boolean(a.twitchChannelEnvKey && process.env[a.twitchChannelEnvKey]),
    })),
  });
});

/**
 * GET /api/revenue/apps/:appId
 */
revenueRouter.get("/apps/:appId", async (req, res) => {
  const app = getRevenueApp(req.params.appId);
  if (!app) return res.status(404).json({ error: "app_not_found" });

  const result: Record<string, unknown> = {
    appId: app.appId,
    appName: app.appName,
    channels: app.channels,
    color: app.color,
    live: app.live,
  };

  // YouTube stats
  if (app.youtubeChannelEnvKey) {
    const channelId = process.env[app.youtubeChannelEnvKey];
    result.youtube = channelId && YT_API_KEY()
      ? await youtubeChannelStats(channelId)
      : { stub: true, message: channelId ? "YOUTUBE_API_KEY not set" : `ENV ${app.youtubeChannelEnvKey} not set` };
  }

  // Twitch stats
  if (app.twitchChannelEnvKey) {
    const channel = process.env[app.twitchChannelEnvKey];
    result.twitch = channel && TWITCH_CLIENT_ID()
      ? await twitchChannelStats(channel)
      : { stub: true, message: channel ? "TWITCH_CLIENT_ID/SECRET not set" : `ENV ${app.twitchChannelEnvKey} not set` };
  }

  // Paddle: recent transactions for this app
  if (PADDLE_KEY()) {
    const data = await paddleGet(
      `/transactions?per_page=10&order_by=id[DESC]`,
    ) as { data?: { id: string; status: string; custom_data?: Record<string, string>; total?: string; currency_code?: string; created_at?: string }[] } | null;
    const txs = (data?.data ?? []).filter((t) => t.custom_data?.app_id === app.appId);
    result.paddle = {
      recentTransactions: txs.map((t) => ({
        id: t.id,
        status: t.status,
        amountUsd: t.total ? parseFloat(t.total) / 100 : 0,
        currency: t.currency_code ?? "USD",
        date: t.created_at,
      })),
      total: txs.filter((t) => t.status === "completed")
        .reduce((s, t) => s + (t.total ? parseFloat(t.total) / 100 : 0), 0),
      sandbox: PADDLE_SANDBOX(),
    };
  } else {
    result.paddle = { stub: true, message: "PADDLE_API_KEY not set — Paddle не используется (KYC), канал = Gumroad" };
  }

  res.json(result);
});

/**
 * GET /api/revenue/overview
 */
revenueRouter.get("/overview", (_req, res) => {
  const live = getLiveRevenueApps();
  const channelMap: Record<string, number> = {};
  for (const app of live) {
    for (const ch of app.channels) {
      channelMap[ch] = (channelMap[ch] || 0) + 1;
    }
  }
  res.json({
    totalApps: REVENUE_APPS.length,
    liveApps: live.length,
    channelCoverage: channelMap,
    providers: {
      lemonsqueezy: { configured: Boolean(LS_KEY()), primary: false },
      gumroad: { configured: Boolean(GUMROAD_TOKEN()), primary: true },
      paddle: { configured: Boolean(PADDLE_KEY()), sandbox: PADDLE_SANDBOX() },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    apps: live.map((a) => ({ appId: a.appId, appName: a.appName, channels: a.channels, color: a.color })),
  });
});

/**
 * GET /api/revenue/goals
 * Static targets for the dashboard's goal-progress bars. Configurable via
 * REVENUE_GOAL_PRIMARY_USD / REVENUE_GOAL_STRETCH_USD / REVENUE_GOAL_DEADLINE
 * so they can move without a frontend deploy.
 */
revenueRouter.get("/goals", (_req, res) => {
  res.json({
    primaryUsd: GOAL_PRIMARY_USD(),
    stretchUsd: GOAL_STRETCH_USD(),
    deadline: GOAL_DEADLINE(),
  });
});

/**
 * GET /api/revenue/summary
 * Cheap read of the combined live totals (same aggregation the snapshot
 * cron writes) without persisting anything — for lightweight widgets like
 * the header goal badge that just need "where are we right now".
 */
revenueRouter.get("/summary", async (_req, res) => {
  try {
    const totals = await computeLiveTotals();
    res.json({
      grossUsd: totals.grossUsd,
      netUsd: totals.netUsd,
      saleCount: totals.saleCount,
      channelsUsed: totals.channelsUsed,
      // Свои проверочные покупки не входят в суммы выше, но и не прячутся.
      internalUsd: totals.internalUsd,
      internalCount: totals.internalCount,
    });
  } catch (err: unknown) {
    capture(err, { route: "GET /summary" });
    console.error("[revenue] summary_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "summary_failed" });
  }
});

/**
 * GET /api/revenue/youtube/:channelId
 */
revenueRouter.get("/youtube/:channelId", async (req, res) => {
  if (!YT_API_KEY()) return res.status(503).json({ error: "YOUTUBE_API_KEY not configured" });
  const stats = await youtubeChannelStats(req.params.channelId);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/twitch/:login
 */
revenueRouter.get("/twitch/:login", async (req, res) => {
  if (!TWITCH_CLIENT_ID() || !TWITCH_CLIENT_SECRET())
    return res.status(503).json({ error: "TWITCH_CLIENT_ID/SECRET not configured" });
  const stats = await twitchChannelStats(req.params.login);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/paddle/balance
 * Сводка баланса через Paddle transactions.
 */
revenueRouter.get("/paddle/balance", async (_req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, message: "PADDLE_API_KEY not set — Paddle decommissioned (PR #779)" });
  }
  const data = await paddleGet("/transactions?per_page=50&status_equals=completed") as {
    data?: { total?: string; currency_code?: string; custom_data?: Record<string, string> }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });

  const totalUsd = (data.data ?? []).reduce((s, t) => s + (t.total ? parseFloat(t.total) / 100 : 0), 0);
  res.json({ totalUsd, currency: "USD", sandbox: PADDLE_SANDBOX(), transactionCount: data.data?.length ?? 0 });
});

/**
 * GET /api/revenue/paddle/recent
 * Последние транзакции с разбивкой по app_id.
 */
revenueRouter.get("/paddle/recent", async (_req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, transactions: [], message: "PADDLE_API_KEY not set — Paddle decommissioned (PR #779)" });
  }
  const data = await paddleGet("/transactions?per_page=20&order_by=id[DESC]") as {
    data?: { id: string; status: string; custom_data?: Record<string, string>; total?: string; currency_code?: string; created_at?: string }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });

  const transactions = (data.data ?? []).map((t) => ({
    id: t.id,
    appId: t.custom_data?.app_id || "platform",
    status: t.status,
    amountUsd: t.total ? parseFloat(t.total) / 100 : 0,
    currency: t.currency_code ?? "USD",
    date: t.created_at,
  }));

  const byApp: Record<string, { count: number; totalUsd: number }> = {};
  for (const t of transactions) {
    if (t.status === "completed") {
      if (!byApp[t.appId]) byApp[t.appId] = { count: 0, totalUsd: 0 };
      byApp[t.appId].count++;
      byApp[t.appId].totalUsd += t.amountUsd;
    }
  }

  res.json({ transactions, byApp, sandbox: PADDLE_SANDBOX() });
});

/**
 * GET /api/revenue/gumroad/balance
 * Net-баланс по живому каналу: gross - Gumroad fee, USD. Возвраты исключены.
 */
revenueRouter.get("/gumroad/balance", async (_req, res) => {
  if (!GUMROAD_TOKEN()) {
    return res.json({ stub: true, message: "GUMROAD_ACCESS_TOKEN not set", setupGuide: "/api/revenue/env-guide" });
  }
  const sales = await gumroadSales();
  if (!sales) return res.status(502).json({ error: "gumroad_api_error" });

  const valid = sales.filter((s) => !s.refunded && !s.disputed && !s.chargedback);
  const grossUsd = valid.reduce((sum, s) => sum + (s.price ? s.price / 100 : 0), 0);
  const feesUsd = valid.reduce((sum, s) => sum + (s.gumroad_fee ? s.gumroad_fee / 100 : 0), 0);
  // Здесь gross намеренно остаётся полным — он должен сходиться с кабинетом
  // Gumroad. Свои проверочные покупки показываются рядом, чтобы дашборд мог
  // сказать «из них свои», а сверка с провайдером не сломалась.
  const internal = valid.filter((s) => isInternalPurchase(s.email));

  res.json({
    grossUsd,
    feesUsd,
    netUsd: grossUsd - feesUsd,
    currency: "USD",
    saleCount: valid.length,
    refundedCount: sales.length - valid.length,
    internalUsd: round2(internal.reduce((sum, s) => sum + (s.price ? s.price / 100 : 0), 0)),
    internalCount: internal.length,
  });
});

/**
 * GET /api/revenue/gumroad/recent
 * Последние продажи с разбивкой по app_id (через GUMROAD_APP_<PERMALINK>).
 */
revenueRouter.get("/gumroad/recent", async (_req, res) => {
  if (!GUMROAD_TOKEN()) {
    return res.json({ stub: true, sales: [], byApp: {}, message: "GUMROAD_ACCESS_TOKEN not set" });
  }
  const sales = await gumroadSales();
  if (!sales) return res.status(502).json({ error: "gumroad_api_error" });

  const recent = sales.slice(0, 20).map((s) => ({
    id: s.id ?? "",
    appId: appIdForPermalink(s.product_permalink),
    product: s.product_name ?? s.product_permalink ?? "unknown",
    email: s.email ?? null,
    amountUsd: s.price ? s.price / 100 : 0,
    currency: s.currency?.toUpperCase() ?? "USD",
    refunded: Boolean(s.refunded || s.disputed || s.chargedback),
    // null = продажа пришла без метки: либо до введения атрибуции, либо человек
    // попал на товар не через /go и /shop (прямая ссылка, поиск Gumroad).
    channel: s.url_params?.channel ?? null,
    date: s.created_at ?? null,
  }));

  // Разрез по ИСТОЧНИКУ ТРАФИКА — ответ на вопрос «что окупается», ради которого
  // метки и заводились. Имя `bySource`, а не `byChannel`: в этом файле `byChannel`
  // уже занят и означает ПЛАТЁЖНЫЙ канал (gumroad / lemonsqueezy). Одно имя на два
  // разных смысла в одном файле — гарантированная будущая путаница.
  //
  // Продажи без метки собираются в "unattributed", а не выбрасываются: молча терять
  // часть выручки из сводки хуже, чем честно показать, сколько её не размечено.
  const { byApp, bySource } = aggregateRecentSales(recent);

  res.json({ sales: recent, byApp, bySource });
});

/**
 * GET /api/revenue/lemonsqueezy/balance
 * Сводка по живому каналу подписок. grossUsd = сумма оплаченных заказов.
 * Комиссию LS (~5%+pp) заказы не отдают — net считается в выплатах LS.
 */
revenueRouter.get("/lemonsqueezy/balance", async (_req, res) => {
  if (!LS_KEY()) {
    return res.json({ stub: true, message: "LEMON_SQUEEZY_API_KEY not set" });
  }
  const orders = await lsOrders();
  if (!orders) return res.status(502).json({ error: "lemonsqueezy_api_error" });
  const valid = orders.filter((o) => o.status === "paid" && !o.refunded);
  const grossUsd = valid.reduce((s, o) => s + o.total / 100, 0);
  // Как и у Gumroad: gross сходится с кабинетом провайдера, свои покупки —
  // отдельной строкой. На 27.07.2026 весь LS-баланс это одна своя покупка.
  const internal = valid.filter((o) => isInternalPurchase(o.email));
  res.json({
    grossUsd,
    currency: "USD",
    saleCount: valid.length,
    refundedCount: orders.length - valid.length,
    internalUsd: round2(internal.reduce((sum, o) => sum + o.total / 100, 0)),
    internalCount: internal.length,
    note: "LS забирает комиссию ~5%+pp; точный net — в Payouts LS",
  });
});

/**
 * GET /api/revenue/lemonsqueezy/recent
 * Последние заказы LemonSqueezy.
 */
revenueRouter.get("/lemonsqueezy/recent", async (_req, res) => {
  if (!LS_KEY()) {
    return res.json({ stub: true, sales: [], message: "LEMON_SQUEEZY_API_KEY not set" });
  }
  const orders = await lsOrders();
  if (!orders) return res.status(502).json({ error: "lemonsqueezy_api_error" });
  const recent = orders.slice(0, 20).map((o) => ({
    id: o.id,
    appId: appIdForLsVariant(o.variantId),
    product: o.product,
    email: o.email || null,
    amountUsd: o.total / 100,
    currency: o.currency,
    refunded: o.refunded,
    date: o.created_at || null,
  }));
  res.json({ sales: recent });
});

/**
 * POST /api/revenue/gumroad/webhook
 * Gumroad Ping target — fires on each sale/refund. We don't persist the
 * payload (form-encoded sale params); we just bust the sales cache so the
 * dashboard reflects the change on its next load — near-real-time without
 * polling Gumroad on every hit. Configure URL in Gumroad → Settings →
 * Advanced → Ping.
 */
revenueRouter.post("/gumroad/webhook", (_req, res) => {
  invalidateGumroadSales();
  res.json({ ok: true });
});

/**
 * POST /api/revenue/snapshot
 * Freeze the current combined live totals into a RevenueSnapshot row.
 * If REVENUE_SNAPSHOT_TOKEN is set, require it in the x-revenue-token header
 * (so a cron can write but the public can't spam the table). Otherwise open,
 * matching the hub's public posture — but rate-limited to 6/min regardless.
 */
revenueRouter.post("/snapshot", snapshotWriteLimit, async (req, res) => {
  try {
    const guard = process.env.REVENUE_SNAPSHOT_TOKEN?.trim();
    if (guard && String(req.header("x-revenue-token") ?? "") !== guard) {
      return res.status(401).json({ error: "snapshot_token_required" });
    }
    await ensureSnapshotTable();
    const totals = await computeLiveTotals();
    if (totals.channelsUsed.length === 0) {
      return res.status(503).json({ error: "no_live_channel", message: "Neither GUMROAD_ACCESS_TOKEN nor LEMON_SQUEEZY_API_KEY is configured — nothing to snapshot." });
    }
    const id = crypto.randomUUID();
    const pool = getPool();
    const r = await pool.query(
      `INSERT INTO "RevenueSnapshot" ("id","grossUsd","netUsd","feesUsd","saleCount","refundedCount","byApp","byChannel","source","internalUsd","internalCount","grossIncludesInternal")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'combined',$9,$10,false)
       RETURNING "id","capturedAt","grossUsd","netUsd","feesUsd","saleCount","refundedCount","byApp","byChannel","source","internalUsd","internalCount","grossIncludesInternal"`,
      [
        id, totals.grossUsd, totals.netUsd, totals.feesUsd, totals.saleCount, totals.refundedCount,
        JSON.stringify(totals.byApp), JSON.stringify(totals.byChannel),
        totals.internalUsd, totals.internalCount,
      ],
    );
    // Bound the table's growth: /snapshots and /trend never query past 365
    // days (their own hard cap), so nothing older than that is ever read —
    // prune with a margin past it rather than let history accumulate forever.
    await pool.query(`DELETE FROM "RevenueSnapshot" WHERE "capturedAt" < NOW() - INTERVAL '400 days'`);
    res.status(201).json({ snapshot: serializeSnapshot(r.rows[0] as SnapshotRow), channelsUsed: totals.channelsUsed });
  } catch (err: unknown) {
    capture(err, { route: "POST /snapshot" });
    console.error("[revenue] snapshot_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "snapshot_failed" });
  }
});

/**
 * GET /api/revenue/snapshots?limit=&sinceDays=
 * Time-series of snapshots, newest first, for the trend chart.
 */
revenueRouter.get("/snapshots", snapshotReadLimit, async (req, res) => {
  try {
    await ensureSnapshotTable();
    const limit = Math.min(365, Math.max(1, parseInt(String(req.query.limit ?? "90"), 10) || 90));
    const sinceDays = parseInt(String(req.query.sinceDays ?? ""), 10);
    const pool = getPool();
    const params: unknown[] = [];
    let where = "";
    if (Number.isFinite(sinceDays) && sinceDays > 0) {
      where = `WHERE "capturedAt" > NOW() - ($1 || ' days')::interval`;
      params.push(String(sinceDays));
    }
    params.push(limit);
    const r = await pool.query(
      `SELECT "id","capturedAt","grossUsd","netUsd","feesUsd","saleCount","refundedCount","byApp","byChannel","source","internalUsd","internalCount","grossIncludesInternal"
       FROM "RevenueSnapshot" ${where}
       ORDER BY "capturedAt" DESC LIMIT $${params.length}`,
      params,
    );
    res.json({ snapshots: (r.rows as SnapshotRow[]).map(serializeSnapshot), total: r.rowCount });
  } catch (err: unknown) {
    capture(err, { route: "GET /snapshots" });
    console.error("[revenue] snapshots_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "snapshots_list_failed" });
  }
});

/**
 * POST /api/revenue/snapshots/backfill-internal
 * Досчитывает internalUsd/internalCount для снимков, снятых до 27.07.2026 —
 * тогда свои проверочные покупки ещё сидели в grossUsd, и на графике это
 * выглядит как обрыв выручки в день правки.
 *
 * Заказы у провайдеров лежат с датами, поэтому «сколько своих денег было в
 * сумме на момент снимка» — это не догадка, а пересчёт: берутся внутренние
 * покупки, созданные ДО capturedAt.
 *
 * Трогает ТОЛЬКО строки, где internalUsd IS NULL, и только эти две колонки:
 * grossUsd остаётся как был, чтобы историю можно было сверить с тем, что
 * показывал дашборд в тот день.
 */
revenueRouter.post("/snapshots/backfill-internal", async (req, res) => {
  try {
    const guard = process.env.REVENUE_SNAPSHOT_TOKEN?.trim();
    if (guard && String(req.header("x-revenue-token") ?? "") !== guard) {
      return res.status(401).json({ error: "unauthorized" });
    }
    await ensureSnapshotTable();
    const pool = getPool();

    const [sales, orders] = await Promise.all([gumroadSales(), lsOrders()]);
    const internalDated: { at: number; usd: number }[] = [];
    const externalDated: { at: number; usd: number }[] = [];
    for (const sale of sales ?? []) {
      if (sale.refunded || sale.disputed || sale.chargedback) continue;
      const at = Date.parse(sale.created_at ?? "");
      if (Number.isNaN(at)) continue;
      const usd = sale.price ? sale.price / 100 : 0;
      (isInternalPurchase(sale.email) ? internalDated : externalDated).push({ at, usd });
    }
    for (const order of orders ?? []) {
      if (order.status !== "paid" || order.refunded) continue;
      const at = Date.parse(order.created_at ?? "");
      if (Number.isNaN(at)) continue;
      const usd = order.total / 100;
      (isInternalPurchase(order.email) ? internalDated : externalDated).push({ at, usd });
    }
    const sumUpTo = (rows: { at: number; usd: number }[], cutoff: number) =>
      round2(rows.filter((r) => r.at <= cutoff).reduce((sum, r) => sum + r.usd, 0));

    const pending = await pool.query(
      `SELECT "id","capturedAt","grossUsd" FROM "RevenueSnapshot"
        WHERE "internalUsd" IS NULL OR "grossIncludesInternal" IS NULL
        ORDER BY "capturedAt" ASC`,
    );
    let updated = 0;
    let assumedIncluded = 0;
    for (const row of pending.rows as { id: string; capturedAt: string; grossUsd: string }[]) {
      const cutoff = Date.parse(String(row.capturedAt));
      const before = internalDated.filter((p) => p.at <= cutoff);
      const internalUsd = round2(before.reduce((sum, p) => sum + p.usd, 0));
      const externalUsd = sumUpTo(externalDated, cutoff);
      const gross = Number(row.grossUsd);

      // Признак определяется ЗАМЕРОМ, а не датой: гросс снимка сверяется с двумя
      // суммами, посчитанными по заказам на тот момент. Совпал с внешней — свои
      // покупки в нём не сидят; совпал с внешней плюс своей — сидят. Дата тут
      // ненадёжна: правка выкатывалась между снимками, и граница по времени
      // промахнулась бы ровно на тот снимок, который и дал −$139.01.
      let includes: boolean;
      if (Math.abs(gross - externalUsd) < 0.011) includes = false;
      else if (Math.abs(gross - (externalUsd + internalUsd)) < 0.011) includes = true;
      else {
        includes = true; // не сошлось ни с чем — консервативно считаем завышенным
        assumedIncluded++;
      }

      await pool.query(
        `UPDATE "RevenueSnapshot"
            SET "internalUsd"=$2,"internalCount"=$3,"grossIncludesInternal"=$4
          WHERE "id"=$1`,
        [row.id, internalUsd, before.length, includes],
      );
      updated++;
    }
    res.json({
      updated,
      internalPurchasesFound: internalDated.length,
      // Сколько строк не сошлись ни с одной из сумм — если их много, значит
      // история снимков и заказы разошлись, и цифру надо смотреть руками.
      unmatchedAssumedIncluded: assumedIncluded,
      note: "grossUsd не изменён — досчитаны только internalUsd/internalCount/grossIncludesInternal",
    });
  } catch (err: unknown) {
    capture(err, { route: "POST /snapshots/backfill-internal" });
    console.error("[revenue] backfill_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "backfill_failed" });
  }
});

/**
 * GET /api/revenue/trend
 * Latest snapshot vs the oldest within the window → absolute + % growth.
 * Also returns the ascending series so the dashboard can draw a sparkline.
 */
revenueRouter.get("/trend", snapshotReadLimit, async (req, res) => {
  try {
    await ensureSnapshotTable();
    const windowDays = Math.min(365, Math.max(1, parseInt(String(req.query.windowDays ?? "30"), 10) || 30));
    const pool = getPool();
    const r = await pool.query(
      `SELECT "id","capturedAt","grossUsd","netUsd","feesUsd","saleCount","refundedCount","byApp","byChannel","source","internalUsd","internalCount","grossIncludesInternal"
       FROM "RevenueSnapshot"
       WHERE "capturedAt" > NOW() - ($1 || ' days')::interval
       ORDER BY "capturedAt" ASC`,
      [String(windowDays)],
    );
    const series = (r.rows as SnapshotRow[]).map(serializeSnapshot);
    if (series.length === 0) {
      return res.json({ windowDays, points: 0, series: [], message: "No snapshots yet — POST /api/revenue/snapshot to capture the first." });
    }
    const first = series[0];
    const last = series[series.length - 1];
    const growth = (a: number, b: number) => (a === 0 ? (b > 0 ? 100 : 0) : round2(((b - a) / a) * 100));
    res.json({
      windowDays,
      points: series.length,
      first: { capturedAt: first.capturedAt, netUsd: first.netUsd, grossUsd: first.grossUsd, saleCount: first.saleCount },
      latest: { capturedAt: last.capturedAt, netUsd: last.netUsd, grossUsd: last.grossUsd, saleCount: last.saleCount },
      change: {
        netUsd: round2(last.netUsd - first.netUsd),
        grossUsd: round2(last.grossUsd - first.grossUsd),
        saleCount: last.saleCount - first.saleCount,
        netGrowthPct: growth(first.netUsd, last.netUsd),
        saleGrowthPct: growth(first.saleCount, last.saleCount),
      },
      // includesInternal обязан доезжать до графика: без него дашборд не
      // отличит снимок, где свои покупки лежали в выручке, от снимка без них,
      // и ступенька 27.07.2026 прочитается как обвал выручки.
      series: series.map((s) => ({
        capturedAt: s.capturedAt,
        netUsd: s.netUsd,
        grossUsd: s.grossUsd,
        saleCount: s.saleCount,
        includesInternal: s.includesInternal,
        // Не только флаг, но и сама сумма: график вычитает её из точки, чтобы
        // рисовать деньги снаружи на всей истории, а не ставить подпись под
        // ступенькой. Флага для этого недостаточно.
        internalUsd: s.internalUsd,
      })),
    });
  } catch (err: unknown) {
    capture(err, { route: "GET /trend" });
    console.error("[revenue] trend_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "trend_failed" });
  }
});

/**
 * GET /api/revenue/env-guide
 */
revenueRouter.get("/env-guide", (_req, res) => {
  res.json({
    global: [
      { key: "GUMROAD_ACCESS_TOKEN", required: true, example: "gum_...", note: "ЖИВОЙ канал. Gumroad → Settings → Advanced → Applications → Generate access token. Нужен для /api/revenue/gumroad/*." },
      { key: "GUMROAD_APP_<PERMALINK>", required: false, example: "GUMROAD_APP_XPXZAM=cyberchess", note: "Атрибуция продаж пермалинка к appId в дашборде. Без него продажи идут в 'platform'." },
      { key: "Gumroad Ping URL", required: false, example: "https://<api-host>/api/revenue/gumroad/webhook", note: "Gumroad → Settings → Advanced → Ping. Сбрасывает 60-сек кэш дашборда при каждой продаже — данные обновляются мгновенно (не настраивается через ENV, ставится в дашборде Gumroad)." },
      { key: "PADDLE_API_KEY", required: false, example: "pdl_sdbx_...", note: "Paddle — KYC не пройдена, не используется. Оставлено для совместимости." },
      { key: "PADDLE_WEBHOOK_SECRET", required: false, example: "pdl_ntfset_...", note: "Paddle dashboard → Notifications → endpoint → signing secret" },
      { key: "PADDLE_SANDBOX", required: false, example: "true", note: "true = sandbox тестирование (по умолчанию). false = production." },
      { key: "YOUTUBE_API_KEY", required: false, example: "AIzaSy...", note: "Google Cloud Console → APIs → YouTube Data API v3 → API Key" },
      { key: "TWITCH_CLIENT_ID", required: false, example: "abc123...", note: "dev.twitch.tv/console → Register App → Client ID" },
      { key: "TWITCH_CLIENT_SECRET", required: false, example: "xyz789...", note: "dev.twitch.tv/console → Register App → New Secret" },
      { key: "PAYBOX_MERCHANT_ID", required: false, example: "123456", note: "paybox.money → Личный кабинет → Мерчанты → ID (для KZT)" },
      { key: "REVENUE_GOAL_PRIMARY_USD", required: false, example: "1000000", note: "Цель прогресс-бара на /revenue. По умолчанию 1000000 ($1M)." },
      { key: "REVENUE_GOAL_STRETCH_USD", required: false, example: "20000000", note: "Стретч-цель прогресс-бара на /revenue. По умолчанию 20000000 ($20M)." },
      { key: "REVENUE_GOAL_DEADLINE", required: false, example: "2027-01-01", note: "Дедлайн целей (ISO date) для обратного отсчёта на /revenue. По умолчанию 2027-01-01." },
    ],
    perApp: REVENUE_APPS
      .filter((a) => a.youtubeChannelEnvKey || a.twitchChannelEnvKey)
      .map((a) => ({
        appId: a.appId,
        appName: a.appName,
        vars: [
          ...(a.youtubeChannelEnvKey ? [{ key: a.youtubeChannelEnvKey, example: "UCxxxxxx", note: `YouTube Channel ID для ${a.appName}` }] : []),
          ...(a.twitchChannelEnvKey ? [{ key: a.twitchChannelEnvKey, example: "yourchannel", note: `Twitch логин для ${a.appName}` }] : []),
        ],
      })),
    // Атрибуция продаж Gumroad по модулям. Подставь <PERMALINK> = пермалинк
    // твоего Gumroad-продукта (последний сегмент его URL, заглавными,
    // не-буквенно-цифровые → "_"). value = appId, в который засчитать продажи.
    // Без этих переменных все продажи валятся в "platform".
    gumroadAttribution: {
      note: "На Railway задай по одной переменной на продукт: GUMROAD_APP_<PERMALINK>=<appId>. <PERMALINK> бери из URL продукта Gumroad.",
      example: "GUMROAD_APP_XPXZAM=cyberchess",
      apps: REVENUE_APPS.map((a) => ({
        appId: a.appId,
        appName: a.appName,
        envKeyPattern: `GUMROAD_APP_<PERMALINK>=${a.appId}`,
      })),
    },
    lemonsqueezyAttribution: {
      note: "Уже читает существующие LEMON_SQUEEZY_VARIANT_<NAME> переменные (те же, что использует checkout) в обратную сторону — variant_id продажи → appId. Ручной оверрайд: LEMON_SQUEEZY_APP_<VARIANT_ID>=<appId>. Тарифные варианты (LITE/MEDIUM/FULL/DEFAULT) намеренно не маппятся — это бандл всей платформы, не одно приложение, остаются в 'platform'.",
      example: "LEMON_SQUEEZY_APP_1902349=devhub",
      mappedVariants: Object.keys(LS_VARIANT_APP_ENV_SUFFIXES).map((suffix) => ({
        envKey: `LEMON_SQUEEZY_VARIANT_${suffix}`,
        appId: LS_VARIANT_APP_ENV_SUFFIXES[suffix],
      })),
    },
  });
});

import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { timingSafeEqual } from "crypto";

export const eventsRouter = Router();

/**
 * Admin token gate — fail-CLOSED in production when ADMIN_TOKEN env is unset
 * (was: silently public — analytics readable by anyone). Timing-safe equality
 * stops length-extension probing.
 *
 * Returns true if access should be denied.
 */
function adminGateBlocks(req: import("express").Request): boolean {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    // No token configured: deny in prod (fail-closed), allow in dev/test.
    return process.env.NODE_ENV === "production";
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim() ?? "";
  if (got.length !== required.length) return true;
  try {
    return !timingSafeEqual(Buffer.from(got), Buffer.from(required));
  } catch {
    return true;
  }
}

/**
 * GTM analytics events — простой ingest без внешних трекеров.
 * Хранение: JSONL append-only в data/events.jsonl
 *
 * Без cookies / fingerprinting — клиент шлёт `sid` (session id из sessionStorage),
 * чтобы можно было сгруппировать действия одной сессии. Никаких PII не пишем.
 */

const EVENTS_FILE = process.env.EVENTS_FILE
  ? process.env.EVENTS_FILE
  : join(process.cwd(), "data", "events.jsonl");

function ensureDir() {
  const dir = dirname(EVENTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

interface AnalyticsEvent {
  ts: string;
  type: string;
  sid?: string;
  path?: string;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null>;
  ip?: string;
  ua?: string;
}

const ALLOWED_TYPES = new Set([
  "page_view",
  "cta_click",
  "calculator_open",
  "calculator_quote",
  "checkout_start",
  "checkout_success",
  "checkout_cancel",
  "lead_submit",
  "tier_view",
  "industry_view",
  "faq_open",
  "comparison_view",
  "affiliate_apply",
  "partner_apply",
  "edu_apply",
  "ab_assigned",
]);

function rateLimitKey(ip: string) {
  return `ev:${ip}`;
}
const RATE = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 60;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(rateLimitKey(ip));
  if (!cur || cur.reset < now) {
    RATE.set(rateLimitKey(ip), { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  if (cur.count >= MAX_PER_MIN) return true;
  cur.count += 1;
  return false;
}

/**
 * POST /api/pricing/events
 * Body: { type, sid?, path?, source?, tier?, industry?, value?, meta? }
 *
 * Принимает один event. Для batch — клиент шлёт несколько запросов
 * (или sendBeacon). Дёшево, надёжно, без потери при unload.
 */
eventsRouter.post("/", (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const body = req.body ?? {};
  const type = typeof body.type === "string" ? body.type.trim() : "";

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "invalid_type", type });
  }

  const event: AnalyticsEvent = {
    ts: new Date().toISOString(),
    type,
    sid: typeof body.sid === "string" ? body.sid.slice(0, 60) : undefined,
    path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined,
    source: typeof body.source === "string" ? body.source.slice(0, 60) : undefined,
    tier: typeof body.tier === "string" ? body.tier.slice(0, 30) : undefined,
    industry: typeof body.industry === "string" ? body.industry.slice(0, 60) : undefined,
    value: Number.isFinite(body.value) ? body.value : undefined,
    meta:
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? Object.fromEntries(
            Object.entries(body.meta as Record<string, unknown>)
              .slice(0, 20)
              .filter(([k, v]) =>
                typeof k === "string" &&
                k.length < 40 &&
                (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null),
              )
              .map(([k, v]) => [
                k,
                typeof v === "string" ? v.slice(0, 200) : (v as string | number | boolean | null),
              ]),
          )
        : undefined,
    ip,
    ua: typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : undefined,
  };

  try {
    ensureDir();
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
  } catch (e) {
    console.error("[events] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(204).end();
});

/**
 * Извлекает CSV-фильтр из query: `?source=qmedia,qsocial` → Set{qmedia,qsocial}.
 * Пустой → null (без фильтра).
 */
function csvFilter(raw: unknown): Set<string> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60)
    .slice(0, 20);
  return items.length > 0 ? new Set(items) : null;
}

/**
 * GET /api/pricing/events/summary
 * Суммарные метрики по последним N событиям.
 * Защищён ADMIN_TOKEN (header X-Admin-Token).
 *
 * Фильтры (опциональные, CSV):
 *   - source=qmedia,qsocial   — только из этих источников
 *   - type=cta_click,lead_submit — только этих типов
 *   - tier=pro,enterprise     — только этих тиров
 *   - industry=retail,saas    — только этих индустрий
 *   - sid=...                 — только эта сессия
 */
eventsRouter.get("/summary", (req, res) => {
  if (adminGateBlocks(req)) return res.status(401).json({ error: "unauthorized" });

  const sourceF = csvFilter(req.query.source);
  const typeF = csvFilter(req.query.type);
  const tierF = csvFilter(req.query.tier);
  const industryF = csvFilter(req.query.industry);
  const sidF = csvFilter(req.query.sid);

  if (!existsSync(EVENTS_FILE)) {
    return res.json({
      total: 0,
      byType: {},
      bySource: {},
      byTier: {},
      byIndustry: {},
      sessionCount: 0,
      windowHours: 24,
      filters: {
        source: sourceF ? Array.from(sourceF) : null,
        type: typeF ? Array.from(typeF) : null,
        tier: tierF ? Array.from(tierF) : null,
        industry: industryF ? Array.from(industryF) : null,
        sid: sidF ? Array.from(sidF) : null,
      },
    });
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "5000"), 10), 100), 50000);
  const sinceHours = Math.min(Math.max(parseInt(String(req.query.hours ?? "24"), 10), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/summary] read failed", e);
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  // Берём последние `limit` строк (мы append-only, так что хвост = свежие)
  const tail = lines.slice(-limit);

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const sids = new Set<string>();
  let total = 0;

  for (const line of tail) {
    try {
      const ev = JSON.parse(line) as AnalyticsEvent;
      if (ev.ts && new Date(ev.ts).getTime() < sinceMs) continue;
      if (sourceF && (!ev.source || !sourceF.has(ev.source))) continue;
      if (typeF && !typeF.has(ev.type)) continue;
      if (tierF && (!ev.tier || !tierF.has(ev.tier))) continue;
      if (industryF && (!ev.industry || !industryF.has(ev.industry))) continue;
      if (sidF && (!ev.sid || !sidF.has(ev.sid))) continue;
      total += 1;
      byType[ev.type] = (byType[ev.type] ?? 0) + 1;
      if (ev.source) bySource[ev.source] = (bySource[ev.source] ?? 0) + 1;
      if (ev.tier) byTier[ev.tier] = (byTier[ev.tier] ?? 0) + 1;
      if (ev.industry) byIndustry[ev.industry] = (byIndustry[ev.industry] ?? 0) + 1;
      if (ev.sid) sids.add(ev.sid);
    } catch {
      // skip malformed line
    }
  }

  res.json({
    total,
    byType,
    bySource,
    byTier,
    byIndustry,
    sessionCount: sids.size,
    windowHours: sinceHours,
    filters: {
      source: sourceF ? Array.from(sourceF) : null,
      type: typeF ? Array.from(typeF) : null,
      tier: tierF ? Array.from(tierF) : null,
      industry: industryF ? Array.from(industryF) : null,
      sid: sidF ? Array.from(sidF) : null,
    },
  });
});

/**
 * GET /api/pricing/events/recent
 * Последние N событий целиком. Защищён ADMIN_TOKEN.
 *
 * Те же CSV-фильтры что у /summary: source, type, tier, industry, sid.
 * Фильтрация применяется ДО среза по limit (поэтому при `source=X&limit=50`
 * получаем 50 последних X-событий, не 50 последних всех и отсев).
 */
eventsRouter.get("/recent", (req, res) => {
  if (adminGateBlocks(req)) return res.status(401).json({ error: "unauthorized" });

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ items: [], total: 0, matched: 0 });
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 1000);
  const sourceF = csvFilter(req.query.source);
  const typeF = csvFilter(req.query.type);
  const tierF = csvFilter(req.query.tier);
  const industryF = csvFilter(req.query.industry);
  const sidF = csvFilter(req.query.sid);
  const hasFilter = !!(sourceF || typeF || tierF || industryF || sidF);

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/recent] read failed", e);
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  // Идём с хвоста, набирая нужные. На больших файлах с узким фильтром
  // ограничим скан 50 000 строк (приоритет latency над глубиной поиска).
  const SCAN_CAP = 50_000;
  const start = Math.max(0, lines.length - SCAN_CAP);
  const items: AnalyticsEvent[] = [];
  let matched = 0;

  for (let i = lines.length - 1; i >= start && items.length < limit; i--) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(lines[i]) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (sourceF && (!ev.source || !sourceF.has(ev.source))) continue;
    if (typeF && !typeF.has(ev.type)) continue;
    if (tierF && (!ev.tier || !tierF.has(ev.tier))) continue;
    if (industryF && (!ev.industry || !industryF.has(ev.industry))) continue;
    if (sidF && (!ev.sid || !sidF.has(ev.sid))) continue;
    items.push(ev);
    matched += 1;
  }

  res.json({
    items,
    total: lines.length,
    matched: hasFilter ? matched : items.length,
    filtered: hasFilter,
    scanCap: SCAN_CAP,
  });
});

/**
 * GET /api/pricing/events/aggregate
 * Time-bucketed counts событий по источникам/типам — для charts и dashboards.
 * Защищён ADMIN_TOKEN.
 *
 * Параметры:
 *   - period=hour|day  (default hour)
 *   - hours (1..720, default 24) — окно
 *   - groupBy=source|type|tier|industry  (default source)
 *   - source/type/tier/industry/sid — CSV-фильтры (как в /summary, /recent)
 *
 * Ответ:
 *   {
 *     period: "hour",
 *     groupBy: "source",
 *     buckets: [
 *       { t: "2026-05-13T18:00:00.000Z", total: 42, groups: { qmedia: 30, qsocial: 12 } },
 *       ...
 *     ],
 *     groups: ["qmedia","qsocial",...],   // отсортированы по убыванию total
 *     totals: { qmedia: 124, qsocial: 88 } // сумма по всему окну
 *   }
 */
eventsRouter.get("/aggregate", (req, res) => {
  if (adminGateBlocks(req)) return res.status(401).json({ error: "unauthorized" });

  const period = req.query.period === "day" ? "day" : "hour";
  const bucketMs = period === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const sinceHours = Math.min(Math.max(parseInt(String(req.query.hours ?? "24"), 10), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  const allowedGroupBy = new Set(["source", "type", "tier", "industry"]);
  const groupByRaw = typeof req.query.groupBy === "string" ? req.query.groupBy : "source";
  const groupBy = (allowedGroupBy.has(groupByRaw) ? groupByRaw : "source") as
    | "source" | "type" | "tier" | "industry";

  const sourceF = csvFilter(req.query.source);
  const typeF = csvFilter(req.query.type);
  const tierF = csvFilter(req.query.tier);
  const industryF = csvFilter(req.query.industry);
  const sidF = csvFilter(req.query.sid);

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ period, groupBy, buckets: [], groups: [], totals: {}, windowHours: sinceHours });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/aggregate] read failed", e);
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  // Bucket key: ISO start-of-bucket, value: {total, groups}.
  const buckets = new Map<number, { total: number; groups: Record<string, number> }>();
  const totals: Record<string, number> = {};

  function bucketStart(ts: number): number {
    if (period === "day") {
      // Округление до начала UTC-дня
      const d = new Date(ts);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    }
    // Час — просто floor
    return Math.floor(ts / bucketMs) * bucketMs;
  }

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts) continue;
    const t = new Date(ev.ts).getTime();
    if (!Number.isFinite(t) || t < sinceMs) continue;
    if (sourceF && (!ev.source || !sourceF.has(ev.source))) continue;
    if (typeF && !typeF.has(ev.type)) continue;
    if (tierF && (!ev.tier || !tierF.has(ev.tier))) continue;
    if (industryF && (!ev.industry || !industryF.has(ev.industry))) continue;
    if (sidF && (!ev.sid || !sidF.has(ev.sid))) continue;

    const groupVal: string | undefined =
      groupBy === "source" ? ev.source :
      groupBy === "type"   ? ev.type   :
      groupBy === "tier"   ? ev.tier   :
                             ev.industry;
    const key = groupVal && groupVal.length > 0 ? groupVal : "(none)";

    const bs = bucketStart(t);
    let b = buckets.get(bs);
    if (!b) {
      b = { total: 0, groups: {} };
      buckets.set(bs, b);
    }
    b.total += 1;
    b.groups[key] = (b.groups[key] ?? 0) + 1;
    totals[key] = (totals[key] ?? 0) + 1;
  }

  // Сортируем buckets по времени, groups — по total desc.
  const sortedBucketTimes = Array.from(buckets.keys()).sort((a, b) => a - b);
  const groups = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);

  res.json({
    period,
    groupBy,
    windowHours: sinceHours,
    buckets: sortedBucketTimes.map((t) => ({
      t: new Date(t).toISOString(),
      total: buckets.get(t)!.total,
      groups: buckets.get(t)!.groups,
    })),
    groups,
    totals,
    filters: {
      source: sourceF ? Array.from(sourceF) : null,
      type: typeF ? Array.from(typeF) : null,
      tier: tierF ? Array.from(tierF) : null,
      industry: industryF ? Array.from(industryF) : null,
      sid: sidF ? Array.from(sidF) : null,
    },
  });
});

/**
 * GET /api/pricing/events/by-variant
 * Конверсии в разрезе A/B-вариантов. Защищён ADMIN_TOKEN.
 *
 * Группирует события по `meta.variant_<key>` и считает воронку:
 * page_view → cta_click → lead_submit / checkout_start → checkout_success.
 *
 * Параметры:
 *   - hours (1..720, default 168) — окно
 *   - keys (csv, default "hero,tierCards") — какие variant-ключи группировать
 */
eventsRouter.get("/by-variant", (req, res) => {
  if (adminGateBlocks(req)) return res.status(401).json({ error: "unauthorized" });

  const sinceHours = Math.min(Math.max(parseInt(String(req.query.hours ?? "168"), 10), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const keys = (typeof req.query.keys === "string" ? req.query.keys : "hero,tierCards")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);

  const FUNNEL_TYPES = [
    "page_view",
    "cta_click",
    "lead_submit",
    "checkout_start",
    "checkout_success",
  ] as const;

  type FunnelCounts = Record<typeof FUNNEL_TYPES[number], number>;

  function emptyCounts(): FunnelCounts {
    return {
      page_view: 0,
      cta_click: 0,
      lead_submit: 0,
      checkout_start: 0,
      checkout_success: 0,
    };
  }

  const result: Record<string, Record<string, FunnelCounts>> = {};
  for (const k of keys) result[k] = {};

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ keys, windowHours: sinceHours, variants: result });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/by-variant] read failed", e);
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts || new Date(ev.ts).getTime() < sinceMs) continue;
    if (!FUNNEL_TYPES.includes(ev.type as typeof FUNNEL_TYPES[number])) continue;
    if (!ev.meta || typeof ev.meta !== "object") continue;

    for (const k of keys) {
      const v = ev.meta[`variant_${k}`];
      if (typeof v !== "string" || v.length === 0) continue;
      if (!result[k][v]) result[k][v] = emptyCounts();
      result[k][v][ev.type as typeof FUNNEL_TYPES[number]] += 1;
    }
  }

  res.json({ keys, windowHours: sinceHours, variants: result });
});

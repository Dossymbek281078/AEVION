import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";

export const eventsRouter = Router();

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
 * GET /api/pricing/events/summary
 * Суммарные метрики по последним N событиям.
 * Защищён ADMIN_TOKEN (header X-Admin-Token).
 */
eventsRouter.get("/summary", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({
      total: 0,
      byType: {},
      bySource: {},
      byTier: {},
      byIndustry: {},
      sessionCount: 0,
      windowHours: 24,
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
  });
});

/**
 * GET /api/pricing/events/recent
 * Последние N событий целиком. Защищён ADMIN_TOKEN.
 */
eventsRouter.get("/recent", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ items: [], total: 0 });
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 1000);

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/recent] read failed", e);
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const tail = lines.slice(-limit).reverse();
  const items: AnalyticsEvent[] = [];
  for (const line of tail) {
    try {
      items.push(JSON.parse(line) as AnalyticsEvent);
    } catch {
      // skip
    }
  }
  res.json({ items, total: lines.length });
});

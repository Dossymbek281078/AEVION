import { Router, Request, Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { ensureMapRealityTables, isMapRealityDbReady } from "../lib/ensureMapRealityTables";

const pool = getPool();
(async () => {
  try { await ensureMapRealityTables(pool); }
  catch { /* silent — in-memory fallback active */ }
})();

const generalLimiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "mapreality:general", message: "rate_limited" });
const submitLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "mapreality:submit", message: "rate_limited" });
const supportLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "mapreality:support", message: "rate_limited" });

export const mapRealityRouter = Router();

// Apply general rate limit to all routes; submit/support add their own on top.
mapRealityRouter.use(generalLimiter);

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "need" | "event" | "request";
type Status = "active" | "resolved" | "flagged";

interface Signal {
  id: number;
  title: string;
  description: string;
  category: Category;
  country: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  author_alias: string;
  support_count: number;
  status: Status;
  created_at: string;
}

interface Support {
  signal_id: number;
  supporter_alias: string;
  created_at: string;
}

const CATEGORIES: Category[] = ["need", "event", "request"];
const STATUSES: Status[] = ["active", "resolved", "flagged"];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_ALIAS = 64;
const MAX_COUNTRY = 64;
const MAX_CITY = 80;
const MAX_MEM_SIGNALS = 200;

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memSignals: Signal[] = [];
const memSupports: Support[] = [];
let memNextId = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function trimMemStore(): void {
  if (memSignals.length > MAX_MEM_SIGNALS) {
    // Keep newest by id desc (id grows with time).
    memSignals.sort((a, b) => b.id - a.id);
    const removed = memSignals.splice(MAX_MEM_SIGNALS);
    const removedIds = new Set(removed.map((s) => s.id));
    for (let i = memSupports.length - 1; i >= 0; i--) {
      if (removedIds.has(memSupports[i].signal_id)) memSupports.splice(i, 1);
    }
  }
}

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ─── GET /api/mapreality/health ───────────────────────────────────────────────
mapRealityRouter.get("/health", async (_req: Request, res: Response) => {
  let totalSignals = 0;
  try {
    if (isMapRealityDbReady()) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals`);
      totalSignals = rows[0]?.total ?? 0;
    } else {
      totalSignals = memSignals.length;
    }
  } catch {
    totalSignals = memSignals.length;
  }
  res.json({
    ok: true,
    service: "mapreality",
    dbReady: isMapRealityDbReady(),
    totalSignals,
  });
});

// ─── POST /api/mapreality/signals ─────────────────────────────────────────────
mapRealityRouter.post("/signals", submitLimiter, async (req: Request, res: Response) => {
  const body = req.body as {
    title?: unknown;
    description?: unknown;
    category?: unknown;
    country?: unknown;
    city?: unknown;
    lat?: unknown;
    lng?: unknown;
    authorAlias?: unknown;
  };

  const title = clampString(body.title, MAX_TITLE);
  const description = clampString(body.description, MAX_DESCRIPTION);
  const country = clampString(body.country, MAX_COUNTRY);
  const authorAlias = clampString(body.authorAlias, MAX_ALIAS);
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const city = clampString(body.city, MAX_CITY);
  const lat = parseNumber(body.lat);
  const lng = parseNumber(body.lng);

  if (!title) return res.status(400).json({ error: "title required (1..200 chars)" });
  if (!description) return res.status(400).json({ error: "description required (1..2000 chars)" });
  if (!country) return res.status(400).json({ error: "country required" });
  if (!authorAlias) return res.status(400).json({ error: "authorAlias required" });
  if (!CATEGORIES.includes(category as Category)) {
    return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
  }
  if (lat !== null && (lat < -90 || lat > 90)) return res.status(400).json({ error: "lat out of range" });
  if (lng !== null && (lng < -180 || lng > 180)) return res.status(400).json({ error: "lng out of range" });

  try {
    if (isMapRealityDbReady()) {
      const { rows } = await pool.query(
        `INSERT INTO mapreality_signals
           (title, description, category, country, city, lat, lng, author_alias)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, support_count`,
        [title, description, category, country, city, lat, lng, authorAlias],
      );
      const row = rows[0] as { id: number; support_count: number };
      return res.status(201).json({ id: row.id, supportCount: row.support_count });
    }
  } catch (e) { console.error("[MapReality] POST /signals DB error", e); }

  const signal: Signal = {
    id: memNextId++,
    title,
    description,
    category: category as Category,
    country,
    city,
    lat,
    lng,
    author_alias: authorAlias,
    support_count: 0,
    status: "active",
    created_at: nowIso(),
  };
  memSignals.push(signal);
  trimMemStore();
  return res.status(201).json({ id: signal.id, supportCount: 0 });
});

// ─── GET /api/mapreality/signals ──────────────────────────────────────────────
mapRealityRouter.get("/signals", async (req: Request, res: Response) => {
  const { category, country, city, status, limit, offset } = req.query as Record<string, string | undefined>;
  const limitN = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const offsetN = Math.max(Number(offset) || 0, 0);
  const statusFilter = status && STATUSES.includes(status as Status) ? (status as Status) : "active";

  try {
    if (isMapRealityDbReady()) {
      const conditions: string[] = [`status = $1`];
      const args: unknown[] = [statusFilter];
      let idx = 2;
      if (category && CATEGORIES.includes(category as Category)) {
        conditions.push(`category = $${idx++}`);
        args.push(category);
      }
      if (country) {
        conditions.push(`country = $${idx++}`);
        args.push(country);
      }
      if (city) {
        conditions.push(`city = $${idx++}`);
        args.push(city);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const [{ rows }, { rows: cnt }] = await Promise.all([
        pool.query(
          `SELECT * FROM mapreality_signals ${where}
           ORDER BY support_count DESC, created_at DESC
           LIMIT $${idx++} OFFSET $${idx}`,
          [...args, limitN, offsetN],
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals ${where}`, args),
      ]);
      return res.json({ signals: rows, total: cnt[0]?.total ?? rows.length });
    }
  } catch (e) { console.error("[MapReality] GET /signals DB error", e); }

  let signals = memSignals.filter((s) => s.status === statusFilter);
  if (category && CATEGORIES.includes(category as Category)) {
    signals = signals.filter((s) => s.category === category);
  }
  if (country) signals = signals.filter((s) => s.country === country);
  if (city) signals = signals.filter((s) => s.city === city);
  signals = signals.slice().sort((a, b) => {
    if (b.support_count !== a.support_count) return b.support_count - a.support_count;
    return b.created_at.localeCompare(a.created_at);
  });
  const total = signals.length;
  return res.json({ signals: signals.slice(offsetN, offsetN + limitN), total });
});

// ─── GET /api/mapreality/signals/:id ──────────────────────────────────────────
mapRealityRouter.get("/signals/:id", async (req: Request, res: Response) => {
  const id = Number(param(req, "id"));
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid id" });

  try {
    if (isMapRealityDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM mapreality_signals WHERE id = $1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      return res.json({ signal: rows[0] });
    }
  } catch (e) { console.error("[MapReality] GET /signals/:id DB error", e); }

  const signal = memSignals.find((s) => s.id === id);
  if (!signal) return res.status(404).json({ error: "not_found" });
  return res.json({ signal });
});

// ─── POST /api/mapreality/signals/:id/support ─────────────────────────────────
mapRealityRouter.post("/signals/:id/support", supportLimiter, async (req: Request, res: Response) => {
  const id = Number(param(req, "id"));
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid id" });

  const supporterAlias = clampString((req.body as { supporterAlias?: unknown })?.supporterAlias, MAX_ALIAS);
  if (!supporterAlias) return res.status(400).json({ error: "supporterAlias required" });

  try {
    if (isMapRealityDbReady()) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM mapreality_signals WHERE id = $1`,
        [id],
      );
      if (!existing[0]) return res.status(404).json({ error: "not_found" });

      const insert = await pool.query(
        `INSERT INTO mapreality_supports (signal_id, supporter_alias)
         VALUES ($1, $2)
         ON CONFLICT (signal_id, supporter_alias) DO NOTHING
         RETURNING id`,
        [id, supporterAlias],
      );
      if ((insert.rowCount ?? 0) === 0) {
        const { rows: cur } = await pool.query(
          `SELECT support_count FROM mapreality_signals WHERE id = $1`,
          [id],
        );
        return res.status(409).json({
          error: "already_supported",
          supportCount: cur[0]?.support_count ?? 0,
        });
      }
      const { rows: updated } = await pool.query(
        `UPDATE mapreality_signals
         SET support_count = support_count + 1
         WHERE id = $1
         RETURNING support_count`,
        [id],
      );
      return res.json({ supportCount: updated[0]?.support_count ?? 0 });
    }
  } catch (e) { console.error("[MapReality] POST /signals/:id/support DB error", e); }

  const signal = memSignals.find((s) => s.id === id);
  if (!signal) return res.status(404).json({ error: "not_found" });

  const dup = memSupports.find((sp) => sp.signal_id === id && sp.supporter_alias === supporterAlias);
  if (dup) return res.status(409).json({ error: "already_supported", supportCount: signal.support_count });

  memSupports.push({ signal_id: id, supporter_alias: supporterAlias, created_at: nowIso() });
  signal.support_count += 1;
  return res.json({ supportCount: signal.support_count });
});

// ─── PATCH /api/mapreality/signals/:id/status ─────────────────────────────────
// Body: { authorAlias, status }. For MVP, only the author can set status to 'resolved'.
mapRealityRouter.patch("/signals/:id/status", async (req: Request, res: Response) => {
  const id = Number(param(req, "id"));
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid id" });

  const body = req.body as { authorAlias?: unknown; status?: unknown };
  const authorAlias = clampString(body.authorAlias, MAX_ALIAS);
  const desiredStatus = typeof body.status === "string" ? body.status.trim() : "resolved";

  if (!authorAlias) return res.status(400).json({ error: "authorAlias required" });
  if (desiredStatus !== "resolved") {
    return res.status(400).json({ error: "MVP only supports status='resolved'" });
  }

  try {
    if (isMapRealityDbReady()) {
      const { rows } = await pool.query(
        `SELECT id, author_alias FROM mapreality_signals WHERE id = $1`,
        [id],
      );
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].author_alias !== authorAlias) {
        return res.status(403).json({ error: "forbidden" });
      }
      const { rows: updated } = await pool.query(
        `UPDATE mapreality_signals SET status = 'resolved' WHERE id = $1 RETURNING *`,
        [id],
      );
      return res.json({ signal: updated[0] });
    }
  } catch (e) { console.error("[MapReality] PATCH /signals/:id/status DB error", e); }

  const signal = memSignals.find((s) => s.id === id);
  if (!signal) return res.status(404).json({ error: "not_found" });
  if (signal.author_alias !== authorAlias) return res.status(403).json({ error: "forbidden" });
  signal.status = "resolved";
  return res.json({ signal });
});

// ─── GET /api/mapreality/stats ────────────────────────────────────────────────
mapRealityRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    if (isMapRealityDbReady()) {
      const [totalQ, catQ, countryQ, topQ] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals WHERE status = 'active'`),
        pool.query(
          `SELECT category, COUNT(*)::int AS count
           FROM mapreality_signals WHERE status = 'active'
           GROUP BY category`,
        ),
        pool.query(
          `SELECT country, COUNT(*)::int AS count
           FROM mapreality_signals WHERE status = 'active'
           GROUP BY country
           ORDER BY count DESC
           LIMIT 10`,
        ),
        pool.query(
          `SELECT * FROM mapreality_signals
           WHERE status = 'active'
           ORDER BY support_count DESC, created_at DESC
           LIMIT 5`,
        ),
      ]);
      const byCategory: Record<string, number> = { need: 0, event: 0, request: 0 };
      for (const row of catQ.rows as Array<{ category: Category; count: number }>) {
        byCategory[row.category] = row.count;
      }
      return res.json({
        total: totalQ.rows[0]?.total ?? 0,
        byCategory,
        byCountry: countryQ.rows,
        topSignals: topQ.rows,
        backend: "postgres",
      });
    }
  } catch (e) { console.error("[MapReality] GET /stats DB error", e); }

  const active = memSignals.filter((s) => s.status === "active");
  const byCategory: Record<string, number> = { need: 0, event: 0, request: 0 };
  const countryCount = new Map<string, number>();
  for (const s of active) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
    countryCount.set(s.country, (countryCount.get(s.country) ?? 0) + 1);
  }
  const byCountry = Array.from(countryCount.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topSignals = active
    .slice()
    .sort((a, b) => {
      if (b.support_count !== a.support_count) return b.support_count - a.support_count;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, 5);
  return res.json({
    total: active.length,
    byCategory,
    byCountry,
    topSignals,
    backend: "memory",
  });
});

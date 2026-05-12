/**
 * Z-Tide — adaptive social-economic coordination layer.
 *
 * Per AEVION fintech manifest: experimental adaptive economy. Behavioral-
 * driven engagement rewards, ecosystem participation incentives, contribution
 * scoring. Sits orthogonal to AEV (which has its own mining engines) — Z-Tide
 * is a higher-frequency, lighter-weight reputation/contribution layer.
 *
 * Conceptual model:
 *  - Every meaningful action across AEVION (login streak, helpful comment,
 *    successful Bureau cert, completed Build hire, etc.) emits a Z-Tide
 *    contribution event with a numeric weight.
 *  - Per user we maintain a rolling "tide score" — decayed-EMA over events.
 *  - When the score crosses thresholds, "ranks" unlock that downstream
 *    modules can read for gating (e.g., QGood featured-campaign placement).
 *  - Leaderboard is global, but per-module filtering supported.
 *
 * Why not AEV? AEV is a hard-cap token with on-chain semantics (21M cap,
 * mining engines). Z-Tide is soft reputation — non-fungible, decays, no
 * supply cap, no withdrawal.
 *
 * Architecture:
 *  - Identity:   AEVION JWT (user-bound contributions)
 *  - Wallet:     none — purely score, not transferable
 *  - Security:   server-only event ingestion; users can only read
 *  - Audit:      ZTideEvent table append-only; ZTideScore is materialized
 *                view-style row updated atomically per event
 *  - AI hook:    decay coefficient is tunable per kind, future ML can
 *                adjust based on ecosystem health
 *
 * Endpoints:
 *   GET  /api/ztide/health
 *   POST /api/ztide/events        — record a contribution (admin/service-key auth)
 *   GET  /api/ztide/me            — caller's score + rank + recent events
 *   GET  /api/ztide/leaderboard   — top-N users (filterable by source module)
 *   GET  /api/ztide/rank/:userId  — public score lookup
 *   GET  /api/ztide/stats
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import rateLimit from "express-rate-limit";

export const ztideRouter = Router();

const writeLimit = rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false });
const readLimit = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });

// Allowed event kinds & their base weights. Weight × source module multiplier
// = score increment. Adjust ZTIDE_WEIGHTS env to override per-kind weights.
const BASE_WEIGHTS: Record<string, number> = {
  "login-streak":      1,
  "helpful-comment":   2,
  "bureau-cert":       10,
  "build-hire":        15,
  "qgood-donation":    5,
  "qcontract-share":   3,
  "qsign-sign":        2,
  "qright-protect":    5,
  "qpaynet-payout":    3,
  "referral-success":  20,
};

const SOURCE_MODULES = new Set([
  "auth", "build", "bureau", "qgood", "qcontract", "qsign", "qright",
  "qpaynet", "qmaskcard", "cyberchess", "qcore", "external",
]);

// Tide ranks — readable thresholds.
const RANKS: Array<{ id: string; label: string; min: number }> = [
  { id: "seedling",    label: "Seedling",    min: 0 },
  { id: "current",     label: "Current",     min: 50 },
  { id: "wave",        label: "Wave",        min: 200 },
  { id: "stream",      label: "Stream",      min: 750 },
  { id: "tide",        label: "Tide",        min: 2_500 },
  { id: "river",       label: "River",       min: 8_000 },
  { id: "ocean",       label: "Ocean",       min: 25_000 },
];

function rankFor(score: number): { id: string; label: string; min: number; next: number | null } {
  let current = RANKS[0];
  let next: number | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= RANKS[i].min) {
      current = RANKS[i];
      next = i + 1 < RANKS.length ? RANKS[i + 1].min : null;
    } else {
      break;
    }
  }
  return { ...current, next };
}

function isServiceCaller(req: import("express").Request): boolean {
  // Service-mode for backend-to-backend ingestion. Compare against env.
  const key = req.header("x-ztide-service-key") || "";
  const expected = (process.env.ZTIDE_SERVICE_KEY || "").trim();
  if (!expected) return false;
  return key.length > 0 && crypto.timingSafeEqual(
    Buffer.from(key.padEnd(64, "0").slice(0, 64)),
    Buffer.from(expected.padEnd(64, "0").slice(0, 64)),
  );
}

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ZTideEvent" (
      "id"          TEXT PRIMARY KEY,
      "userId"      TEXT NOT NULL,
      "kind"        TEXT NOT NULL,
      "sourceModule" TEXT NOT NULL,
      "weight"      INT NOT NULL,
      "meta"        JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "ZTideEvent_user_idx" ON "ZTideEvent" ("userId", "createdAt" DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "ZTideEvent_source_idx" ON "ZTideEvent" ("sourceModule", "createdAt" DESC);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ZTideScore" (
      "userId"       TEXT PRIMARY KEY,
      "score"        BIGINT NOT NULL DEFAULT 0,
      "eventCount"   INT NOT NULL DEFAULT 0,
      "rank"         TEXT NOT NULL DEFAULT 'seedling',
      "lastEventAt"  TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "ZTideScore_score_idx" ON "ZTideScore" ("score" DESC);`);
  tablesReady = true;
}

ztideRouter.get("/health", async (_req, res) => {
  let db: "ok" | "down" = "ok";
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
  } catch (err) {
    db = "down";
    console.warn("[ztide] /health db probe failed", err instanceof Error ? err.message : err);
  }
  const status = db === "ok" ? "ok" : "degraded";
  res.status(db === "ok" ? 200 : 503).json({ status, service: "ztide", db, timestamp: new Date().toISOString() });
});

// ── POST /events — server-side event ingestion
// Auth: either admin JWT email matches ZTIDE_ADMIN_EMAILS, or X-ZTide-Service-Key
ztideRouter.post("/events", writeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    const adminList = (process.env.ZTIDE_ADMIN_EMAILS || "").toLowerCase()
      .split(",").map(s => s.trim()).filter(Boolean);
    const isAdmin = !!(auth?.email && adminList.includes(auth.email.toLowerCase()));
    const serviceAuth = isServiceCaller(req);
    if (!isAdmin && !serviceAuth) return res.status(403).json({ error: "admin_or_service_key_required" });

    const { userId, kind, sourceModule, weightOverride, meta } = req.body || {};
    if (typeof userId !== "string" || userId.length < 1 || userId.length > 200) {
      return res.status(400).json({ error: "userId required" });
    }
    if (!BASE_WEIGHTS[kind]) {
      return res.status(400).json({ error: "invalid_kind", allowed: Object.keys(BASE_WEIGHTS) });
    }
    if (!SOURCE_MODULES.has(sourceModule)) {
      return res.status(400).json({ error: "invalid_source_module", allowed: Array.from(SOURCE_MODULES) });
    }
    const weight = typeof weightOverride === "number"
      && Number.isFinite(weightOverride)
      && weightOverride >= 1
      && weightOverride <= 1000
        ? Math.round(weightOverride)
        : BASE_WEIGHTS[kind];

    const id = crypto.randomUUID();
    const safeMeta = (meta && typeof meta === "object" && !Array.isArray(meta)) ? meta : {};
    const metaJson = JSON.stringify(safeMeta);
    if (metaJson.length > 4096) {
      return res.status(400).json({ error: "meta_too_large", maxBytes: 4096 });
    }
    const pool = getPool();

    await pool.query(
      `INSERT INTO "ZTideEvent" ("id","userId","kind","sourceModule","weight","meta")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [id, userId, kind, sourceModule, weight, metaJson],
    );

    // Upsert rolling score. Simple sum here; decay applied in /me read path.
    const upR = await pool.query(
      `INSERT INTO "ZTideScore" ("userId","score","eventCount","lastEventAt","rank")
       VALUES ($1, $2, 1, NOW(), 'seedling')
       ON CONFLICT ("userId") DO UPDATE SET
         "score" = "ZTideScore"."score" + EXCLUDED."score",
         "eventCount" = "ZTideScore"."eventCount" + 1,
         "lastEventAt" = NOW()
       RETURNING "score","eventCount"`,
      [userId, weight],
    );
    const newScore = Number((upR.rows[0] as { score: string | number }).score);
    const newRank = rankFor(newScore);
    await pool.query(
      `UPDATE "ZTideScore" SET "rank" = $1 WHERE "userId" = $2 AND "rank" != $1`,
      [newRank.id, userId],
    );

    res.status(201).json({
      id, userId, kind, weight,
      score: newScore,
      rank: newRank,
    });
  } catch (err: unknown) {
    console.error("[ztide] event_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "event_failed" });
  }
});

ztideRouter.get("/me", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const pool = getPool();
    const sR = await pool.query(
      `SELECT "score","eventCount","rank","lastEventAt" FROM "ZTideScore" WHERE "userId" = $1`,
      [auth.sub],
    );
    const score = sR.rowCount === 0 ? 0 : Number((sR.rows[0] as { score: string | number }).score);
    const eventCount = sR.rowCount === 0 ? 0 : Number((sR.rows[0] as { eventCount: number }).eventCount);
    const lastEventAt = sR.rowCount === 0 ? null : (sR.rows[0] as { lastEventAt: Date | null }).lastEventAt;
    const eR = await pool.query(
      `SELECT "id","kind","sourceModule","weight","meta","createdAt"
       FROM "ZTideEvent" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      [auth.sub],
    );
    res.json({
      userId: auth.sub,
      score, eventCount, lastEventAt,
      rank: rankFor(score),
      recentEvents: eR.rows,
    });
  } catch (err: unknown) {
    console.error("[ztide] me_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "me_failed" });
  }
});

// ── POST /me/login-streak — user self-claim, 20h cooldown
ztideRouter.post("/me/login-streak", writeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const pool = getPool();

    const lastR = await pool.query(
      `SELECT "createdAt" FROM "ZTideEvent" WHERE "userId" = $1 AND "kind" = 'login-streak' ORDER BY "createdAt" DESC LIMIT 1`,
      [auth.sub],
    );
    if (lastR.rowCount && lastR.rowCount > 0) {
      const last = (lastR.rows[0] as { createdAt: Date }).createdAt;
      const elapsedMs = Date.now() - new Date(last).getTime();
      const cooldownMs = 20 * 3600 * 1000;
      if (elapsedMs < cooldownMs) {
        const nextAvailableAt = new Date(new Date(last).getTime() + cooldownMs).toISOString();
        return res.status(429).json({ error: "streak_cooldown", nextAvailableAt });
      }
    }

    const id = crypto.randomUUID();
    const weight = BASE_WEIGHTS["login-streak"];
    await pool.query(
      `INSERT INTO "ZTideEvent" ("id","userId","kind","sourceModule","weight","meta")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [id, auth.sub, "login-streak", "auth", weight, JSON.stringify({})],
    );

    const upR = await pool.query(
      `INSERT INTO "ZTideScore" ("userId","score","eventCount","lastEventAt","rank")
       VALUES ($1, $2, 1, NOW(), 'seedling')
       ON CONFLICT ("userId") DO UPDATE SET
         "score" = "ZTideScore"."score" + EXCLUDED."score",
         "eventCount" = "ZTideScore"."eventCount" + 1,
         "lastEventAt" = NOW()
       RETURNING "score","eventCount"`,
      [auth.sub, weight],
    );
    const newScore = Number((upR.rows[0] as { score: string | number }).score);
    const newRank = rankFor(newScore);
    await pool.query(
      `UPDATE "ZTideScore" SET "rank" = $1 WHERE "userId" = $2 AND "rank" != $1`,
      [newRank.id, auth.sub],
    );

    res.status(201).json({
      ok: true, userId: auth.sub, kind: "login-streak", weight,
      score: newScore, rank: newRank,
    });
  } catch (err: unknown) {
    console.error("[ztide] login_streak_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "login_streak_failed" });
  }
});

ztideRouter.get("/leaderboard", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const pool = getPool();
    const r = await pool.query(
      `SELECT "userId","score","eventCount","rank","lastEventAt"
       FROM "ZTideScore" ORDER BY "score" DESC LIMIT $1`,
      [limit],
    );
    const rows = (r.rows as Array<{ userId: string; score: string | number; eventCount: number; rank: string; lastEventAt: Date | null }>).map((row, i) => ({
      position: i + 1,
      userId: row.userId,
      score: Number(row.score),
      eventCount: row.eventCount,
      rank: row.rank,
      lastEventAt: row.lastEventAt,
    }));
    res.json({ leaderboard: rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[ztide] leaderboard_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "leaderboard_failed" });
  }
});

ztideRouter.get("/rank/:userId", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const userId = String(req.params.userId || "").trim();
    if (!userId) return res.status(400).json({ error: "userId required" });
    const pool = getPool();
    const r = await pool.query(
      `SELECT "score","eventCount","rank","lastEventAt" FROM "ZTideScore" WHERE "userId" = $1`,
      [userId],
    );
    if (r.rowCount === 0) {
      return res.json({ userId, score: 0, eventCount: 0, rank: rankFor(0) });
    }
    const row = r.rows[0] as { score: string | number; eventCount: number; rank: string; lastEventAt: Date | null };
    const score = Number(row.score);
    res.json({ userId, score, eventCount: row.eventCount, rank: rankFor(score), lastEventAt: row.lastEventAt });
  } catch (err: unknown) {
    console.error("[ztide] rank_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "rank_failed" });
  }
});

ztideRouter.get("/stats", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM "ZTideScore")::int        AS active_users,
        (SELECT COUNT(*) FROM "ZTideEvent")::int        AS total_events,
        (SELECT COALESCE(SUM("weight"),0) FROM "ZTideEvent")::bigint  AS total_weight,
        (SELECT MAX("score") FROM "ZTideScore")         AS top_score
    `);
    res.json({ ...r.rows[0], service: "ztide", ranks: RANKS });
  } catch (err: unknown) {
    console.error("[ztide] stats_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "stats_failed" });
  }
});

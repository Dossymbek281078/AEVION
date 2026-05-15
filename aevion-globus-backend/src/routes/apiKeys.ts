/**
 * Platform API Key Management — Phase B of PUBLIC_API_QUOTAS.md
 *
 * Provides self-serve API key issuance for authenticated AEVION users.
 * Keys are in format `aev_(test|live)_<32 random hex>`.
 *
 * Endpoints:
 *   POST   /api/keys           — create key (returns raw key ONCE)
 *   GET    /api/keys           — list keys (no raw values)
 *   PATCH  /api/keys/:id       — rename key
 *   GET    /api/keys/:id/usage — usage stats + quota meter for a single key
 *   DELETE /api/keys/:id       — revoke key
 *   GET    /api/keys/verify    — verify a key (used by downstream services)
 *
 * Quota enforcement (Phase C) is gated on first paying B2B customer.
 * For now: Developer tier (1 key) is auto-assigned; upgrade flows TBD.
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import rateLimit from "express-rate-limit";

export const apiKeysRouter = Router();

const pool = getPool();

const createLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: "rate_limit_exceeded" } });

// ── Ensure table ──────────────────────────────────────────────────────────────

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlatformApiKey" (
      "id"          TEXT PRIMARY KEY,
      "userId"      TEXT NOT NULL,
      "name"        TEXT NOT NULL,
      "keyHash"     TEXT NOT NULL UNIQUE,
      "keyPrefix"   TEXT NOT NULL,
      "env"         TEXT NOT NULL DEFAULT 'test',
      "tier"        TEXT NOT NULL DEFAULT 'developer',
      "callsMonth"  BIGINT NOT NULL DEFAULT 0,
      "lastUsedAt"  TIMESTAMPTZ,
      "revokedAt"   TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlatformApiKey_userId_idx" ON "PlatformApiKey" ("userId");`
  );
  tablesReady = true;
}

function requireAuth(req: any, res: any) {
  const p = verifyBearerOptional(req);
  if (!p) { res.status(401).json({ error: "auth required" }); return null; }
  return p;
}

function generateKey(env: "test" | "live"): { raw: string; hash: string; prefix: string } {
  const secret = crypto.randomBytes(32).toString("hex");
  const raw = `aev_${env}_${secret}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

// Tier quotas — MUST stay in sync with apiQuotas.ts TIERS. Duplicated here to
// avoid cross-route imports for a 4-row lookup.
const TIER_MONTHLY_LIMIT: Record<string, number | null> = {
  developer: 10_000,
  build: 100_000,
  scale: 1_000_000,
  enterprise: null, // unlimited / contract-negotiated
};
const TIER_RATE_PER_MIN: Record<string, number | null> = {
  developer: 100,
  build: 500,
  scale: 2000,
  enterprise: null,
};

// ── POST /api/keys ─────────────────────────────────────────────────────────

apiKeysRouter.post("/", createLimiter, async (req, res) => {
  try {
    await ensureTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { name = "My API Key", env = "test" } = req.body || {};
    if (!["test", "live"].includes(env)) {
      return res.status(400).json({ error: "env must be 'test' or 'live'" });
    }
    if (!name || typeof name !== "string" || name.length > 80) {
      return res.status(400).json({ error: "name required (max 80 chars)" });
    }

    // Check per-user key limit (Developer tier: 1 test key)
    const existing = await pool.query(
      `SELECT COUNT(*) AS cnt FROM "PlatformApiKey"
       WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      [auth.sub]
    );
    const count = parseInt((existing.rows[0] as any).cnt, 10);
    if (count >= 3) {
      return res.status(429).json({
        error: "key_limit_reached",
        message: "Developer tier allows up to 3 active keys. Revoke an existing key or upgrade.",
        activeKeys: count,
      });
    }

    const { raw, hash, prefix } = generateKey(env as "test" | "live");
    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO "PlatformApiKey" ("id","userId","name","keyHash","keyPrefix","env","tier")
       VALUES ($1,$2,$3,$4,$5,$6,'developer')`,
      [id, auth.sub, name.trim(), hash, prefix, env]
    );

    res.status(201).json({
      id,
      name: name.trim(),
      key: raw,  // raw key returned ONCE — store it now
      prefix,
      env,
      tier: "developer",
      monthlyCalls: 0,
      monthlyLimit: 10000,
      note: "Store this key securely — it will not be shown again.",
    });
  } catch (err: unknown) {
    console.error("[apiKeys] create_key_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "create_key_failed" });
  }
});

// ── GET /api/keys ──────────────────────────────────────────────────────────

apiKeysRouter.get("/", async (req, res) => {
  try {
    await ensureTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const rows = await pool.query(
      `SELECT "id","name","keyPrefix","env","tier","callsMonth","lastUsedAt","revokedAt","createdAt"
       FROM "PlatformApiKey"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 20`,
      [auth.sub]
    );

    res.json({
      keys: (rows.rows as any[]).map(r => ({
        id: r.id,
        name: r.name,
        prefix: r.keyPrefix + "…",
        env: r.env,
        tier: r.tier,
        callsThisMonth: r.callsMonth,
        lastUsedAt: r.lastUsedAt,
        revokedAt: r.revokedAt,
        active: !r.revokedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: unknown) {
    console.error("[apiKeys] list_keys_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "list_keys_failed" });
  }
});

// ── DELETE /api/keys/:id ───────────────────────────────────────────────────

apiKeysRouter.delete("/:id", async (req, res) => {
  try {
    await ensureTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const r = await pool.query(
      `UPDATE "PlatformApiKey" SET "revokedAt" = NOW()
       WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL
       RETURNING "id"`,
      [req.params.id, auth.sub]
    );

    if ((r.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "key_not_found_or_already_revoked" });
    }
    res.json({ ok: true, revokedId: req.params.id });
  } catch (err: unknown) {
    console.error("[apiKeys] revoke_key_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "revoke_key_failed" });
  }
});

// ── PATCH /api/keys/:id — rename key ───────────────────────────────────────

const renameLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

apiKeysRouter.patch("/:id", renameLimiter, async (req, res) => {
  try {
    await ensureTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { name } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name_required" });
    }
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      return res.status(400).json({ error: "invalid_name", message: "Name must be 1-80 chars" });
    }

    const r = await pool.query(
      `UPDATE "PlatformApiKey" SET "name" = $1
       WHERE "id" = $2 AND "userId" = $3 AND "revokedAt" IS NULL
       RETURNING "id","name","keyPrefix","env","tier"`,
      [trimmed, req.params.id, auth.sub]
    );

    if ((r.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "key_not_found_or_revoked" });
    }
    const row = r.rows[0] as any;
    res.json({
      ok: true,
      key: {
        id: row.id,
        name: row.name,
        prefix: row.keyPrefix + "…",
        env: row.env,
        tier: row.tier,
      },
    });
  } catch (err: unknown) {
    console.error("[apiKeys] rename_key_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "rename_key_failed" });
  }
});

// ── GET /api/keys/:id/usage — per-key usage + quota meter ─────────────────
//
// Returns: { callsThisMonth, monthlyLimit, percentUsed, remaining,
//            rateLimitPerMinute, tier, env, lastUsedAt, daysUntilReset }.
// Used by the frontend quota meter UI on the keys list page.

apiKeysRouter.get("/:id/usage", async (req, res) => {
  try {
    await ensureTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const r = await pool.query(
      `SELECT "id","name","keyPrefix","env","tier","callsMonth","lastUsedAt","revokedAt","createdAt"
       FROM "PlatformApiKey"
       WHERE "id" = $1 AND "userId" = $2
       LIMIT 1`,
      [req.params.id, auth.sub]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "key_not_found" });
    }

    const row = r.rows[0] as any;
    const tier = (row.tier as string) || "developer";
    const monthlyLimit = TIER_MONTHLY_LIMIT[tier] ?? null;
    const rateLimitPerMinute = TIER_RATE_PER_MIN[tier] ?? null;
    const callsThisMonth = Number(row.callsMonth) || 0;
    const percentUsed = monthlyLimit && monthlyLimit > 0
      ? Math.min(100, Math.round((callsThisMonth / monthlyLimit) * 1000) / 10)
      : 0;
    const remaining = monthlyLimit ? Math.max(0, monthlyLimit - callsThisMonth) : null;

    // Days until monthly counter resets (assume reset on the 1st of next month UTC)
    const now = new Date();
    const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    const daysUntilReset = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      id: row.id,
      name: row.name,
      prefix: row.keyPrefix + "…",
      env: row.env,
      tier,
      active: !row.revokedAt,
      callsThisMonth,
      monthlyLimit,
      monthlyLimitDisplay: monthlyLimit === null ? "unlimited" : monthlyLimit.toLocaleString("en-US"),
      percentUsed,
      remaining,
      rateLimitPerMinute,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      resetAt: nextReset.toISOString(),
      daysUntilReset,
    });
  } catch (err: unknown) {
    console.error("[apiKeys] usage_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "usage_failed" });
  }
});

// ── GET /api/keys/verify — for downstream service auth ────────────────────

apiKeysRouter.get("/verify", verifyLimiter, async (req, res) => {
  try {
    await ensureTables();
    const raw = req.headers["x-api-key"] as string | undefined;
    if (!raw) return res.status(401).json({ error: "missing x-api-key header" });

    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const r = await pool.query(
      `SELECT "id","userId","tier","env","callsMonth"
       FROM "PlatformApiKey"
       WHERE "keyHash" = $1 AND "revokedAt" IS NULL
       LIMIT 1`,
      [hash]
    );

    if (r.rowCount === 0) return res.status(401).json({ error: "invalid_or_revoked_key" });

    // Bump last-used (fire-and-forget)
    pool.query(
      `UPDATE "PlatformApiKey" SET "lastUsedAt" = NOW(), "callsMonth" = "callsMonth" + 1 WHERE "id" = $1`,
      [(r.rows[0] as any).id]
    ).catch(() => {});

    const key = r.rows[0] as any;
    res.json({ valid: true, userId: key.userId, tier: key.tier, env: key.env });
  } catch (err: unknown) {
    console.error("[apiKeys] verify_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "verify_failed" });
  }
});

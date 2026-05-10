/**
 * Platform API Key Management — Phase B of PUBLIC_API_QUOTAS.md
 *
 * Provides self-serve API key issuance for authenticated AEVION users.
 * Keys are in format `aev_(test|live)_<32 random hex>`.
 *
 * Endpoints:
 *   POST   /api/keys        — create key (returns raw key ONCE)
 *   GET    /api/keys        — list keys (no raw values)
 *   DELETE /api/keys/:id   — revoke key
 *   GET    /api/keys/verify — verify a key (used by downstream services)
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
  } catch (err: any) {
    res.status(500).json({ error: "create_key_failed", details: err?.message });
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
  } catch (err: any) {
    res.status(500).json({ error: "list_keys_failed", details: err?.message });
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
  } catch (err: any) {
    res.status(500).json({ error: "revoke_key_failed", details: err?.message });
  }
});

// ── GET /api/keys/verify — for downstream service auth ────────────────────

apiKeysRouter.get("/verify", async (req, res) => {
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
  } catch (err: any) {
    res.status(500).json({ error: "verify_failed", details: err?.message });
  }
});

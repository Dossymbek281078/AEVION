import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import {
  HMAC_KEY_VERSION,
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
} from "../config/qright";
import {
  generateEphemeralEd25519,
  splitAndAuthenticate,
  verifyShardHmac,
  combineAndVerify,
  wipeBuffer,
  type AuthenticatedShard,
} from "../lib/shamir/shield";
import { createShieldRecord } from "../lib/qshield/createRecord";
import { QSHIELD_OPENAPI } from "../lib/qshield/openapiSpec";
import {
  ensureWebhookTables,
  fireShieldWebhook,
  type ShieldWebhookEvent,
} from "../lib/qshield/webhooks";
import { captureShieldError } from "../lib/qshield/sentry";
import {
  clientIp,
  createInMemoryRateLimiter,
} from "../lib/rateLimit/inMemoryWindow";
// _legacyGenerateShards is intentionally imported (not called) to preserve the
// symbol export for any legacy test or analytics code that references it.
import { _legacyGenerateShards } from "../lib/shamir/legacy";
void _legacyGenerateShards;
import { applyOgEtag, applyEtag } from "../lib/ogEtag";

export const quantumShieldRouter = Router();
const pool = getPool();

const createRateLimiter = createInMemoryRateLimiter({ max: 20 });
const verifyRateLimiter = createInMemoryRateLimiter({ max: 60 });
const reconstructRateLimiter = createInMemoryRateLimiter({ max: 30 });

const RESERVED_IDS = new Set([
  "health",
  "stats",
  "records",
  "verify",
  "reconstruct",
  "create",
  "witness",
  "revoke",
  "audit",
  "metrics",
  "webhooks",
  "openapi.json",
  "transparency",
  "admin",
  "og.svg",
  "sitemap.xml",
]);

let ensuredTable = false;

async function ensureShieldTable(): Promise<void> {
  if (ensuredTable) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShield" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT,
      "objectTitle" TEXT,
      "algorithm" TEXT NOT NULL DEFAULT 'Shamir''s Secret Sharing + Ed25519',
      "threshold" INT NOT NULL DEFAULT 2,
      "totalShards" INT NOT NULL DEFAULT 3,
      "shards" TEXT NOT NULL,
      "signature" TEXT,
      "publicKey" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "hmac_key_version" INTEGER NOT NULL DEFAULT 1;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "verifiedCount" INTEGER NOT NULL DEFAULT 0;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMPTZ;`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShield_ownerUserId_idx" ON "QuantumShield" ("ownerUserId");`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShieldIdempotency" (
      "id" TEXT PRIMARY KEY,
      "shieldId" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL,
      "result" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("shieldId", "idempotencyKey")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShieldIdempotency_createdAt_idx" ON "QuantumShieldIdempotency" ("createdAt");`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShieldDistribution" (
      "shieldId" TEXT NOT NULL,
      "shardIndex" INT NOT NULL,
      "sssShare" TEXT NOT NULL,
      "hmac" TEXT NOT NULL,
      "hmacKeyVersion" INT NOT NULL,
      "witnessCid" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("shieldId", "shardIndex")
    );
  `);
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "distribution_policy" TEXT NOT NULL DEFAULT 'legacy_all_local';`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShieldAudit" (
      "id" TEXT PRIMARY KEY,
      "shieldId" TEXT NOT NULL,
      "event" TEXT NOT NULL,
      "actorUserId" TEXT,
      "actorIp" TEXT,
      "details" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShieldAudit_shieldId_idx" ON "QuantumShieldAudit" ("shieldId");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShieldAudit_createdAt_idx" ON "QuantumShieldAudit" ("createdAt" DESC);`,
  );
  ensuredTable = true;
}

function parseShards(raw: unknown, ctx?: { shieldId?: string }): AuthenticatedShard[] {
  if (typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const preview = raw.length > 64 ? raw.slice(0, 64) + "…" : raw;
    console.error(
      `[QuantumShield] shard JSON corrupt${ctx?.shieldId ? ` (id=${ctx.shieldId})` : ""}: ${
        err instanceof Error ? err.message : String(err)
      } | preview=${preview}`,
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn(
      `[QuantumShield] shard payload is not an array${ctx?.shieldId ? ` (id=${ctx.shieldId})` : ""}: type=${typeof parsed}`,
    );
    return [];
  }
  return parsed as AuthenticatedShard[];
}

/**
 * Best-effort audit-log write. Never throws — audit must not break a live
 * write path. `details` is JSON-serialized via pg driver (jsonb column).
 */
async function audit(
  shieldId: string,
  event: string,
  req: Request,
  details?: Record<string, unknown>,
  actorUserId?: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "QuantumShieldAudit"
        ("id","shieldId","event","actorUserId","actorIp","details")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        crypto.randomUUID(),
        shieldId,
        event,
        actorUserId ?? null,
        clientIp(req) ?? null,
        details ? JSON.stringify(details) : null,
      ],
    );
  } catch (err) {
    console.warn(
      "[QuantumShield] audit write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function rateLimit(
  limiter: ReturnType<typeof createInMemoryRateLimiter>,
  req: Request,
  res: Response,
): boolean {
  const ip = clientIp({ ip: req.ip, headers: req.headers });
  const rl = limiter.check(ip);
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
    res.status(429).json({
      error: "Too Many Requests",
      retryAfterMs: rl.retryAfterMs,
    });
    return false;
  }
  return true;
}

/* ── Health ── */
quantumShieldRouter.get("/health", async (_req, res) => {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "status" = 'active')::int AS active,
        COUNT(*) FILTER (WHERE "legacy" = true)::int AS legacy,
        COUNT(*) FILTER (WHERE "distribution_policy" = 'distributed_v2')::int AS distributed
      FROM "QuantumShield"
    `);
    const r = rows[0] ?? { total: 0, active: 0, legacy: 0, distributed: 0 };
    res.json({
      status: "ok",
      service: "quantum-shield",
      algorithm: "Shamir's Secret Sharing + Ed25519",
      threshold: SHAMIR_THRESHOLD,
      totalShards: SHAMIR_SHARDS,
      hmacKeyVersion: HMAC_KEY_VERSION,
      // Both legacy and v1.0 names — older clients keyed off shieldRecords.
      shieldRecords: r.total,
      totalRecords: r.total,
      activeRecords: r.active,
      legacyRecords: r.legacy,
      distributedRecords: r.distributed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] health error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ status: "error", service: "quantum-shield" });
  }
});

/**
 * Webhook CRUD — owners manage their own delivery subscriptions.
 *
 * POST /webhooks  body: { url, events?, secret? }   → 201 { id, secret }
 * GET  /webhooks                                    → list mine
 * GET  /webhooks/:id/deliveries                     → recent delivery log
 * DELETE /webhooks/:id                              → remove
 */
quantumShieldRouter.post("/webhooks", async (req, res) => {
  try {
    await ensureWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const body = (req.body || {}) as {
      url?: unknown;
      events?: unknown;
      secret?: unknown;
    };
    if (typeof body.url !== "string" || !/^https?:\/\//i.test(body.url)) {
      return res.status(400).json({ error: "url must be http(s)://..." });
    }
    const VALID_EVENTS: ShieldWebhookEvent[] = [
      "shield.created",
      "shield.reconstructed",
      "shield.revoked",
      "shield.deleted",
    ];
    let events: string;
    if (body.events === undefined || body.events === "*") {
      events = "*";
    } else if (typeof body.events === "string") {
      events = body.events;
    } else if (Array.isArray(body.events)) {
      const list = body.events
        .filter((e: unknown): e is string => typeof e === "string")
        .filter((e) => (VALID_EVENTS as string[]).includes(e));
      if (list.length === 0) {
        return res.status(400).json({
          error: "events must be '*' or include at least one of: " + VALID_EVENTS.join(", "),
        });
      }
      events = list.join(",");
    } else {
      return res.status(400).json({ error: "events must be a string or array" });
    }
    const secret =
      typeof body.secret === "string" && body.secret.length >= 16
        ? body.secret
        : crypto.randomBytes(24).toString("hex");
    const id = "qsw-" + crypto.randomBytes(8).toString("hex");
    await pool.query(
      `INSERT INTO "QuantumShieldWebhook"
        ("id","ownerUserId","url","secret","events","active","createdAt")
       VALUES ($1,$2,$3,$4,$5,TRUE,NOW())`,
      [id, auth.sub, body.url, secret, events],
    );
    res.status(201).json({ id, url: body.url, events, secret, active: true });
  } catch (err) {
    console.error(
      "[QuantumShield] webhook create error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

quantumShieldRouter.get("/webhooks", async (req, res) => {
  try {
    await ensureWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { rows } = await pool.query(
      `SELECT "id","url","events","active","createdAt","lastFiredAt","failureCount"
       FROM "QuantumShieldWebhook" WHERE "ownerUserId" = $1
       ORDER BY "createdAt" DESC`,
      [auth.sub],
    );
    res.json({ webhooks: rows });
  } catch (err) {
    console.error(
      "[QuantumShield] webhook list error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to list webhooks" });
  }
});

quantumShieldRouter.get("/webhooks/:id/deliveries", async (req, res) => {
  try {
    await ensureWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const owner = await pool.query(
      `SELECT "ownerUserId" FROM "QuantumShieldWebhook" WHERE "id" = $1`,
      [req.params.id],
    );
    if (owner.rows.length === 0) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    if ((owner.rows[0] as { ownerUserId: string }).ownerUserId !== auth.sub && auth.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const { rows } = await pool.query(
      `SELECT "id","event","succeeded","statusCode","errorMessage","durationMs","createdAt"
       FROM "QuantumShieldWebhookDelivery"
       WHERE "webhookId" = $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      [req.params.id, limit],
    );
    res.json({ webhookId: req.params.id, deliveries: rows });
  } catch (err) {
    console.error(
      "[QuantumShield] webhook deliveries error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
});

quantumShieldRouter.delete("/webhooks/:id", async (req, res) => {
  try {
    await ensureWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const owner = await pool.query(
      `SELECT "ownerUserId" FROM "QuantumShieldWebhook" WHERE "id" = $1`,
      [req.params.id],
    );
    if (owner.rows.length === 0) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    if ((owner.rows[0] as { ownerUserId: string }).ownerUserId !== auth.sub && auth.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await pool.query(`DELETE FROM "QuantumShieldWebhook" WHERE "id" = $1`, [req.params.id]);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error(
      "[QuantumShield] webhook delete error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

/**
 * GET /openapi.json — machine-readable contract for SDK generators / Postman.
 */
quantumShieldRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(QSHIELD_OPENAPI);
});

/**
 * GET /metrics — Prometheus exposition format. text/plain, no auth.
 * Same counters as /health plus runtime gauges. Cheap single-round-trip.
 */
quantumShieldRouter.get("/metrics", async (_req, res) => {
  try {
    let dbLatencyMs = 0;
    try {
      const t0 = Date.now();
      await pool.query("SELECT 1");
      dbLatencyMs = Date.now() - t0;
    } catch {
      /* graceful 0 */
    }
    await ensureShieldTable();

    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "status" = 'active')::int AS active,
        COUNT(*) FILTER (WHERE "status" = 'revoked')::int AS revoked,
        COUNT(*) FILTER (WHERE "legacy" = true)::int AS legacy,
        COUNT(*) FILTER (WHERE "distribution_policy" = 'distributed_v2')::int AS distributed,
        COALESCE(SUM("verifiedCount"),0)::int AS reconstructions
      FROM "QuantumShield"
    `);
    const auditCount = await pool
      .query(`SELECT COUNT(*)::int AS n FROM "QuantumShieldAudit"`)
      .catch(() => ({ rows: [{ n: 0 }] }) as { rows: Array<{ n: number }> });
    const c = rows[0] ?? {
      total: 0,
      active: 0,
      revoked: 0,
      legacy: 0,
      distributed: 0,
      reconstructions: 0,
    };

    const mem = process.memoryUsage();
    const uptimeSec = Math.round(process.uptime());

    const lines: string[] = [];
    const out = (
      name: string,
      type: "counter" | "gauge",
      help: string,
      value: number | string,
      labels?: string,
    ) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name}${labels ?? ""} ${value}`);
    };

    out("qshield_records_total", "gauge", "All shield records", c.total);
    out("qshield_records_active", "gauge", "Active shield records", c.active);
    out("qshield_records_revoked", "gauge", "Revoked shield records", c.revoked);
    out("qshield_records_legacy", "gauge", "Legacy (pre-v2) shield records", c.legacy);
    out(
      "qshield_records_distributed",
      "gauge",
      "Records using distributed_v2 policy",
      c.distributed,
    );
    out(
      "qshield_reconstructions_total",
      "counter",
      "Sum of verifiedCount across all records",
      c.reconstructions,
    );
    out(
      "qshield_audit_entries_total",
      "counter",
      "Total audit log rows",
      auditCount.rows[0]?.n ?? 0,
    );
    out(
      "qshield_db_latency_seconds",
      "gauge",
      "Latency of SELECT 1 against the configured DB",
      (dbLatencyMs / 1000).toFixed(4),
    );
    out("qshield_uptime_seconds", "gauge", "Process uptime in seconds", uptimeSec);
    out("qshield_memory_rss_bytes", "gauge", "Resident set size in bytes", mem.rss);
    out("qshield_memory_heap_used_bytes", "gauge", "V8 heap bytes in use", mem.heapUsed);

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(lines.join("\n") + "\n");
  } catch (e: unknown) {
    console.error(
      "[QuantumShield] metrics error:",
      e instanceof Error ? e.message : String(e),
    );
    res.status(500).type("text/plain").send(`# error generating metrics\n`);
  }
});

/* ─── TIER 2: transparency + admin (allowlist via QSHIELD_ADMIN_EMAILS) ─── */

function qshieldAdminEmailsAllowlist(): Set<string> {
  const raw = String(process.env.QSHIELD_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
}

function isQShieldAdmin(req: Request): { ok: boolean; email: string | null; reason: string | null } {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return { ok: false, email: null, reason: "no-bearer" };
  const token = auth.slice(7).trim();
  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    const email = String(decoded.email || "").toLowerCase();
    const role = String(decoded.role || "").toLowerCase();
    if (role === "admin") return { ok: true, email, reason: null };
    const allow = qshieldAdminEmailsAllowlist();
    if (allow.has(email)) return { ok: true, email, reason: null };
    return { ok: false, email, reason: "not-in-allowlist" };
  } catch {
    return { ok: false, email: null, reason: "invalid-token" };
  }
}

// 🔹 GET /transparency — public counts only.
quantumShieldRouter.get("/transparency", async (_req, res) => {
  try {
    await ensureShieldTable();
    const totals = await pool.query(`
      SELECT COUNT(*)::int AS "n",
             COUNT(*) FILTER (WHERE "status" = 'active')::int AS "active",
             COUNT(*) FILTER (WHERE "status" = 'revoked')::int AS "revoked",
             COUNT(*) FILTER (WHERE "distribution_policy" = 'distributed_v2')::int AS "distributed",
             COALESCE(SUM("verifiedCount"),0)::int AS "reconstructions"
      FROM "QuantumShield"
    `);
    const byPolicy = await pool.query(
      `SELECT "distribution_policy" AS "p", COUNT(*)::int AS "n"
       FROM "QuantumShield" GROUP BY "distribution_policy"`
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      totals: {
        shields: totals.rows[0]?.n || 0,
        active: totals.rows[0]?.active || 0,
        revoked: totals.rows[0]?.revoked || 0,
        distributed: totals.rows[0]?.distributed || 0,
        reconstructions: totals.rows[0]?.reconstructions || 0,
      },
      byPolicy: Object.fromEntries(byPolicy.rows.map((r: { p: string; n: number }) => [r.p, r.n])),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "transparency failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// 🔹 Admin probe.
quantumShieldRouter.get("/admin/whoami", (req, res) => {
  const a = isQShieldAdmin(req);
  res.json({ isAdmin: a.ok, email: a.email, reason: a.reason });
});

// 🔹 Admin: list shields (?status, ?policy, ?limit≤200).
quantumShieldRouter.get("/admin/shields", async (req, res) => {
  const a = isQShieldAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureShieldTable();
  const status = String(req.query.status || "").trim();
  const policy = String(req.query.policy || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const conds: string[] = [];
  const args: unknown[] = [];
  if (status) { args.push(status); conds.push(`"status" = $${args.length}`); }
  if (policy) { args.push(policy); conds.push(`"distribution_policy" = $${args.length}`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","objectId","objectTitle","threshold","totalShards","status",
            "distribution_policy","verifiedCount","createdAt","ownerUserId"
     FROM "QuantumShield" ${where}
     ORDER BY "createdAt" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});

// 🔹 Admin: force-revoke a shield (reason required, audit logged via QuantumShieldAudit).
quantumShieldRouter.post("/admin/shields/:id/revoke", async (req, res) => {
  const a = isQShieldAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureShieldTable();
  const shieldId = String(req.params.id);
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: "reason_required" });
  const cur = await pool.query(`SELECT "id","status" FROM "QuantumShield" WHERE "id" = $1`, [shieldId]);
  if (cur.rowCount === 0) return res.status(404).json({ error: "shield_not_found" });
  if (cur.rows[0].status === "revoked") return res.status(409).json({ error: "already_revoked" });
  await pool.query(`UPDATE "QuantumShield" SET "status" = 'revoked' WHERE "id" = $1`, [shieldId]);
  await audit(shieldId, "admin.force-revoke", req, { reason, actorEmail: a.email });
  res.json({ ok: true });
});

// 🔹 Admin: cross-shield audit reader.
quantumShieldRouter.get("/admin/audit", async (req, res) => {
  const a = isQShieldAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureShieldTable();
  const event = String(req.query.event || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const args: unknown[] = [];
  let where = "";
  if (event) { args.push(event); where = `WHERE "event" = $1`; }
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","shieldId","event","actorUserId","actorIp","details","createdAt"
     FROM "QuantumShieldAudit" ${where}
     ORDER BY "createdAt" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 3 amplifier — OG cards, sitemap, per-shield RSS
// ─────────────────────────────────────────────────────────────────────────

function qsEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function qsWrap(text: string, perLine: number, maxLines: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > perLine) {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length === maxLines) {
    lines[maxLines - 1] = (lines[maxLines - 1] || "").replace(/\s+\S+$/, "") + "…";
  }
  return lines;
}

// 🔹 GET /og.svg — index card (totals + active + revoked).
quantumShieldRouter.get("/og.svg", async (req, res) => {
  try {
    await ensureShieldTable();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const totals = await pool.query(
      `SELECT COUNT(*)::int AS "n",
              SUM(CASE WHEN "status"='active' THEN 1 ELSE 0 END)::int AS "active",
              SUM(CASE WHEN "status"='revoked' THEN 1 ELSE 0 END)::int AS "revoked"
       FROM "QuantumShield"`
    );
    const t = (totals.rows[0] || {}) as Record<string, number>;
    const total = t.n || 0;
    const active = t.active || 0;
    const revoked = t.revoked || 0;
    if (applyOgEtag(req, res, `qshield-index-${total}-${active}-${revoked}`)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QUANTUM SHIELD</text>
    <text x="60" y="200" font-size="96" font-weight="900" letter-spacing="-2">${qsEsc(String(total))} shields</text>
    <text x="60" y="252" font-size="32" font-weight="600" fill="#cbd5e1">Threshold cryptography — Shamir + Ed25519 + witness mesh.</text>
    <g transform="translate(60, 380)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <g>
        <rect width="220" height="80" rx="14" fill="#0d9488" fill-opacity="0.15" stroke="#0d9488" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#0d9488">${qsEsc(String(active))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#5eead4">ACTIVE</text>
      </g>
      <g transform="translate(240, 0)">
        <rect width="220" height="80" rx="14" fill="#dc2626" fill-opacity="0.15" stroke="#dc2626" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#fca5a5">${qsEsc(String(revoked))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#fecaca">REVOKED</text>
      </g>
    </g>
    <text x="60" y="585" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.tech / quantum-shield</text>
  </g>
</svg>`;

    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: "index og failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// 🔹 GET /:id/og.svg — per-shield card. Status colour, algorithm + threshold.
quantumShieldRouter.get("/:id/og.svg", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const id = String(req.params.id);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const r = await pool.query(
      `SELECT "id","objectTitle","algorithm","threshold","totalShards","status","distribution_policy"
       FROM "QuantumShield" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    if (r.rowCount === 0) {
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="60" y="320" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="900" fill="#e2e8f0">Shield not found</text>
  <text x="60" y="380" font-family="ui-monospace, monospace" font-size="24" fill="#64748b">${qsEsc(id)}</text>
</svg>`;
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(fallback);
    }
    const row = r.rows[0] as Record<string, unknown>;
    const status = String(row.status || "active");
    if (applyOgEtag(req, res, `qshield-${id}-${status}-${row.threshold}-${row.totalShards}`)) return;
    const isRevoked = status === "revoked";
    const accent = isRevoked ? "#dc2626" : "#7c3aed";
    const label = isRevoked ? "REVOKED" : "ACTIVE";
    const titleLines = qsWrap(String(row.objectTitle || id), 24, 2);
    const subLine = `${row.algorithm || "shield"} · ${row.threshold}-of-${row.totalShards} · ${row.distribution_policy || "legacy_all_local"}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QUANTUM SHIELD</text>
    <g transform="translate(60, 170)">
      ${titleLines
        .map(
          (line, i) =>
            `<text y="${i * 92}" font-size="80" font-weight="900" letter-spacing="-2">${qsEsc(line)}</text>`
        )
        .join("\n      ")}
    </g>
    <g transform="translate(60, ${170 + titleLines.length * 92 + 40})">
      <text font-size="28" font-weight="500" fill="#cbd5e1" font-family="ui-monospace, monospace">${qsEsc(subLine)}</text>
    </g>
    <g transform="translate(60, 540)">
      <rect width="${label.length * 18 + 56}" height="44" rx="22" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
      <text x="22" y="30" font-size="22" font-weight="900" fill="${accent}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${qsEsc(label)}</text>
    </g>
    <g transform="translate(${1200 - 60}, 540)" text-anchor="end">
      <text font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">${qsEsc(id.slice(0, 18))}</text>
    </g>
  </g>
</svg>`;

    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: "shield og failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// 🔹 GET /:id/changelog.rss — RSS 2.0 of audit events for one shield.
quantumShieldRouter.get("/:id/changelog.rss", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const id = String(req.params.id);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const selfUrl = `${proto}://${host}/api/quantum-shield/${encodeURIComponent(id)}/changelog.rss`;
    const siteUrl = `${proto}://${host}/quantum-shield/${encodeURIComponent(id)}`;

    const shieldRow = await pool.query(
      `SELECT "objectTitle" FROM "QuantumShield" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    const shieldTitle = shieldRow.rows[0]?.objectTitle || id;

    const r = await pool.query(
      `SELECT "id","event","actorUserId","details","createdAt"
       FROM "QuantumShieldAudit"
       WHERE "shieldId" = $1
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [id, limit]
    );

    const latestSrc = r.rows[0]?.createdAt;
    const latestMs = latestSrc instanceof Date ? latestSrc.getTime() : (latestSrc ? new Date(String(latestSrc)).getTime() : 0);
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `qshield-${id}-${r.rows.length}-${latestMs}`, { prefix: "rss" })) return;

    function describe(row: Record<string, unknown>): string {
      const ev = String(row.event || "shield.event");
      const actor = row.actorUserId ? ` by ${row.actorUserId}` : "";
      return `${ev}${actor}`;
    }

    const items = r.rows
      .map((row: Record<string, unknown>) => {
        const at = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt));
        const pubDate = at.toUTCString();
        const summary = describe(row);
        const title = `${shieldTitle} — ${summary}`;
        const guid = `aevion-qshield-${row.id}`;
        return `    <item>
      <title>${qsEsc(title)}</title>
      <link>${qsEsc(siteUrl)}</link>
      <guid isPermaLink="false">${qsEsc(String(guid))}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${qsEsc(summary)}</description>
    </item>`;
      })
      .join("\n");

    const lastBuild = r.rows[0]
      ? (r.rows[0].createdAt instanceof Date ? r.rows[0].createdAt : new Date(String(r.rows[0].createdAt))).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEVION Quantum Shield · ${qsEsc(String(shieldTitle))} — events</title>
    <link>${qsEsc(siteUrl)}</link>
    <atom:link href="${qsEsc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Audit events for AEVION Quantum Shield ${qsEsc(id)}.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: "shield rss failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// 🔹 GET /sitemap.xml — sitemap of /quantum-shield/:id for active shields.
quantumShieldRouter.get("/sitemap.xml", async (req, res) => {
  try {
    await ensureShieldTable();
    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const origin = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);

    const r = await pool.query(
      `SELECT "id","createdAt"
       FROM "QuantumShield"
       WHERE "status" = 'active'
       ORDER BY "createdAt" DESC
       LIMIT 5000`
    );

    const rows = r.rows as Record<string, unknown>[];
    const latestSrc = rows[0]?.createdAt;
    const latestMs = latestSrc instanceof Date ? latestSrc.getTime() : (latestSrc ? new Date(String(latestSrc)).getTime() : 0);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `qshield-${rows.length}-${latestMs}-${today}`, { prefix: "sitemap", maxAgeSec: 600 })) return;

    const urls: string[] = [];
    urls.push(`  <url>
    <loc>${qsEsc(origin)}/quantum-shield</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
    for (const row of rows) {
      const lastmodSrc = row.createdAt;
      const lastmod = lastmodSrc
        ? (lastmodSrc instanceof Date ? lastmodSrc.toISOString() : String(lastmodSrc)).slice(0, 10)
        : today;
      urls.push(`  <url>
    <loc>${qsEsc(origin)}/quantum-shield/${qsEsc(String(row.id))}</loc>
    <lastmod>${qsEsc(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: "sitemap failed", details: err instanceof Error ? err.message : String(err) });
  }
});

/* ── List handler (reused by / and /records) ── */
async function handleList(req: Request, res: Response): Promise<void> {
  try {
    await ensureShieldTable();
    const auth = verifyBearerOptional(req);

    const limitRaw = Number.parseInt(String(req.query.limit ?? ""), 10);
    const offsetRaw = Number.parseInt(String(req.query.offset ?? ""), 10);
    const limit = Math.min(
      Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50,
      200,
    );
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const mineOnly = req.query.mine === "1" || req.query.mine === "true";

    let where = "";
    const params: unknown[] = [];
    if (mineOnly && auth?.sub) {
      where = `WHERE "ownerUserId" = $1`;
      params.push(auth.sub);
    }
    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" ${where} ORDER BY "createdAt" DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    const totalQ = await pool.query(
      `SELECT COUNT(*)::int AS total FROM "QuantumShield" ${where}`,
      mineOnly && auth?.sub ? [auth.sub] : [],
    );
    const records = rows.map((r: Record<string, unknown>) => {
      const shards = parseShards(r.shards, { shieldId: r.id as string });
      const status =
        (r.status as string) || (r.legacy === true ? "legacy" : "active");
      return {
        id: r.id,
        objectId: r.objectId,
        objectTitle: r.objectTitle,
        algorithm: r.algorithm,
        threshold: r.threshold,
        totalShards: r.totalShards,
        shards,
        signature: r.signature,
        publicKey: r.publicKey,
        legacy: r.legacy === true,
        hmacKeyVersion: r.hmac_key_version ?? 1,
        verifiedCount: r.verifiedCount ?? 0,
        lastVerifiedAt: r.lastVerifiedAt ?? null,
        status,
        createdAt: r.createdAt,
      };
    });
    res.json({
      records,
      items: records,
      total: totalQ.rows[0]?.total ?? records.length,
      limit,
      offset,
      mine: mineOnly,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] list error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch shield records" });
  }
}

/* ── Create handler (reused by POST / and POST /create) ── */
async function handleCreate(req: Request, res: Response): Promise<void> {
  if (!rateLimit(createRateLimiter, req, res)) return;
  try {
    await ensureShieldTable();
    const auth = verifyBearerOptional(req);
    const { objectId, objectTitle, payload, threshold, totalShards, distribution } = req.body as {
      objectId?: string;
      objectTitle?: string;
      payload?: unknown;
      threshold?: number;
      totalShards?: number;
      distribution?: "legacy_all_local" | "distributed_v2";
    };
    try {
      const created = await createShieldRecord(pool, {
        objectId,
        objectTitle,
        payload,
        threshold,
        totalShards,
        ownerUserId: auth?.sub || null,
        distribution,
      });
      void audit(created.id, "create", req, {
        distribution: created.distribution,
        threshold: created.threshold,
        totalShards: created.totalShards,
        objectId: created.objectId,
      }, auth?.sub || null);
      fireShieldWebhook(pool, created.ownerUserId, "shield.created", {
        id: created.id,
        objectTitle: created.objectTitle,
        distribution: created.distribution,
        threshold: created.threshold,
        totalShards: created.totalShards,
        publicKey: created.publicKey,
        witnessCid: created.witnessCid,
      });
      res.status(201).json(created);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "objectTitle or payload is required") {
        res.status(400).json({ error: msg });
        return;
      }
      throw e;
    }
  } catch (err) {
    console.error(
      "[QuantumShield] create error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to create shield record" });
  }
}

/* ── Routes ── */
quantumShieldRouter.get("/", handleList);
quantumShieldRouter.get("/records", handleList);

quantumShieldRouter.post("/", handleCreate);
quantumShieldRouter.post("/create", handleCreate);

quantumShieldRouter.get("/stats", async (_req, res) => {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE legacy = true)::int AS legacy,
         COALESCE(SUM("totalShards"), 0)::int AS "totalShards",
         COALESCE(AVG("threshold"), 0)::float AS "avgThreshold",
         COALESCE(SUM("verifiedCount"), 0)::int AS "totalVerifications"
       FROM "QuantumShield"`,
    );
    const r = rows[0] || {};
    res.json({
      totalRecords: r.total || 0,
      activeRecords: r.active || 0,
      legacyRecords: r.legacy || 0,
      totalShards: r.totalShards || 0,
      avgThreshold: Math.round((r.avgThreshold || 0) * 10) / 10,
      totalVerifications: r.totalVerifications || 0,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] stats error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

quantumShieldRouter.get("/:id/public", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT "id","objectId","objectTitle","algorithm","threshold","totalShards","publicKey","signature","status","legacy","hmac_key_version","verifiedCount","lastVerifiedAt","distribution_policy","ownerUserId","createdAt"
       FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const r = rows[0] as Record<string, unknown>;
    let witnessCid: string | null = null;
    if (r.distribution_policy === "distributed_v2") {
      const w = await pool.query(
        `SELECT "witnessCid" FROM "QuantumShieldDistribution" WHERE "shieldId" = $1 AND "shardIndex" = 3`,
        [r.id],
      );
      witnessCid = (w.rows?.[0]?.witnessCid as string | null) ?? null;
    }

    // If the caller is the owner OR an admin, surface a short audit-trail
    // snippet so dashboards have one less round trip. Public-anonymous
    // projection still has no audit (privacy + cache).
    const auth = verifyBearerOptional(req);
    const isOwner = !!auth?.sub && r.ownerUserId === auth.sub;
    const isAdmin = auth?.role === "admin";
    let auditSnippet: Array<Record<string, unknown>> | null = null;
    if (isOwner || isAdmin) {
      try {
        const a = await pool.query(
          `SELECT "id","event","actorUserId","createdAt"
           FROM "QuantumShieldAudit" WHERE "shieldId" = $1
           ORDER BY "createdAt" DESC LIMIT 5`,
          [r.id],
        );
        auditSnippet = a.rows;
      } catch {
        /* non-fatal — table may be missing on legacy deployment */
      }
    }

    // Public projection: no shards, no ownerUserId for anon callers.
    // Cache only for anonymous responses — owner snippet must not leak.
    if (auditSnippet === null) {
      res.setHeader("Cache-Control", "public, max-age=60");
    } else {
      res.setHeader("Cache-Control", "private, no-store");
    }
    res.json({
      id: r.id,
      objectId: r.objectId,
      objectTitle: r.objectTitle,
      algorithm: r.algorithm,
      threshold: r.threshold,
      totalShards: r.totalShards,
      publicKey: r.publicKey,
      signature: r.signature,
      status: r.status,
      legacy: r.legacy === true,
      hmacKeyVersion: r.hmac_key_version ?? 1,
      verifiedCount: r.verifiedCount ?? 0,
      lastVerifiedAt: r.lastVerifiedAt ?? null,
      distribution: r.distribution_policy ?? "legacy_all_local",
      witnessCid,
      witnessUrl: witnessCid ? `/api/quantum-shield/${r.id}/witness` : null,
      createdAt: r.createdAt,
      verifyUrl: `/quantum-shield/${r.id}`,
      // Owner-only fields:
      ownerUserId: isOwner || isAdmin ? r.ownerUserId : undefined,
      auditSnippet: auditSnippet ?? undefined,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] public error:",
      err instanceof Error ? err.message : String(err),
    );
    captureShieldError(err, { route: "public", shieldId: req.params.id });
    res.status(500).json({ error: "Failed to fetch public view" });
  }
});

quantumShieldRouter.get("/:id", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const r = rows[0] as Record<string, unknown>;
    const shards = parseShards(r.shards, { shieldId: r.id as string });
    res.json({
      ...r,
      shards,
      legacy: r.legacy === true,
      hmacKeyVersion: r.hmac_key_version ?? 1,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] get error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch shield record" });
  }
});

/**
 * GET /:id/witness
 *
 * Public retrieval of the witness shard (only available for `distributed_v2`
 * records). Returns the shard JSON + its content-addressed CID. Anyone can
 * fetch this — combined with the author's offline shard 1, the work can be
 * reconstructed by a third party without trusting AEVION.
 */
quantumShieldRouter.get("/:id/witness", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT "shieldId","shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid","createdAt"
       FROM "QuantumShieldDistribution" WHERE "shieldId" = $1 AND "shardIndex" = 3`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "No witness shard for this record" });
    }
    const w = rows[0] as Record<string, unknown>;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      shieldId: w.shieldId,
      shard: {
        index: w.shardIndex,
        sssShare: w.sssShare,
        hmac: w.hmac,
        hmacKeyVersion: w.hmacKeyVersion,
      },
      cid: w.witnessCid,
      createdAt: w.createdAt,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] witness error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch witness shard" });
  }
});

/**
 * POST /:id/reconstruct
 *
 * Full Shamir Lagrange reconstruction + Ed25519 probe-sign verification.
 * Mirrors POST /api/pipeline/reconstruct but lives under /quantum-shield
 * for consumers that don't want to go through pipeline. Never returns the
 * private key — only a boolean validity proof.
 */
quantumShieldRouter.post("/:id/reconstruct", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!rateLimit(reconstructRateLimiter, req, res)) return;

  /* Idempotency-Key: same shieldId + same key returns the cached verdict
   * without re-running Lagrange or bumping verifiedCount. Length-bound to
   * keep the index sane. Different payload shapes under the same key are
   * NOT validated here — the verdict is whatever the first call decided.
   * That's fine: the caller's intent for a given (shield,key) pair is "I
   * already asked this question; give me the same answer." */
  const idemRaw = (req.headers["idempotency-key"] || req.headers["Idempotency-Key"]) as
    | string
    | undefined;
  const idemKey =
    typeof idemRaw === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(idemRaw)
      ? idemRaw
      : null;

  if (idemKey) {
    try {
      await ensureShieldTable();
      const cached = await pool.query(
        `SELECT "result" FROM "QuantumShieldIdempotency" WHERE "shieldId" = $1 AND "idempotencyKey" = $2`,
        [req.params.id, idemKey],
      );
      if (cached.rows.length > 0) {
        const cachedResult = JSON.parse(cached.rows[0].result as string);
        return res.status(cachedResult.__status || 200).json({
          ...cachedResult,
          idempotent: "replayed",
        });
      }
    } catch (err) {
      // If lookup fails (e.g. fresh DB), fall through to a normal call.
      console.warn(
        "[QuantumShield] idempotency lookup failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const shardsInput = Array.isArray((req.body as { shards?: unknown[] }).shards)
    ? ((req.body as { shards: unknown[] }).shards as Array<Record<string, unknown>>)
    : [];

  if (shardsInput.length < SHAMIR_THRESHOLD) {
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: "INSUFFICIENT_SHARDS",
      threshold: SHAMIR_THRESHOLD,
    });
  }

  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT "publicKey","legacy" FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        valid: false,
        reconstructed: false,
        reason: "SHIELD_NOT_FOUND",
      });
    }

    const row = rows[0] as { publicKey: string | null; legacy: boolean };

    if (row.legacy === true) {
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "LEGACY_RECORD",
      });
    }

    if (!row.publicKey) {
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "RECONSTRUCTION_FAILED",
      });
    }

    const result = combineAndVerify(
      shardsInput as Parameters<typeof combineAndVerify>[0],
      req.params.id,
      row.publicKey,
    );

    if (!result.ok) {
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: result.reason ?? "RECONSTRUCTION_FAILED",
      });
    }

    // Bookkeeping: bump verifiedCount + lastVerifiedAt. Best-effort.
    await pool.query(
      `UPDATE "QuantumShield"
       SET "verifiedCount" = COALESCE("verifiedCount",0) + 1,
           "lastVerifiedAt" = NOW()
       WHERE "id" = $1`,
      [req.params.id],
    );

    const success = {
      valid: true,
      reconstructed: true,
      shieldId: req.params.id,
      verifiedAt: new Date().toISOString(),
    };
    void audit(req.params.id, "reconstruct", req, { shardCount: shardsInput.length, idempotent: !!idemKey });
    {
      const ownerLookup = await pool.query(
        `SELECT "ownerUserId" FROM "QuantumShield" WHERE "id" = $1`,
        [req.params.id],
      );
      const owner = (ownerLookup.rows?.[0] as { ownerUserId: string | null } | undefined)
        ?.ownerUserId;
      fireShieldWebhook(pool, owner, "shield.reconstructed", {
        id: req.params.id,
        shardCount: shardsInput.length,
        idempotent: !!idemKey,
      });
    }
    if (idemKey) {
      try {
        await pool.query(
          `INSERT INTO "QuantumShieldIdempotency" ("id","shieldId","idempotencyKey","result")
           VALUES ($1,$2,$3,$4)
           ON CONFLICT ("shieldId","idempotencyKey") DO NOTHING`,
          [
            crypto.randomUUID(),
            req.params.id,
            idemKey,
            JSON.stringify({ ...success, __status: 200 }),
          ],
        );
      } catch {
        /* race / DB hiccup — non-fatal, response still goes out */
      }
    }
    return res.status(200).json(success);
  } catch (err) {
    console.error(
      `[QuantumShield] reconstruct error: ${err instanceof Error ? err.message : String(err)}`,
    );
    captureShieldError(err, { route: "reconstruct", shieldId: req.params.id });
    return res.status(500).json({
      valid: false,
      reconstructed: false,
      reason: "INTERNAL_ERROR",
    });
  }
});

quantumShieldRouter.post("/:id/verify", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!rateLimit(verifyRateLimiter, req, res)) return;
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const r = rows[0] as Record<string, unknown>;
    const shards = parseShards(r.shards, { shieldId: r.id as string });
    const now = new Date().toISOString();
    const updatedShards = shards.map((s) => ({ ...s, lastVerified: now }));
    // HMAC-check every stored shard. If any fails, mark suspicious.
    let hmacOk = 0;
    for (const s of updatedShards) {
      if (verifyShardHmac(s, req.params.id)) hmacOk += 1;
    }
    await pool.query(
      `UPDATE "QuantumShield" SET "shards" = $1, "lastVerifiedAt" = NOW() WHERE "id" = $2`,
      [JSON.stringify(updatedShards), req.params.id],
    );
    res.json({
      success: true,
      valid: true,
      verifiedAt: now,
      activeShards: updatedShards.length,
      hmacValidShards: hmacOk,
      threshold: r.threshold,
      secure: hmacOk >= (r.threshold as number),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] verify error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to verify shards" });
  }
});

/**
 * @deprecated Legacy "verify shards by string match" endpoint. Does NOT
 * perform Shamir reconstruction. Use `POST /api/quantum-shield/:id/reconstruct`
 * (or `POST /api/pipeline/reconstruct`) for authenticated reconstruction.
 * Kept for backward compatibility; will be removed in a future release.
 */
quantumShieldRouter.post("/verify", async (req, res) => {
  if (!rateLimit(verifyRateLimiter, req, res)) return;
  try {
    await ensureShieldTable();
    const { recordId, shards: shardInputs } = req.body as {
      recordId?: string;
      shards?: unknown[];
    };
    if (recordId) {
      const { rows } = await pool.query(
        `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
        [recordId],
      );
      if (rows.length === 0) {
        return res.status(404).json({
          error: "Record not found",
          valid: false,
          deprecated: true,
        });
      }
      const r = rows[0] as Record<string, unknown>;
      const storedShards = parseShards(r.shards, { shieldId: recordId });
      const inputs = Array.isArray(shardInputs) ? shardInputs : [];

      // Preferred path: if inputs look like AuthenticatedShard objects, run
      // HMAC verification (does not reconstruct, but at least catches tamper).
      let hmacValidCount = 0;
      for (const input of inputs) {
        if (
          input &&
          typeof input === "object" &&
          typeof (input as { sssShare?: unknown }).sssShare === "string"
        ) {
          const shardLike = input as {
            index: number;
            sssShare: string;
            hmac: string;
            hmacKeyVersion: number;
          };
          if (verifyShardHmac(shardLike, recordId)) {
            hmacValidCount += 1;
          }
        }
      }

      // Legacy path: string match against stored shard fields (for old clients).
      const matchCount = inputs.filter((input) =>
        typeof input === "string"
          ? storedShards.some(
              (s) =>
                (s as { sssShare?: string }).sssShare === input ||
                (s as unknown as { data?: string }).data === input ||
                (s as unknown as { id?: string }).id === input,
            )
          : false,
      ).length;

      const effectiveMatches = Math.max(hmacValidCount, matchCount);
      const valid = effectiveMatches >= (r.threshold as number);
      return res.json({
        valid,
        matched: effectiveMatches,
        threshold: r.threshold,
        recovered: valid,
        recordId,
        deprecated: true,
        note: "Use POST /api/quantum-shield/:id/reconstruct for authenticated reconstruction (combines shards via Lagrange interpolation and re-signs with recovered Ed25519 key).",
      });
    }
    res.json({
      valid: false,
      error: "recordId required",
      deprecated: true,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] verify error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Verification failed", deprecated: true });
  }
});

/**
 * POST /:id/revoke — mark a record as revoked without deleting it.
 * Permission: owner or admin. Status change is logged in QuantumShieldAudit.
 * Re-revocation is idempotent (200 with status: "already-revoked").
 */
quantumShieldRouter.post("/:id/revoke", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { rows } = await pool.query(
      `SELECT "ownerUserId","status" FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const row = rows[0] as { ownerUserId: string | null; status: string };
    const isAdmin = auth.role === "admin";
    const isOwner = row.ownerUserId === auth.sub;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (row.status === "revoked") {
      return res.status(200).json({
        success: true,
        shieldId: req.params.id,
        status: "already-revoked",
      });
    }
    const reason =
      typeof (req.body as { reason?: unknown })?.reason === "string"
        ? ((req.body as { reason: string }).reason).slice(0, 500)
        : null;
    await pool.query(
      `UPDATE "QuantumShield" SET "status" = 'revoked' WHERE "id" = $1`,
      [req.params.id],
    );
    void audit(req.params.id, "revoke", req, { reason, admin: isAdmin, owner: isOwner }, auth.sub);
    fireShieldWebhook(pool, row.ownerUserId, "shield.revoked", {
      id: req.params.id,
      reason,
      admin: isAdmin,
      owner: isOwner,
    });
    res.json({
      success: true,
      shieldId: req.params.id,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] revoke error:",
      err instanceof Error ? err.message : String(err),
    );
    captureShieldError(err, { route: "revoke", shieldId: req.params.id });
    res.status(500).json({ error: "Failed to revoke shield record" });
  }
});

/**
 * GET /:id/audit — paginated audit trail for a record.
 * Permission: owner of the record or admin. Public projection has no audit.
 */
quantumShieldRouter.get("/:id/audit", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { rows: ownerRows } = await pool.query(
      `SELECT "ownerUserId" FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (ownerRows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const ownerUserId = (ownerRows[0] as { ownerUserId: string | null }).ownerUserId;
    const isAdmin = auth.role === "admin";
    const isOwner = !!auth.sub && ownerUserId === auth.sub;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { rows } = await pool.query(
      `SELECT "id","event","actorUserId","actorIp","details","createdAt"
       FROM "QuantumShieldAudit" WHERE "shieldId" = $1
       ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset],
    );
    res.json({
      shieldId: req.params.id,
      entries: rows,
      limit,
      offset,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] audit list error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

quantumShieldRouter.delete("/:id", async (req, res) => {
  if (RESERVED_IDS.has(req.params.id)) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await ensureShieldTable();
    const auth = verifyBearerOptional(req);
    // Permission: owner or admin. If row has no ownerUserId (legacy /
    // anonymous create), allow only admin to delete.
    const { rows: existing } = await pool.query(
      `SELECT "ownerUserId" FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const ownerUserId = (existing[0] as { ownerUserId: string | null })
      .ownerUserId;
    const isAdmin = auth?.role === "admin";
    const isOwner = !!auth?.sub && ownerUserId === auth.sub;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await pool.query(
      `DELETE FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    void audit(req.params.id, "delete", req, { admin: isAdmin, owner: isOwner }, auth?.sub || null);
    fireShieldWebhook(pool, ownerUserId, "shield.deleted", {
      id: req.params.id,
      admin: isAdmin,
      owner: isOwner,
    });
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error(
      "[QuantumShield] delete error:",
      err instanceof Error ? err.message : String(err),
    );
    captureShieldError(err, { route: "delete", shieldId: req.params.id, actorUserId: verifyBearerOptional(req)?.sub });
    res.status(500).json({ error: "Failed to delete shield record" });
  }
});

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
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
  clientIp,
  createInMemoryRateLimiter,
} from "../lib/rateLimit/inMemoryWindow";
// _legacyGenerateShards is intentionally imported (not called) to preserve the
// symbol export for any legacy test or analytics code that references it.
import { _legacyGenerateShards } from "../lib/shamir/legacy";
void _legacyGenerateShards;

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
  "openapi.json",
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
      `SELECT "id","objectId","objectTitle","algorithm","threshold","totalShards","publicKey","signature","status","legacy","hmac_key_version","verifiedCount","lastVerifiedAt","distribution_policy","createdAt"
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
    // Public projection: no shards, no ownerUserId. Just enough to render
    // a shareable verify card.
    res.setHeader("Cache-Control", "public, max-age=60");
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
    });
  } catch (err) {
    console.error(
      "[QuantumShield] public error:",
      err instanceof Error ? err.message : String(err),
    );
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
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error(
      "[QuantumShield] delete error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to delete shield record" });
  }
});

/**
 * VeilNetX Ledger — privacy-blinded settlement ledger for the AEVION fintech
 * ecosystem. Mounts under /api/veilnetx-ledger to coexist with the waitlist
 * surface at /api/veilnetx.
 *
 * Per AEVION fintech manifest: secure financial transport / settlement layer.
 * Provides hash-only transaction registration with a tamper-evident Merkle
 * chain over hashes, so cross-product fund movements (Bureau cert payment →
 * QPayNet escrow → QGood donation → QMaskCard settle) all share one audit
 * trail.
 *
 * What this IS:
 *  - Append-only Postgres ledger with SHA-256 chain over (prevHash, payload).
 *  - Privacy-blinded participants — sender/receiver stored as HMAC-blinded
 *    hashes; same identity yields same blinded value across entries (for
 *    analytics) but unreversible without the server-side salt.
 *  - QSign-compatible proof envelope per entry (callers can re-sign via
 *    /api/qsign/sign for legal anchoring).
 *
 * What this is NOT:
 *  - Not a layer-1 chain. No consensus / PoW / PoS.
 *  - Not a zk system. Privacy comes from blinding + no PII storage.
 *
 * Endpoints:
 *   GET  /api/veilnetx-ledger/health
 *   POST /api/veilnetx-ledger/entries       — register a transaction (auth)
 *   GET  /api/veilnetx-ledger/entries       — list (filter by module / blindedFrom)
 *   GET  /api/veilnetx-ledger/entries/:id   — fetch + verify single entry
 *   GET  /api/veilnetx-ledger/chain/head    — chain tip hash + length
 *   GET  /api/veilnetx-ledger/chain/verify  — recompute full chain (≤10k)
 *   GET  /api/veilnetx-ledger/stats         — per-module roll-up
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import rateLimit from "express-rate-limit";

export const veilnetxLedgerRouter = Router();

const writeLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const readLimit = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });

const KNOWN_MODULES = new Set([
  "qpaynet", "qgood", "qmaskcard", "bureau", "qbuild",
  "qsign", "qright", "aev", "qcontract", "qtrade", "external",
]);
const KIND_OPTIONS = new Set([
  "transfer", "deposit", "withdrawal", "fee", "refund",
  "donation", "escrow-lock", "escrow-release", "mint", "burn", "settlement",
]);

const GENESIS_HASH = "0".repeat(64);

function getSalt(): string {
  const s = process.env.VEILNETX_SALT?.trim() || process.env.SHARD_HMAC_SECRET?.trim();
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("VEILNETX_SALT env is required in production");
    return "veilnetx-dev-salt-change-in-prod";
  }
  return s;
}

function blind(identifier: string): string {
  if (!identifier) return "";
  return crypto.createHmac("sha256", getSalt()).update(identifier.toLowerCase().trim()).digest("hex");
}

function entryHash(input: {
  prevHash: string;
  module: string;
  kind: string;
  blindedFrom: string;
  blindedTo: string;
  amountCents: string;
  currency: string;
  metaJson: string;
  createdAt: string;
}): string {
  const payload = [
    input.prevHash, input.module, input.kind,
    input.blindedFrom, input.blindedTo,
    input.amountCents, input.currency,
    input.metaJson, input.createdAt,
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "VeilNetXLedger" (
      "id"              TEXT PRIMARY KEY,
      "sequenceNumber"  BIGSERIAL UNIQUE NOT NULL,
      "module"          TEXT NOT NULL,
      "kind"            TEXT NOT NULL,
      "blindedFrom"     TEXT NOT NULL,
      "blindedTo"       TEXT NOT NULL,
      "amountCents"     BIGINT NOT NULL,
      "currency"        TEXT NOT NULL DEFAULT 'USD',
      "meta"            JSONB NOT NULL DEFAULT '{}'::jsonb,
      "prevHash"        TEXT NOT NULL,
      "entryHash"       TEXT NOT NULL UNIQUE,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VeilNetXLedger_module_idx" ON "VeilNetXLedger" ("module", "createdAt");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "VeilNetXLedger_blindedFrom_idx" ON "VeilNetXLedger" ("blindedFrom");`);
  tablesReady = true;
}

async function getChainHead(): Promise<string> {
  const pool = getPool();
  const r = await pool.query(
    `SELECT "entryHash" FROM "VeilNetXLedger" ORDER BY "sequenceNumber" DESC LIMIT 1`,
  );
  if (r.rowCount === 0) return GENESIS_HASH;
  return (r.rows[0] as { entryHash: string }).entryHash;
}

veilnetxLedgerRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "veilnetx-ledger", timestamp: new Date().toISOString() });
});

veilnetxLedgerRouter.post("/entries", writeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const { module, kind, fromIdentifier, toIdentifier, amountCents, currency = "USD", meta } = req.body || {};
    if (!KNOWN_MODULES.has(module)) {
      return res.status(400).json({ error: "invalid_module", allowed: Array.from(KNOWN_MODULES) });
    }
    if (!KIND_OPTIONS.has(kind)) {
      return res.status(400).json({ error: "invalid_kind", allowed: Array.from(KIND_OPTIONS) });
    }
    let amount: bigint;
    try { amount = BigInt(String(amountCents)); }
    catch { return res.status(400).json({ error: "amountCents must be integer string or number" }); }
    if (amount === BigInt(0) || amount < BigInt(-1_000_000_000_000) || amount > BigInt(1_000_000_000_000)) {
      return res.status(400).json({ error: "amountCents out of range or zero" });
    }
    const blindedFrom = blind(String(fromIdentifier ?? ""));
    const blindedTo = blind(String(toIdentifier ?? ""));
    if (!blindedFrom && !blindedTo) {
      return res.status(400).json({ error: "fromIdentifier or toIdentifier required" });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const safeMeta = (meta && typeof meta === "object") ? meta : {};
    const metaJson = JSON.stringify(safeMeta);

    // Serialize head-read + insert via Postgres advisory lock — same key as
    // lib/ecosystemEvents.ts so HTTP-path and lib-path emits never race.
    // Without this, bursty concurrent emits read same head → 2+ entries
    // claim same prevHash → chain integrity breaks. See VEILNETX_CHAIN_LOCK_KEY.
    const pool = getPool();
    const client = await pool.connect();
    let hash: string;
    let prevHash: string;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", ["6218442231490103630"]);
      const headR = await client.query(
        `SELECT "entryHash" FROM "VeilNetXLedger" ORDER BY "sequenceNumber" DESC LIMIT 1`,
      );
      prevHash = headR.rowCount === 0
        ? GENESIS_HASH
        : (headR.rows[0] as { entryHash: string }).entryHash;
      hash = entryHash({
        prevHash, module, kind,
        blindedFrom, blindedTo,
        amountCents: amount.toString(),
        currency: String(currency).toUpperCase(),
        metaJson, createdAt,
      });
      await client.query(
        `INSERT INTO "VeilNetXLedger" ("id","module","kind","blindedFrom","blindedTo","amountCents","currency","meta","prevHash","entryHash","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
        [id, module, kind, blindedFrom, blindedTo, amount.toString(), String(currency).toUpperCase(), metaJson, prevHash, hash, createdAt],
      );
      await client.query("COMMIT");
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      throw e;
    } finally {
      client.release();
    }
    res.status(201).json({
      id, entryHash: hash, prevHash, module, kind,
      blindedFrom, blindedTo,
      amountCents: amount.toString(),
      currency: String(currency).toUpperCase(),
      createdAt,
    });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] entry_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "entry_failed" });
  }
});

veilnetxLedgerRouter.get("/entries", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const moduleQ = String(req.query.module ?? "").trim();
    const fromIdentifier = String(req.query.fromIdentifier ?? "").trim();
    const params: unknown[] = [];
    const where: string[] = [];
    if (KNOWN_MODULES.has(moduleQ)) {
      params.push(moduleQ);
      where.push(`"module" = $${params.length}`);
    }
    if (fromIdentifier) {
      params.push(blind(fromIdentifier));
      where.push(`"blindedFrom" = $${params.length}`);
    }
    params.push(limit);
    const pool = getPool();
    const r = await pool.query(`
      SELECT "id","sequenceNumber","module","kind","blindedFrom","blindedTo","amountCents","currency","meta","prevHash","entryHash","createdAt"
      FROM "VeilNetXLedger"
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY "sequenceNumber" DESC
      LIMIT $${params.length}
    `, params);
    res.json({ entries: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] entries_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "entries_list_failed" });
  }
});

veilnetxLedgerRouter.get("/entries/:id", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(
      `SELECT "id","sequenceNumber","module","kind","blindedFrom","blindedTo","amountCents","currency","meta","prevHash","entryHash","createdAt"
       FROM "VeilNetXLedger" WHERE "id" = $1 LIMIT 1`,
      [String(req.params.id || "")],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "entry_not_found" });
    const row = r.rows[0] as Record<string, unknown>;
    const recomputed = entryHash({
      prevHash: String(row.prevHash),
      module: String(row.module),
      kind: String(row.kind),
      blindedFrom: String(row.blindedFrom),
      blindedTo: String(row.blindedTo),
      amountCents: String(row.amountCents),
      currency: String(row.currency),
      metaJson: JSON.stringify(row.meta ?? {}),
      createdAt: new Date(String(row.createdAt)).toISOString(),
    });
    res.json({ entry: row, integrity: recomputed === row.entryHash ? "ok" : "broken", recomputedHash: recomputed });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] entry_get_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "entry_get_failed" });
  }
});

veilnetxLedgerRouter.get("/search", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const rawHash = String(req.query.hash ?? "").trim().toLowerCase();
    if (!rawHash) {
      return res.status(400).json({ error: "hash prefix must be >= 4 hex chars" });
    }
    if (rawHash.length < 4) {
      return res.status(400).json({ error: "hash prefix must be >= 4 hex chars" });
    }
    if (!/^[a-f0-9]{4,64}$/.test(rawHash)) {
      return res.status(400).json({ error: "hash prefix must be >= 4 hex chars" });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 50);
    const pool = getPool();
    const r = await pool.query(
      `SELECT "id","sequenceNumber","module","kind","blindedFrom","blindedTo","amountCents","currency","prevHash","entryHash","createdAt"
       FROM "VeilNetXLedger"
       WHERE "entryHash" LIKE $1 || '%' OR "prevHash" LIKE $1 || '%'
       ORDER BY "sequenceNumber" DESC
       LIMIT $2`,
      [rawHash, limit],
    );
    res.json({
      query: { hash: rawHash, limit },
      matches: r.rows,
      total: r.rowCount,
    });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] search_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "search_failed" });
  }
});

veilnetxLedgerRouter.get("/chain/head", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(
      `SELECT "sequenceNumber","entryHash","createdAt" FROM "VeilNetXLedger" ORDER BY "sequenceNumber" DESC LIMIT 1`,
    );
    if (r.rowCount === 0) return res.json({ head: GENESIS_HASH, length: 0 });
    const row = r.rows[0] as { sequenceNumber: number; entryHash: string; createdAt: Date };
    res.json({ head: row.entryHash, length: Number(row.sequenceNumber), tipAt: row.createdAt });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] chain_head_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "chain_head_failed" });
  }
});

veilnetxLedgerRouter.get("/chain/verify", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(
      `SELECT "id","sequenceNumber","module","kind","blindedFrom","blindedTo","amountCents","currency","meta","prevHash","entryHash","createdAt"
       FROM "VeilNetXLedger" ORDER BY "sequenceNumber" ASC LIMIT 10000`,
    );
    let prevHash = GENESIS_HASH;
    let brokenAt: number | null = null;
    for (const row of r.rows as Array<Record<string, unknown>>) {
      const recomputed = entryHash({
        prevHash,
        module: String(row.module),
        kind: String(row.kind),
        blindedFrom: String(row.blindedFrom),
        blindedTo: String(row.blindedTo),
        amountCents: String(row.amountCents),
        currency: String(row.currency),
        metaJson: JSON.stringify(row.meta ?? {}),
        createdAt: new Date(String(row.createdAt)).toISOString(),
      });
      if (recomputed !== row.entryHash || row.prevHash !== prevHash) {
        brokenAt = Number(row.sequenceNumber);
        break;
      }
      prevHash = recomputed;
    }
    res.json({
      verified: brokenAt === null,
      brokenAt,
      length: r.rowCount,
      head: prevHash,
    });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] chain_verify_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "chain_verify_failed" });
  }
});

veilnetxLedgerRouter.get("/stats", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(`
      SELECT "module",
             COUNT(*)::int AS entries,
             COALESCE(SUM("amountCents"),0)::bigint AS volume_cents
      FROM "VeilNetXLedger"
      GROUP BY "module"
      ORDER BY entries DESC
    `);
    const totalR = await pool.query(`SELECT COUNT(*)::int AS total FROM "VeilNetXLedger"`);
    res.json({
      service: "veilnetx-ledger",
      total: Number((totalR.rows[0] as { total: number }).total),
      perModule: r.rows,
    });
  } catch (err: unknown) {
    console.error("[veilnetx-ledger] stats_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "stats_failed" });
  }
});

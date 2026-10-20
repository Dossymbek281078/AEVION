"use strict";
/**
 * Cross-product ecosystem event emitter.
 *
 * Per AEVION fintech manifest: VeilNetX is the settlement ledger, Z-Tide
 * is the engagement/reputation layer. Every meaningful fund movement or
 * contribution across the ecosystem should leave a trace in both.
 *
 * These helpers are fire-and-forget — they MUST NOT throw or delay the
 * caller's main flow. If the ecosystem ledger is temporarily unavailable,
 * the originating action (deposit, donation, etc.) still succeeds.
 *
 * Direct in-process DB writes (no HTTP roundtrip) to avoid latency.
 * The VeilNetX chain hash is computed inline.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VEILNETX_CHAIN_LOCK_KEY = void 0;
exports.canonicalJson = canonicalJson;
exports.emitVeilNetXEntry = emitVeilNetXEntry;
exports.emitZTideEvent = emitZTideEvent;
exports.emitEcosystemEvent = emitEcosystemEvent;
const node_crypto_1 = __importDefault(require("node:crypto"));
const dbPool_1 = require("./dbPool");
const GENESIS_HASH = "0".repeat(64);
// Stable Postgres advisory-lock key for the VeilNetX chain head. The SAME
// constant MUST be used in routes/veilnetxLedger.ts so HTTP-path emits and
// library-path emits serialize on the same lock — without this, bursty
// concurrent emits race on prevHash and break chain integrity.
// Value derived from ASCII "VLXCHAIN" packed into a bigint (computed once).
exports.VEILNETX_CHAIN_LOCK_KEY = "6218442231490103630";
function getSalt() {
    return process.env.VEILNETX_SALT || process.env.SHARD_HMAC_SECRET || "veilnetx-dev-salt-change-in-prod";
}
function blind(identifier) {
    if (!identifier)
        return "";
    return node_crypto_1.default.createHmac("sha256", getSalt()).update(identifier.toLowerCase().trim()).digest("hex");
}
/**
 * Canonical JSON — keys sorted recursively. The chain hash MUST be computed
 * over this representation, not over JSON.stringify(input), because Postgres
 * JSONB silently reorders keys on storage. Without canonicalization, the
 * insert-time hash and the verify-time hash (read from JSONB) disagree even
 * when content is identical, and /chain/verify reports a false break.
 */
function canonicalJson(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return "[" + value.map(canonicalJson).join(",") + "]";
    const obj = value;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}
function entryHash(input) {
    const payload = [
        input.prevHash, input.module, input.kind,
        input.blindedFrom, input.blindedTo,
        input.amountCents, input.currency,
        input.metaJson, input.createdAt,
    ].join("|");
    return node_crypto_1.default.createHash("sha256").update(payload).digest("hex");
}
let ensuredLedger = false;
async function ensureLedger() {
    if (ensuredLedger)
        return;
    const pool = (0, dbPool_1.getPool)();
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
    ensuredLedger = true;
}
let ensuredZTide = false;
async function ensureZTide() {
    if (ensuredZTide)
        return;
    const pool = (0, dbPool_1.getPool)();
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
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "ZTideScore" (
      "userId"       TEXT PRIMARY KEY,
      "score"        BIGINT NOT NULL DEFAULT 0,
      "eventCount"   INT NOT NULL DEFAULT 0,
      "rank"         TEXT NOT NULL DEFAULT 'seedling',
      "lastEventAt"  TIMESTAMPTZ
    );
  `);
    ensuredZTide = true;
}
/**
 * Fire-and-forget: append a transaction to the VeilNetX ledger.
 * Never throws. Returns the entry id on success, null on failure.
 */
async function emitVeilNetXEntry(input) {
    await ensureLedger();
    const pool = (0, dbPool_1.getPool)();
    const id = node_crypto_1.default.randomUUID();
    const createdAt = new Date().toISOString();
    const blindedFrom = blind(String(input.fromIdentifier ?? ""));
    const blindedTo = blind(String(input.toIdentifier ?? ""));
    if (!blindedFrom && !blindedTo)
        return null;
    let amount;
    try {
        amount = BigInt(String(input.amountCents));
    }
    catch {
        return null;
    }
    if (amount === BigInt(0))
        return null;
    // Canonical (key-sorted) so the verify-time hash, which reads JSONB after
    // Postgres reorders keys, produces the same bytes as the insert-time hash.
    const metaJson = canonicalJson(input.meta ?? {});
    const currency = String(input.currency ?? "USD").toUpperCase();
    // Serialize the head-read + insert via a Postgres transactional advisory
    // lock — same lock key as veilnetxLedger.ts /entries handler so concurrent
    // emits from BOTH paths never see the same prevHash. Without this, bursty
    // fire-and-forget emits race and break chain integrity.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [exports.VEILNETX_CHAIN_LOCK_KEY]);
        const headR = await client.query(`SELECT "entryHash" FROM "VeilNetXLedger" ORDER BY "sequenceNumber" DESC LIMIT 1`);
        const prevHash = headR.rowCount === 0
            ? GENESIS_HASH
            : headR.rows[0].entryHash;
        const hash = entryHash({
            prevHash, module: input.module, kind: input.kind,
            blindedFrom, blindedTo,
            amountCents: amount.toString(),
            currency, metaJson, createdAt,
        });
        await client.query(`INSERT INTO "VeilNetXLedger" ("id","module","kind","blindedFrom","blindedTo","amountCents","currency","meta","prevHash","entryHash","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`, [id, input.module, input.kind, blindedFrom, blindedTo, amount.toString(), currency, metaJson, prevHash, hash, createdAt]);
        await client.query("COMMIT");
        return id;
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch { /* ignore */ }
        // Fire-and-forget contract: never throw to caller.
        console.warn("[ecosystemEvents] veilnetx emit failed:", err instanceof Error ? err.message : err);
        return null;
    }
    finally {
        client.release();
    }
}
// (lock key constant declared at top of file)
// Per-kind weights mirror those in ztide.ts to keep behavior consistent
// even if a caller bypasses the HTTP layer.
const ZTIDE_WEIGHTS = {
    "login-streak": 1,
    "helpful-comment": 2,
    "bureau-cert": 10,
    "build-hire": 15,
    "qgood-donation": 5,
    "qcontract-share": 3,
    "qsign-sign": 2,
    "qright-protect": 5,
    "qpaynet-payout": 3,
    "referral-success": 20,
};
const ZTIDE_RANK_THRESHOLDS = [
    { id: "seedling", min: 0 },
    { id: "current", min: 50 },
    { id: "wave", min: 200 },
    { id: "stream", min: 750 },
    { id: "tide", min: 2500 },
    { id: "river", min: 8000 },
    { id: "ocean", min: 25000 },
];
function rankIdFor(score) {
    let id = "seedling";
    for (const r of ZTIDE_RANK_THRESHOLDS) {
        if (score >= r.min)
            id = r.id;
        else
            break;
    }
    return id;
}
/**
 * Fire-and-forget: record a Z-Tide contribution event for a user.
 * Updates rolling score atomically. Never throws.
 */
async function emitZTideEvent(input) {
    try {
        if (!input.userId)
            return null;
        const baseWeight = ZTIDE_WEIGHTS[input.kind];
        if (typeof baseWeight !== "number")
            return null;
        const weight = (typeof input.weightOverride === "number"
            && Number.isFinite(input.weightOverride)
            && input.weightOverride >= 1
            && input.weightOverride <= 1000)
            ? Math.round(input.weightOverride)
            : baseWeight;
        await ensureZTide();
        const pool = (0, dbPool_1.getPool)();
        const id = node_crypto_1.default.randomUUID();
        const safeMeta = (input.meta && typeof input.meta === "object") ? input.meta : {};
        await pool.query(`INSERT INTO "ZTideEvent" ("id","userId","kind","sourceModule","weight","meta")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [id, input.userId, input.kind, input.sourceModule, weight, JSON.stringify(safeMeta)]);
        const upR = await pool.query(`INSERT INTO "ZTideScore" ("userId","score","eventCount","lastEventAt","rank")
       VALUES ($1, $2, 1, NOW(), 'seedling')
       ON CONFLICT ("userId") DO UPDATE SET
         "score" = "ZTideScore"."score" + EXCLUDED."score",
         "eventCount" = "ZTideScore"."eventCount" + 1,
         "lastEventAt" = NOW()
       RETURNING "score"`, [input.userId, weight]);
        const newScore = Number(upR.rows[0].score);
        const newRank = rankIdFor(newScore);
        await pool.query(`UPDATE "ZTideScore" SET "rank" = $1 WHERE "userId" = $2 AND "rank" != $1`, [newRank, input.userId]);
        return id;
    }
    catch (err) {
        console.warn("[ecosystemEvents] ztide emit failed:", err instanceof Error ? err.message : err);
        return null;
    }
}
/**
 * Convenience: emit both VeilNetX (financial trail) and Z-Tide (reputation)
 * for a single event. Used by routes that have both money and a contributor
 * (donations, payouts, etc.). Fire-and-forget.
 */
function emitEcosystemEvent(input) {
    // Fire and forget — never await from caller.
    void emitVeilNetXEntry({ module: input.module, ...input.ledger }).catch(() => null);
    if (input.reputation) {
        void emitZTideEvent({
            sourceModule: input.module,
            userId: input.reputation.userId,
            kind: input.reputation.kind,
            weightOverride: input.reputation.weightOverride,
            meta: input.reputation.meta,
        }).catch(() => null);
    }
}

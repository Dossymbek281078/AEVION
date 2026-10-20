"use strict";
// Storage driver for the ecosystem ledger (royalty events, chess prizes,
// planet certs).
//
// Two backends:
//   - Postgres (when DATABASE_URL is set) — sql/ecosystem-schema.sql tables
//   - JSON file (.aevion-data/ecosystem.json) — dev fallback, atomic writes
//
// The driver exposes a uniform load() / persist() surface so route code in
// src/routes/ecosystem.ts and src/routes/cyberchess.ts (and the planet/
// qright webhook receivers) doesn't care which storage is active. Routes
// keep the in-memory arrays as a write-through cache for read latency;
// persist() flushes the cache after a mutation.
//
// Schema bootstrap is run once at first load when on Postgres — same DDL
// as scripts/migrate-ecosystem-to-pg.mjs uses, so JSON-then-Postgres flips
// happen without extra steps as long as DATABASE_URL is set on prod.
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTournaments = loadTournaments;
exports.saveTournament = saveTournament;
exports.markTournamentFinalized = markTournamentFinalized;
exports.loadSnapshot = loadSnapshot;
exports.persistSnapshot = persistSnapshot;
exports.describeBackend = describeBackend;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const jsonFileStore_1 = require("./jsonFileStore");
const dbPool_1 = require("./dbPool");
const STORE_REL = "ecosystem.json";
const SCHEMA_PATH = (0, node_path_1.resolve)(process.cwd(), "sql", "ecosystem-schema.sql");
function isPgConfigured() {
    return !!process.env.DATABASE_URL?.trim();
}
let schemaApplied = false;
async function ensureSchema() {
    if (schemaApplied)
        return;
    const pool = (0, dbPool_1.getPool)();
    // Embedded fallback: if sql/ecosystem-schema.sql isn't shipped with the
    // build artifact, apply the same DDL inline. Production deploys should
    // include the file; this just keeps dev/test bootstrapping resilient.
    let sql;
    try {
        sql = await (0, promises_1.readFile)(SCHEMA_PATH, "utf-8");
    }
    catch {
        sql = INLINE_SCHEMA;
    }
    await pool.query(sql);
    schemaApplied = true;
}
const INLINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS ecosystem_royalty_events (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  product_key TEXT NOT NULL,
  period TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  transfer_id TEXT,
  source TEXT NOT NULL DEFAULT 'qright',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_royalty_email_paid_at
  ON ecosystem_royalty_events (email, paid_at DESC);

CREATE TABLE IF NOT EXISTS ecosystem_chess_prizes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  tournament_id TEXT NOT NULL,
  place INTEGER NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  transfer_id TEXT,
  source TEXT NOT NULL DEFAULT 'cyberchess',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chess_email_finalized_at
  ON ecosystem_chess_prizes (email, finalized_at DESC);

CREATE TABLE IF NOT EXISTS ecosystem_planet_certs (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  artifact_version_id TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  certified_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'planet',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ecosystem_planet_certs ADD COLUMN IF NOT EXISTS transfer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_planet_email_certified_at
  ON ecosystem_planet_certs (email, certified_at DESC);

CREATE TABLE IF NOT EXISTS cyberchess_tournaments (
  id TEXT PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  format TEXT NOT NULL,
  prize_pool NUMERIC(18,2) NOT NULL,
  entries INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cyberchess_tournaments_status_starts
  ON cyberchess_tournaments (status, starts_at);
`;
const TOURNAMENTS_REL = "cyberchess-tournaments.json";
async function loadTournaments() {
    if (isPgConfigured()) {
        await ensureSchema();
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`SELECT id, starts_at AS "startsAt", format,
              prize_pool::float8 AS "prizePool", entries, capacity, status
       FROM cyberchess_tournaments WHERE status = 'upcoming'
       ORDER BY starts_at ASC`);
        return r.rows.map((row) => ({
            ...row,
            startsAt: toIso(row.startsAt),
        }));
    }
    const data = await (0, jsonFileStore_1.readJsonFile)(TOURNAMENTS_REL, { items: [] });
    return Array.isArray(data.items)
        ? data.items.filter((t) => t.status === "upcoming")
        : [];
}
async function saveTournament(t) {
    if (isPgConfigured()) {
        await ensureSchema();
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`INSERT INTO cyberchess_tournaments
        (id, starts_at, format, prize_pool, entries, capacity, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         starts_at = EXCLUDED.starts_at,
         format = EXCLUDED.format,
         prize_pool = EXCLUDED.prize_pool,
         entries = EXCLUDED.entries,
         capacity = EXCLUDED.capacity,
         status = EXCLUDED.status`, [t.id, t.startsAt, t.format, t.prizePool, t.entries, t.capacity, t.status]);
        return;
    }
    // JSON fallback: read, upsert by id, write back.
    const data = await (0, jsonFileStore_1.readJsonFile)(TOURNAMENTS_REL, { items: [] });
    const items = Array.isArray(data.items) ? data.items : [];
    const idx = items.findIndex((x) => x.id === t.id);
    if (idx >= 0)
        items[idx] = t;
    else
        items.push(t);
    await (0, jsonFileStore_1.writeJsonFile)(TOURNAMENTS_REL, { items });
}
async function markTournamentFinalized(id) {
    if (isPgConfigured()) {
        await ensureSchema();
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`UPDATE cyberchess_tournaments SET status = 'finalized' WHERE id = $1`, [id]);
        return;
    }
    const data = await (0, jsonFileStore_1.readJsonFile)(TOURNAMENTS_REL, { items: [] });
    const items = Array.isArray(data.items) ? data.items : [];
    const t = items.find((x) => x.id === id);
    if (t) {
        t.status = "finalized";
        await (0, jsonFileStore_1.writeJsonFile)(TOURNAMENTS_REL, { items });
    }
}
async function loadSnapshot() {
    if (isPgConfigured()) {
        await ensureSchema();
        const pool = (0, dbPool_1.getPool)();
        const [r, c, p] = await Promise.all([
            pool.query(`SELECT id, email, product_key AS "productKey", period,
                amount::float8 AS amount, paid_at AS "paidAt",
                transfer_id AS "transferId", source
         FROM ecosystem_royalty_events ORDER BY paid_at`),
            pool.query(`SELECT id, email, tournament_id AS "tournamentId", place,
                amount::float8 AS amount, finalized_at AS "finalizedAt",
                transfer_id AS "transferId", source
         FROM ecosystem_chess_prizes ORDER BY finalized_at`),
            pool.query(`SELECT id, email, artifact_version_id AS "artifactVersionId",
                amount::float8 AS amount, certified_at AS "certifiedAt",
                transfer_id AS "transferId", source
         FROM ecosystem_planet_certs ORDER BY certified_at`),
        ]);
        return {
            royaltyEvents: r.rows.map((row) => ({
                ...row,
                paidAt: toIso(row.paidAt),
            })),
            chessPrizes: c.rows.map((row) => ({
                ...row,
                finalizedAt: toIso(row.finalizedAt),
            })),
            planetCerts: p.rows.map((row) => ({
                ...row,
                certifiedAt: toIso(row.certifiedAt),
            })),
        };
    }
    const data = await (0, jsonFileStore_1.readJsonFile)(STORE_REL, {
        royaltyEvents: [],
        chessPrizes: [],
        planetCerts: [],
    });
    return {
        royaltyEvents: Array.isArray(data.royaltyEvents) ? data.royaltyEvents : [],
        chessPrizes: Array.isArray(data.chessPrizes) ? data.chessPrizes : [],
        planetCerts: Array.isArray(data.planetCerts) ? data.planetCerts : [],
    };
}
function toIso(v) {
    if (v instanceof Date)
        return v.toISOString();
    if (typeof v === "string")
        return v;
    return new Date().toISOString();
}
// Persist a snapshot. Idempotent: the upsert keys on event id, so
// re-running with the same data is a no-op.
async function persistSnapshot(snapshot) {
    if (isPgConfigured()) {
        await ensureSchema();
        const pool = (0, dbPool_1.getPool)();
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (const r of snapshot.royaltyEvents) {
                await client.query(`INSERT INTO ecosystem_royalty_events
            (id, email, product_key, period, amount, paid_at, transfer_id, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`, [r.id, r.email, r.productKey, r.period, r.amount, r.paidAt, r.transferId, r.source]);
            }
            for (const c of snapshot.chessPrizes) {
                await client.query(`INSERT INTO ecosystem_chess_prizes
            (id, email, tournament_id, place, amount, finalized_at, transfer_id, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`, [c.id, c.email, c.tournamentId, c.place, c.amount, c.finalizedAt, c.transferId, c.source]);
            }
            for (const p of snapshot.planetCerts) {
                await client.query(`INSERT INTO ecosystem_planet_certs
            (id, email, artifact_version_id, amount, certified_at, transfer_id, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO NOTHING`, [p.id, p.email, p.artifactVersionId, p.amount, p.certifiedAt, p.transferId, p.source]);
            }
            await client.query("COMMIT");
        }
        catch (err) {
            await client.query("ROLLBACK").catch(() => { });
            throw err;
        }
        finally {
            client.release();
        }
        return;
    }
    await (0, jsonFileStore_1.writeJsonFile)(STORE_REL, snapshot);
}
function describeBackend() {
    return {
        kind: isPgConfigured() ? "postgres" : "json",
        storeRel: STORE_REL,
    };
}

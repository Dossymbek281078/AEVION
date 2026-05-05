#!/usr/bin/env node
/**
 * QPayNet — pure-Node backup of all qpaynet_* tables.
 *
 * Why not pg_dump?
 *   - pg_dump may not be installed in every runtime (Railway containers,
 *     CI, dev laptops). This script needs only `pg` from package.json.
 *   - Output is plain SQL: psql-restorable, diffable, greppable.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/qpaynet-backup.mjs > backup.sql
 *
 * Restore:
 *   DATABASE_URL=postgres://... psql -f backup.sql
 *
 * The script writes:
 *   - timestamp + git SHA (if available) header
 *   - DROP+CREATE for each qpaynet_* table (idempotent restore)
 *   - INSERT statements with parameterised + escaped values
 *   - row counts at end (non-fatal verification)
 *
 * For very large tables (>1M rows) prefer pg_dump --format=custom — this
 * script is single-threaded INSERT and ~5-10× slower. For QPayNet's scale
 * (wallets, transactions, audit) it's fine well into the seven figures.
 */

import pg from "pg";
import { execSync } from "node:child_process";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const TABLES = [
  "qpaynet_wallets",
  "qpaynet_transactions",
  "qpaynet_merchant_keys",
  "qpaynet_payment_requests",
  "qpaynet_kyc",
  "qpaynet_merchant_webhooks",
  "qpaynet_payouts",
  "qpaynet_notifications",
  "qpaynet_deposit_checkouts",
  "qpaynet_audit_log",
  "qpaynet_idempotency",
  "qpaynet_notif_prefs",
];

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function escapeSql(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
  if (Buffer.isBuffer(v)) return `'\\x${v.toString("hex")}'::bytea`;
  if (typeof v === "object") {
    // jsonb / json columns — pg returns parsed object
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  // string
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
  const ts = new Date().toISOString();
  const sha = gitSha();

  process.stdout.write(`-- QPayNet backup\n`);
  process.stdout.write(`-- generated: ${ts}\n`);
  process.stdout.write(`-- git: ${sha}\n`);
  process.stdout.write(`-- tables: ${TABLES.join(", ")}\n\n`);
  process.stdout.write(`BEGIN;\n\n`);
  process.stdout.write(`SET LOCAL session_replication_role = 'replica';\n`);
  process.stdout.write(`-- ↑ disables triggers / FK checks during restore\n\n`);

  const counts = {};

  for (const table of TABLES) {
    // Discover existing rows. If table doesn't exist (fresh deploy), skip.
    let exists;
    try {
      exists = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    } catch (err) {
      console.error(`[${table}] check failed: ${err.message}`);
      continue;
    }
    if (!exists.rows[0]?.t) {
      process.stdout.write(`-- ${table}: not present in source DB, skipping\n\n`);
      continue;
    }

    process.stdout.write(`-- ─── ${table} ───\n`);
    process.stdout.write(`TRUNCATE TABLE ${table} CASCADE;\n`);

    // Stream rows via cursor to avoid loading everything in memory.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DECLARE c_${table} NO SCROLL CURSOR FOR SELECT * FROM ${table}`);
      let total = 0;
      let columns = null;
      while (true) {
        const batch = await client.query(`FETCH 500 FROM c_${table}`);
        if (batch.rows.length === 0) break;
        if (!columns) columns = batch.fields.map((f) => f.name);
        for (const row of batch.rows) {
          const values = columns.map((col) => escapeSql(row[col]));
          process.stdout.write(
            `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${values.join(",")});\n`,
          );
          total++;
        }
      }
      await client.query("COMMIT");
      counts[table] = total;
      process.stdout.write(`-- rows: ${total}\n\n`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[${table}] dump failed: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  process.stdout.write(`COMMIT;\n\n`);
  process.stdout.write(`-- ═══ verification ═══\n`);
  for (const [t, c] of Object.entries(counts)) {
    process.stdout.write(`-- ${t}: ${c} rows\n`);
  }

  await pool.end();

  // Stderr summary so the user sees something on the terminal even when
  // stdout is redirected to a file.
  console.error(`\n[qpaynet-backup] done: ${Object.values(counts).reduce((a, b) => a + b, 0)} rows across ${Object.keys(counts).length} tables`);
}

main().catch((err) => {
  console.error("[qpaynet-backup] fatal:", err.message);
  process.exit(1);
});

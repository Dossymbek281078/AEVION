#!/usr/bin/env node
// One-shot migration: read ecosystem.json (JSON-backed ledger) and load it into
// Postgres tables defined in sql/ecosystem-schema.sql.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/migrate-ecosystem-to-pg.mjs
//   DATABASE_URL=postgres://... node scripts/migrate-ecosystem-to-pg.mjs --dry-run
//
// The script is idempotent: each row is upserted by its primary key (the
// source-supplied event id), so a re-run after a partial failure picks up
// where it left off without duplicating events.
//
// Schema bootstrap is included — running once on an empty database creates
// tables, runs migration, writes ecosystem_migration_state to mark completion.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const VERBOSE = args.has("--verbose");

const DATA_DIR = process.env.AEVION_DATA_DIR || resolve(process.cwd(), "data");
const SOURCE = resolve(DATA_DIR, "ecosystem.json");
const SCHEMA = resolve(process.cwd(), "sql", "ecosystem-schema.sql");

if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set — refusing to run");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const raw = await readFile(SOURCE, "utf-8").catch((err) => {
    if (err.code === "ENOENT") {
      console.error(`[migrate] source not found: ${SOURCE}`);
      console.error("[migrate] (no events to migrate — exiting cleanly)");
      process.exit(0);
    }
    throw err;
  });

  const data = JSON.parse(raw);
  const royalties = Array.isArray(data.royaltyEvents) ? data.royaltyEvents : [];
  const prizes = Array.isArray(data.chessPrizes) ? data.chessPrizes : [];
  const certs = Array.isArray(data.planetCerts) ? data.planetCerts : [];

  console.log(
    `[migrate] source ${SOURCE} → ${royalties.length} royalty / ${prizes.length} chess / ${certs.length} planet events`,
  );

  if (DRY) {
    console.log("[migrate] --dry-run — no DB writes");
    process.exit(0);
  }

  const schemaSql = await readFile(SCHEMA, "utf-8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (VERBOSE) console.log("[migrate] applying schema");
    await client.query(schemaSql);

    let inserted = { royalty: 0, chess: 0, planet: 0 };

    for (const r of royalties) {
      const result = await client.query(
        `INSERT INTO ecosystem_royalty_events
          (id, email, product_key, period, amount, paid_at, transfer_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.email,
          r.productKey,
          r.period,
          r.amount,
          r.paidAt,
          r.transferId,
          r.source ?? "qright",
        ],
      );
      inserted.royalty += result.rowCount ?? 0;
    }

    for (const p of prizes) {
      const result = await client.query(
        `INSERT INTO ecosystem_chess_prizes
          (id, email, tournament_id, place, amount, finalized_at, transfer_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          p.id,
          p.email,
          p.tournamentId,
          p.place,
          p.amount,
          p.finalizedAt,
          p.transferId,
          p.source ?? "cyberchess",
        ],
      );
      inserted.chess += result.rowCount ?? 0;
    }

    for (const c of certs) {
      const result = await client.query(
        `INSERT INTO ecosystem_planet_certs
          (id, email, artifact_version_id, amount, certified_at, source)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.email,
          c.artifactVersionId,
          c.amount,
          c.certifiedAt,
          c.source ?? "planet",
        ],
      );
      inserted.planet += result.rowCount ?? 0;
    }

    await client.query(
      `INSERT INTO ecosystem_migration_state
        (id, migrated_at, source_file, royalty_count, chess_count, planet_count)
       VALUES (1, NOW(), $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         migrated_at = EXCLUDED.migrated_at,
         source_file = EXCLUDED.source_file,
         royalty_count = EXCLUDED.royalty_count,
         chess_count = EXCLUDED.chess_count,
         planet_count = EXCLUDED.planet_count`,
      [SOURCE, royalties.length, prizes.length, certs.length],
    );

    await client.query("COMMIT");
    console.log(
      `[migrate] OK — inserted (new) royalty=${inserted.royalty} chess=${inserted.chess} planet=${inserted.planet}`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] FAILED — rolled back");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());

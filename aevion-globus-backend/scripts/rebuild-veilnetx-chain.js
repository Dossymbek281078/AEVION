#!/usr/bin/env node
/**
 * VeilNetX chain rebuild — recomputes `prevHash` and `entryHash` for every
 * existing ledger entry, in `sequenceNumber` order, starting from the genesis
 * hash. Use this ONLY when the chain has historical breakage from a
 * pre-canonicalJson era (entries laid down before `lib/ecosystemEvents.ts`
 * started sorting meta keys before hashing).
 *
 * SAFETY:
 *   - Pass `--dry-run` (or `DRY_RUN=1`) to print the diff without writing
 *   - Otherwise refuses to run unless `ALLOW_CHAIN_REBUILD=1`
 *   - Refuses if NODE_ENV=production unless `ALLOW_CHAIN_REBUILD_PROD=1`
 *   - Wraps the whole rewrite in a single transaction with advisory lock
 *     held throughout, so concurrent emits queue behind it
 *
 * The hash payload MUST stay byte-identical to `entryHash()` in
 * `src/lib/ecosystemEvents.ts` — if that function changes, mirror it here.
 *
 * Usage:
 *   node scripts/rebuild-veilnetx-chain.js --dry-run        # inspect
 *   ALLOW_CHAIN_REBUILD=1 node scripts/rebuild-veilnetx-chain.js
 *
 *   # Railway shell, prod:
 *   ALLOW_CHAIN_REBUILD=1 ALLOW_CHAIN_REBUILD_PROD=1 \
 *     node scripts/rebuild-veilnetx-chain.js
 */

const crypto = require("node:crypto");
const { Client } = require("pg");

const GENESIS_HASH = "0".repeat(64);
const VEILNETX_CHAIN_LOCK_KEY = "6218442231490103630";

// Mirror canonicalJson() in src/lib/ecosystemEvents.ts. Postgres JSONB
// reorders meta keys on storage; the chain hash MUST be computed over
// the canonical (key-sorted) form so insert and verify produce the same
// bytes when reading meta back through JSONB.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function entryHash(input) {
  const payload = [
    input.prevHash, input.module, input.kind,
    input.blindedFrom, input.blindedTo,
    input.amountCents, input.currency,
    input.metaJson, input.createdAt,
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function main() {
  // --dry-run skips the destructive UPDATE — prints the diff between stored
  // and computed hashes so the operator can eyeball before running for real.
  // No env gate needed because nothing mutates.
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

  if (!dryRun) {
    if (process.env.ALLOW_CHAIN_REBUILD !== "1") {
      console.error("Refusing to run without ALLOW_CHAIN_REBUILD=1 (or pass --dry-run)");
      process.exit(2);
    }
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_CHAIN_REBUILD_PROD !== "1") {
      console.error("NODE_ENV=production — also set ALLOW_CHAIN_REBUILD_PROD=1 to proceed");
      process.exit(2);
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(2);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [VEILNETX_CHAIN_LOCK_KEY]);

    const r = await client.query(`
      SELECT "id", "sequenceNumber", "module", "kind", "blindedFrom", "blindedTo",
             "amountCents", "currency", "meta", "createdAt"
      FROM "VeilNetXLedger"
      ORDER BY "sequenceNumber" ASC
    `);
    if (r.rowCount === 0) {
      console.log("Empty ledger — nothing to rebuild");
      await client.query(dryRun ? "ROLLBACK" : "COMMIT");
      return;
    }

    console.log(`${dryRun ? "Inspecting" : "Rebuilding"} ${r.rowCount} entries…`);
    let prevHash = GENESIS_HASH;
    let touched = 0; let unchanged = 0;
    for (const row of r.rows) {
      const createdAtIso = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
      const metaObj = typeof row.meta === "string" ? JSON.parse(row.meta) : (row.meta ?? {});
      const metaJson = canonicalJson(metaObj);
      const newHash = entryHash({
        prevHash,
        module: row.module,
        kind: row.kind,
        blindedFrom: row.blindedFrom,
        blindedTo: row.blindedTo,
        amountCents: String(row.amountCents),
        currency: row.currency,
        metaJson,
        createdAt: createdAtIso,
      });
      const samePrev = row.prevHash === prevHash;
      const sameHash = row.entryHash === newHash;
      if (samePrev && sameHash) {
        unchanged++;
      } else {
        touched++;
        if (dryRun) {
          console.log(`  seq=${row.sequenceNumber} ${row.module}/${row.kind}`);
          if (!samePrev) console.log(`    prevHash:  ${row.prevHash} -> ${prevHash}`);
          if (!sameHash) console.log(`    entryHash: ${row.entryHash} -> ${newHash}`);
        }
      }
      if (!dryRun) {
        await client.query(
          `UPDATE "VeilNetXLedger"
             SET "prevHash" = $1, "entryHash" = $2
           WHERE "id" = $3`,
          [prevHash, newHash, row.id],
        );
      }
      prevHash = newHash;
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log(`\nDRY RUN — no changes written. Would touch ${touched} rows (${unchanged} unchanged).`);
      console.log(`New head hash would be: ${prevHash}`);
    } else {
      await client.query("COMMIT");
      console.log(`Rewrote ${touched} rows (${unchanged} unchanged). New head hash: ${prevHash}`);
    }
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    console.error("Rebuild failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("crash:", e); process.exit(1); });

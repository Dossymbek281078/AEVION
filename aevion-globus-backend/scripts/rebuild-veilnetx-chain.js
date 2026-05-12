#!/usr/bin/env node
/**
 * VeilNetX chain rebuild — recomputes `prevHash` and `entryHash` for every
 * existing ledger entry, in `sequenceNumber` order, starting from the genesis
 * hash. Use this ONLY when the chain has historical breakage from a
 * pre-lock race condition (entries laid down before the
 * `pg_advisory_xact_lock` fix in `lib/ecosystemEvents.ts`).
 *
 * SAFETY:
 *   - Refuses to run unless `ALLOW_CHAIN_REBUILD=1` is set
 *   - Refuses if NODE_ENV=production unless `ALLOW_CHAIN_REBUILD_PROD=1`
 *   - Wraps the whole rewrite in a single transaction with advisory lock
 *     held throughout, so concurrent emits queue behind it
 *
 * The hash payload MUST stay byte-identical to `entryHash()` in
 * `src/lib/ecosystemEvents.ts` — if that function changes, mirror it here.
 *
 * Usage (local):
 *   ALLOW_CHAIN_REBUILD=1 node scripts/rebuild-veilnetx-chain.js
 *
 * Usage (Railway shell):
 *   ALLOW_CHAIN_REBUILD=1 ALLOW_CHAIN_REBUILD_PROD=1 \
 *     node scripts/rebuild-veilnetx-chain.js
 */

const crypto = require("node:crypto");
const { Client } = require("pg");

const GENESIS_HASH = "0".repeat(64);
const VEILNETX_CHAIN_LOCK_KEY = "6218442231490103630";

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
  if (process.env.ALLOW_CHAIN_REBUILD !== "1") {
    console.error("Refusing to run without ALLOW_CHAIN_REBUILD=1");
    process.exit(2);
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_CHAIN_REBUILD_PROD !== "1") {
    console.error("NODE_ENV=production — also set ALLOW_CHAIN_REBUILD_PROD=1 to proceed");
    process.exit(2);
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
      await client.query("COMMIT");
      return;
    }

    console.log(`Rebuilding ${r.rowCount} entries…`);
    let prevHash = GENESIS_HASH;
    let rewritten = 0;
    for (const row of r.rows) {
      const createdAtIso = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
      const metaJson = typeof row.meta === "string" ? row.meta : JSON.stringify(row.meta ?? {});
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
      await client.query(
        `UPDATE "VeilNetXLedger"
           SET "prevHash" = $1, "entryHash" = $2
         WHERE "id" = $3`,
        [prevHash, newHash, row.id],
      );
      prevHash = newHash;
      rewritten++;
    }

    await client.query("COMMIT");
    console.log(`Rewrote ${rewritten} entries. New head hash: ${prevHash}`);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    console.error("Rebuild failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("crash:", e); process.exit(1); });

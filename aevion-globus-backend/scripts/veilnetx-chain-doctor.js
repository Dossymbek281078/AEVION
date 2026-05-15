#!/usr/bin/env node
/**
 * VeilNetX chain doctor — diagnoses chain integrity over the HTTP API.
 *
 * `/api/veilnetx-ledger/chain/verify` returns only `{verified, brokenAt,
 * length, head}`. When `verified=false` that's enough to know there's a
 * problem but not what to do. This script walks the entries page-by-page,
 * recomputes each `entryHash` from its visible fields, and prints exactly
 * which row breaks the chain (and how) — so a human can decide whether to
 * run `scripts/rebuild-veilnetx-chain.js` or investigate further.
 *
 * Read-only, safe to run against prod.
 *
 * Usage:
 *   node scripts/veilnetx-chain-doctor.js
 *   BASE=https://aevion-production-a70c.up.railway.app \
 *     node scripts/veilnetx-chain-doctor.js
 */

const crypto = require("node:crypto");

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");
const GENESIS_HASH = "0".repeat(64);
const PAGE = 100;

// Mirror canonicalJson() in src/lib/ecosystemEvents.ts. JSONB-stored meta
// keys come back in storage order (typically alphabetical) which usually
// differs from the original emit order — the hash MUST be computed over
// canonical (sorted) JSON in both places or verify reports a false break.
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

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  let body = {}; try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

async function fetchAllEntriesAsc() {
  const all = [];
  let offset = 0;
  for (;;) {
    const r = await getJson(`/api/veilnetx-ledger/entries?limit=${PAGE}&offset=${offset}`);
    if (r.status !== 200) throw new Error(`GET /entries failed: ${r.status}`);
    const arr = Array.isArray(r.body?.entries) ? r.body.entries : [];
    if (arr.length === 0) break;
    all.push(...arr);
    if (arr.length < PAGE) break;
    offset += PAGE;
  }
  all.sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
  return all;
}

async function main() {
  console.log(`VeilNetX chain doctor → ${BASE}`);

  const verify = await getJson("/api/veilnetx-ledger/chain/verify");
  console.log(`\nServer says: ${JSON.stringify(verify.body)}\n`);

  const entries = await fetchAllEntriesAsc();
  console.log(`Walking ${entries.length} entries from genesis…\n`);

  if (entries.length === 0) {
    console.log("Empty ledger — nothing to check.");
    return;
  }

  let prevHash = GENESIS_HASH;
  let firstBreak = null;
  for (const row of entries) {
    const metaObj = typeof row.meta === "string" ? JSON.parse(row.meta) : (row.meta ?? {});
    const expected = entryHash({
      prevHash,
      module: row.module,
      kind: row.kind,
      blindedFrom: row.blindedFrom,
      blindedTo: row.blindedTo,
      amountCents: String(row.amountCents),
      currency: row.currency,
      metaJson: canonicalJson(metaObj),
      createdAt: row.createdAt,
    });
    const linkOk = row.prevHash === prevHash;
    const hashOk = row.entryHash === expected;
    if (!linkOk || !hashOk) {
      if (firstBreak === null) firstBreak = row.sequenceNumber;
      console.log(`✗ seq=${row.sequenceNumber} module=${row.module} kind=${row.kind}`);
      if (!linkOk) console.log(`    prevHash mismatch:`);
      if (!linkOk) console.log(`      stored:   ${row.prevHash}`);
      if (!linkOk) console.log(`      expected: ${prevHash}`);
      if (!hashOk) console.log(`    entryHash mismatch (likely pre-canonicalJson era):`);
      if (!hashOk) console.log(`      stored:   ${row.entryHash}`);
      if (!hashOk) console.log(`      expected: ${expected}`);
      if (!hashOk) console.log(`      meta keys: ${Object.keys(metaObj).join(",")} (canonical order would re-sort)`);
    }
    prevHash = row.entryHash;
  }

  if (firstBreak === null) {
    console.log(`✓ Chain is intact over all ${entries.length} entries.`);
    console.log(`  Head: ${prevHash}`);
    process.exit(0);
  } else {
    console.log(`\nFirst break at sequenceNumber=${firstBreak}`);
    console.log(`Run scripts/rebuild-veilnetx-chain.js with ALLOW_CHAIN_REBUILD=1 to recompute every row from genesis using canonical JSON.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });

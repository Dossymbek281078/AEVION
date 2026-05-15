#!/usr/bin/env node
/**
 * VeilNetX entries → CSV exporter for compliance / audit handoff.
 *
 * Walks `/api/veilnetx-ledger/entries` page by page and writes a CSV with
 * one row per entry. Columns are the privacy-preserving public surface:
 *
 *   sequenceNumber, createdAt, module, kind, blindedFrom, blindedTo,
 *   amountCents, currency, prevHash, entryHash
 *
 * `meta` is intentionally NOT in the CSV — it can carry per-tx identifiers
 * (txId, chargeId) that aren't blinded. If a compliance review needs them,
 * pull them through the API directly with a logged auth call.
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/veilnetx-export-csv.js > export.csv
 *   BASE=https://aevion-production-a70c.up.railway.app \
 *     node scripts/veilnetx-export-csv.js > prod-2026-05-12.csv
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");
const PAGE = 200;

const COLUMNS = [
  "sequenceNumber", "createdAt", "module", "kind",
  "blindedFrom", "blindedTo",
  "amountCents", "currency",
  "prevHash", "entryHash",
];

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  let body = {}; try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

async function main() {
  process.stdout.write(COLUMNS.join(",") + "\n");

  let offset = 0;
  let total = 0;
  for (;;) {
    const r = await getJson(`/api/veilnetx-ledger/entries?limit=${PAGE}&offset=${offset}`);
    if (r.status !== 200) {
      process.stderr.write(`GET /entries failed at offset=${offset}: ${r.status}\n`);
      process.exit(1);
    }
    const rows = Array.isArray(r.body?.entries) ? r.body.entries : [];
    if (rows.length === 0) break;

    // Server returns desc by sequenceNumber; sort asc for stable export.
    rows.sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
    for (const row of rows) {
      process.stdout.write(COLUMNS.map((c) => csvEscape(row[c])).join(",") + "\n");
    }
    total += rows.length;
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  process.stderr.write(`Exported ${total} entries from ${BASE}\n`);
}

main().catch((e) => { process.stderr.write(`crash: ${e instanceof Error ? e.message : e}\n`); process.exit(2); });

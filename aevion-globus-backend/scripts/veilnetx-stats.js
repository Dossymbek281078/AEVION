#!/usr/bin/env node
/**
 * VeilNetX stats — read-only report on the settlement ledger.
 *
 * Walks `/api/veilnetx-ledger/entries` page by page and prints:
 *   - Total entry count + chain length agreement with /chain/head
 *   - Breakdown by `module` (qpaynet, qmaskcard, bureau, qgood, …)
 *   - Breakdown by `kind` within each module
 *   - Total volume per currency (sum of amountCents → major-units)
 *   - Oldest + newest entry timestamps (window)
 *   - Current chain head hash + verify status
 *
 * Useful as an ops snapshot or an investor-facing one-pager.
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/veilnetx-stats.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/veilnetx-stats.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");
const PAGE = 100;

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  let body = {}; try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

async function fetchAll() {
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
  return all;
}

function fmtAmount(cents, currency) {
  // tiin for KZT (smallest unit; ratio 100), cents for USD/EUR (100). Same scale.
  const major = Number(cents) / 100;
  return `${major.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

async function main() {
  console.log(`VeilNetX stats → ${BASE}\n`);

  const headR = await getJson("/api/veilnetx-ledger/chain/head");
  const verifyR = await getJson("/api/veilnetx-ledger/chain/verify");
  const entries = await fetchAll();

  console.log(`Chain head:      ${headR.body?.head ?? "?"}`);
  console.log(`Chain length:    ${headR.body?.length ?? "?"} (verify reports length=${verifyR.body?.length})`);
  console.log(`Integrity:       verified=${verifyR.body?.verified}${verifyR.body?.brokenAt != null ? ` brokenAt=${verifyR.body.brokenAt}` : ""}`);
  console.log(`Entries fetched: ${entries.length}\n`);

  if (entries.length === 0) {
    console.log("(empty ledger)");
    return;
  }

  // Module → kind → count
  const byModule = new Map();
  for (const e of entries) {
    const m = byModule.get(e.module) ?? { total: 0, kinds: new Map() };
    m.total++;
    m.kinds.set(e.kind, (m.kinds.get(e.kind) ?? 0) + 1);
    byModule.set(e.module, m);
  }

  console.log("By module / kind:");
  const modules = [...byModule.keys()].sort();
  for (const m of modules) {
    const data = byModule.get(m);
    console.log(`  ${m.padEnd(12)} ${String(data.total).padStart(5)} entries`);
    const kinds = [...data.kinds.entries()].sort();
    for (const [k, c] of kinds) {
      console.log(`    └─ ${k.padEnd(15)} ${String(c).padStart(4)}`);
    }
  }

  // Volume per currency
  const volume = new Map();
  for (const e of entries) {
    const cur = e.currency ?? "USD";
    volume.set(cur, (volume.get(cur) ?? 0n) + BigInt(e.amountCents ?? 0));
  }
  console.log("\nTotal volume (signed):");
  for (const [cur, total] of [...volume.entries()].sort()) {
    console.log(`  ${fmtAmount(total.toString(), cur)}`);
  }

  // Time window
  const times = entries.map((e) => new Date(e.createdAt).getTime()).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (times.length > 0) {
    const oldest = new Date(times[0]).toISOString();
    const newest = new Date(times[times.length - 1]).toISOString();
    const spanHours = (times[times.length - 1] - times[0]) / 3_600_000;
    console.log(`\nTime window:     ${oldest} → ${newest}  (${spanHours.toFixed(1)} h)`);
  }
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });

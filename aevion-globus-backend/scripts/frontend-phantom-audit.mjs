// Frontend phantom-page audit: every module in the registry
// (src/data/projects.ts) advertises a page at /<id> via the dynamic
// src/app/[id] route. This probes each one on the live frontend and fails if
// any registered module renders a 404 (advertised in nav/catalog but dead).
//
// Read-only (GET only). Run:
//   FRONTEND=https://aevion.app node scripts/frontend-phantom-audit.mjs
import { readFileSync } from "node:fs";

const BASE = (process.env.FRONTEND || process.env.FRONTEND_BASE || "https://aevion.app").replace(/\/+$/, "");

// Registry is the single source of truth for the module set.
const src = readFileSync("src/data/projects.ts", "utf8");
const ids = [...new Set((src.match(/^\s*id:\s*["'`]([a-z0-9-]+)["'`]/gim) || []).map((m) => m.replace(/^\s*id:\s*["'`]/i, "").replace(/["'`]$/, "")))];

async function probe(id) {
  const url = `${BASE}/${id}`;
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12000) });
    return { id, status: r.status };
  } catch (e) {
    return { id, status: 0, err: String(e).slice(0, 40) };
  }
}

let i = 0;
const out = [];
async function worker() {
  while (i < ids.length) {
    const id = ids[i++];
    out.push(await probe(id));
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

// A 2xx or 3xx (redirect to a real page) is healthy; 404/410 is a phantom.
// Network errors don't fail the gate (unreachable ≠ phantom).
const phantoms = out.filter((o) => o.status === 404 || o.status === 410);
const errored = out.filter((o) => o.status === 0);
const ok = out.filter((o) => o.status >= 200 && o.status < 400);

console.log(`=== frontend ${BASE} | modules ${ids.length} | ok(2xx/3xx): ${ok.length} | net-err: ${errored.length} | PHANTOM PAGES: ${phantoms.length} ===`);
if (phantoms.length) {
  console.log("\n--- PHANTOM PAGES (registered module, /<id> returns 404/410) ---");
  phantoms.forEach((o) => console.log(`   /${o.id}  → ${o.status}`));
}
if (errored.length) {
  console.log("\n--- network errors (target unreachable, not counted as phantom) ---");
  errored.forEach((o) => console.log(`   /${o.id}  → ${o.err}`));
}

const failCount = phantoms.length;
console.log(`\nfrontend-phantom-audit — 1 check — ${failCount === 0 ? "1 PASS  0 FAIL" : `0 PASS  ${failCount} FAIL`}`);
process.exit(failCount > 0 ? 1 : 0);

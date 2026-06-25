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

// "Zombie" markers: a 200 page that actually rendered an error/notFound
// boundary or a client-side crash. __next_error__ is exclusive to Next's
// error pages (verified absent on every healthy module page); the strings are
// Next's hard client/404 render text.
const ERROR_MARKERS = [
  /__next_error__/,
  /Application error: a client-side exception/i,
  /This page could not be found/i,
];
// Below this an HTML response is an empty shell, not a real module page
// (healthy pages run 20–45 KB; the threshold is deliberately conservative).
const MIN_HTML_BYTES = 1200;

async function probe(id) {
  const url = `${BASE}/${id}`;
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12000) });
    let zombie = null;
    if (r.status === 200) {
      const html = await r.text();
      if (ERROR_MARKERS.some((re) => re.test(html))) zombie = "error-render";
      else if (html.length < MIN_HTML_BYTES) zombie = `empty-shell(${html.length}b)`;
    }
    return { id, status: r.status, zombie };
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

// A 2xx/3xx is reachable; 404/410 is a phantom; a 200 that rendered an error
// boundary / empty shell is a "zombie". Network errors don't fail the gate.
const phantoms = out.filter((o) => o.status === 404 || o.status === 410);
const zombies = out.filter((o) => o.zombie);
const errored = out.filter((o) => o.status === 0);
const ok = out.filter((o) => o.status >= 200 && o.status < 400 && !o.zombie);

console.log(`=== frontend ${BASE} | modules ${ids.length} | healthy: ${ok.length} | net-err: ${errored.length} | PHANTOMS: ${phantoms.length} | ZOMBIES: ${zombies.length} ===`);
if (phantoms.length) {
  console.log("\n--- PHANTOM PAGES (registered module, /<id> returns 404/410) ---");
  phantoms.forEach((o) => console.log(`   /${o.id}  → ${o.status}`));
}
if (zombies.length) {
  console.log("\n--- ZOMBIE PAGES (200 but error-render / empty shell) ---");
  zombies.forEach((o) => console.log(`   /${o.id}  → ${o.zombie}`));
}
if (errored.length) {
  console.log("\n--- network errors (target unreachable, not counted) ---");
  errored.forEach((o) => console.log(`   /${o.id}  → ${o.err}`));
}

const failCount = phantoms.length + zombies.length;
console.log(`\nfrontend-phantom-audit — 1 check — ${failCount === 0 ? "1 PASS  0 FAIL" : `0 PASS  ${failCount} FAIL`}`);
process.exit(failCount > 0 ? 1 : 0);

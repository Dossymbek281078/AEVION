// Phantom advertised-endpoint audit: finds /api paths that modules advertise
// (in /status, /health, discovery objects) but that return 404 with no handler
// of ANY method in the route sources. Run: BASE=<prod> node scripts/phantom-endpoint-audit.mjs
import { readFileSync, readdirSync } from "node:fs";

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(d + "/" + e.name) : e.name.endsWith(".ts") ? [d + "/" + e.name] : [],
  );
}
const src = walk("src/routes").map((f) => readFileSync(f, "utf8")).join("\n") + readFileSync("src/index.ts", "utf8");

// Advertised endpoints = full "/api/..." string literals appearing in the sources
// (discovery/status objects). Skip param routes (/:id) and template placeholders ({...}).
const urls = [...new Set(
  (src.match(/["'`]\/api\/[a-zA-Z0-9/_-]+["'`]/g) || [])
    .map((m) => m.slice(1, -1))
    .filter((u) => !/\/:|\{/.test(u)),
)].sort();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, (m) => "\\" + m);
}

// Mount prefixes from app.use("/api/...", router) — a bare GET on a router's
// mount point legitimately 404s (no "/" index route), so these are NOT phantoms.
const mountPrefixes = new Set(
  [...src.matchAll(/app\.use\(\s*\[?\s*["'`](\/api\/[a-zA-Z0-9/_-]+)["'`]/g)].map((m) => m[1]),
);

async function probe(u) {
  try {
    const r = await fetch(BASE + u, { method: "GET", signal: AbortSignal.timeout(8000) });
    return { u, status: r.status };
  } catch (e) {
    return { u, status: 0, err: String(e).slice(0, 40) };
  }
}

let i = 0;
const out = [];
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    out.push(await probe(u));
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

// A handler exists if any Router.<method>("/...<lastSegment>...") appears in source.
function hasHandler(u) {
  const segs = u.split("/").filter(Boolean); // [api, module, ...rest]
  const rest = segs.slice(2);
  if (rest.length === 0) return true; // module root mount
  const last = rest[rest.length - 1];
  const re = new RegExp('\\.(get|post|put|patch|delete)\\(\\s*["`]/[^"`]*' + escapeRe(last), "i");
  return re.test(src);
}

const notFound = out.filter((o) => o.status === 404);
const phantoms = notFound.filter((o) => !hasHandler(o.u) && !mountPrefixes.has(o.u));
const mountOnly = notFound.filter((o) => !hasHandler(o.u) && mountPrefixes.has(o.u));
const errored = out.filter((o) => o.status === 0);

console.log(`=== probed ${out.length} | 404: ${notFound.length} | network-err: ${errored.length} | CONFIRMED PHANTOMS: ${phantoms.length} ===`);
console.log("\n--- CONFIRMED PHANTOMS (advertised + 404 + no handler of any method) ---");
phantoms.forEach((o) => console.log("  ", o.u));
console.log("\n--- 404 but a handler exists (POST-only / param route — NOT phantom) ---");
notFound.filter((o) => hasHandler(o.u)).forEach((o) => console.log("  ", o.u));
console.log("\n--- 404 on a router mount prefix (no index route — NOT phantom) ---");
mountOnly.forEach((o) => console.log("  ", o.u));

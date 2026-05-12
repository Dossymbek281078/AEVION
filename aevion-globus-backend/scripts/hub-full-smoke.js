#!/usr/bin/env node
/**
 * AEVION Hub full surface smoke — covers all /api/aevion/* endpoints in
 * one script. Quick sanity check after Railway redeploys.
 *
 *   /api/aevion/health      — aggregate health (all sub-modules)
 *   /api/aevion/catalog     — unified module discovery
 *   /api/aevion/version     — build info
 *   /api/aevion/openapi.json — module spec index
 *   /api/aevion/sitemap.xml — XML sitemap of frontend module pages
 *
 * Read-only — safe anywhere including prod.
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

let pass = 0;
let fail = 0;

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`  ✅ ${name} (${ms}ms)`);
    pass++;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ❌ ${name} (${ms}ms): ${e.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function get(path, expectJson = true) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Accept: expectJson ? "application/json" : "*/*" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
  return expectJson ? r.json() : r.text();
}

(async () => {
  console.log(`[hub-full-smoke] Target: ${BASE}`);
  console.log("");

  await step("GET /api/aevion/health returns ok/degraded/down + services map", async () => {
    const j = await get("/api/aevion/health");
    assert(["ok", "degraded", "down"].includes(j.status), `unexpected status: ${j.status}`);
    assert(typeof j.healthy === "number", "healthy must be number");
    assert(typeof j.total === "number", "total must be number");
    assert(j.services && typeof j.services === "object", "services map missing");
    assert(Object.keys(j.services).length >= 10, `expected ≥10 services, got ${Object.keys(j.services).length}`);
  });

  await step("GET /api/aevion/catalog returns total + items[]", async () => {
    const j = await get("/api/aevion/catalog");
    assert(j.total >= 10, `expected ≥10 modules, got ${j.total}`);
    assert(Array.isArray(j.items), "items must be array");
    const first = j.items[0];
    assert(first && first.id && first.frontend && first.ogImage, "first item shape invalid");
    assert(Array.isArray(first.relatedModules), "relatedModules must be array on each item");
  });

  await step("GET /api/aevion/version returns service + node + uptime", async () => {
    const j = await get("/api/aevion/version");
    assert(j.service === "aevion-hub", `service = ${j.service}, expected aevion-hub`);
    assert(typeof j.node === "string" && j.node.startsWith("v"), "node version missing/wrong");
    assert(typeof j.uptimeSec === "number", "uptimeSec must be number");
  });

  await step("GET /api/aevion/openapi.json returns module spec index", async () => {
    const j = await get("/api/aevion/openapi.json");
    assert(j.aevion && j.aevion.modules, "aevion.modules missing");
    assert(Array.isArray(j.aevion.modules), "modules must be array");
    assert(j.aevion.modules.length >= 5, `expected ≥5 modules, got ${j.aevion.modules.length}`);
    for (const m of j.aevion.modules) {
      assert(m.name && m.title && m.spec, `module entry malformed: ${JSON.stringify(m)}`);
      assert(/^https?:\/\//.test(m.spec), `spec URL malformed: ${m.spec}`);
    }
  });

  await step("GET /api/aevion/sitemap.xml returns valid XML + ETag", async () => {
    const r = await fetch(`${BASE}/api/aevion/sitemap.xml`);
    assert(r.ok, `HTTP ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    assert(ct.includes("xml"), `content-type wrong: '${ct}'`);
    assert(r.headers.get("etag"), "ETag missing");
    const text = await r.text();
    assert(text.startsWith("<?xml"), "body not XML");
    assert(text.includes("<urlset"), "urlset missing");
  });

  await step("Hub catalog Cache-Control set", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog`);
    const cc = r.headers.get("cache-control") || "";
    assert(/max-age=\d+/.test(cc), `Cache-Control missing: '${cc}'`);
  });

  await step("GET /api/aevion/catalog?format=csv returns text/csv", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog?format=csv`);
    assert(r.ok, `HTTP ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    assert(ct.includes("text/csv"), `content-type wrong: '${ct}'`);
    const text = await r.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    assert(lines.length >= 11, `expected ≥11 rows (header+10 modules), got ${lines.length}`);
    assert(lines[0].startsWith("id,code,name,"), `header malformed: ${lines[0]}`);
  });

  await step("GET /api/aevion/catalog?format=md returns markdown table", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog?format=md`);
    assert(r.ok, `HTTP ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    assert(ct.includes("text/markdown"), `content-type wrong: '${ct}'`);
    const text = await r.text();
    assert(text.startsWith("# AEVION Module Catalog"), "markdown header missing");
    assert(text.includes("| Code | Name | Status | Kind |"), "markdown table header missing");
    const rows = text.split("\n").filter((l) => l.startsWith("| `"));
    assert(rows.length >= 10, `expected ≥10 markdown rows, got ${rows.length}`);
  });

  console.log("");
  console.log(`[hub-full-smoke] PASS=${pass} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[hub-full-smoke] FATAL:", e?.stack || e);
  process.exit(2);
});

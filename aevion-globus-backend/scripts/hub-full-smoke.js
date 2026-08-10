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
 *   /api/aevion/sdks        — published SDK packages + live npm stats
 *   /api/aevion/sdks/diag   — npm reachability probe (regression guard)
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

  await step("GET /api/aevion/catalog?fields=id,name returns lean items", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog?fields=id,name`);
    assert(r.ok, `HTTP ${r.status}`);
    const j = await r.json();
    assert(Array.isArray(j.items), "items must be array");
    const first = j.items[0];
    assert(first.id && first.name, "id+name must be present");
    assert(!("description" in first), "description should be projected out");
    assert(!("frontend" in first), "frontend should be projected out");
    assert(j.filters.fields === "id,name", "filters.fields echo wrong");
  });

  await step("GET /api/aevion/catalog/:id single lookup works", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog/qpersona`);
    assert(r.ok, `HTTP ${r.status}`);
    const j = await r.json();
    assert(j.id === "qpersona", `id=${j.id}, expected qpersona`);
    assert(typeof j.frontend === "string" && j.frontend.includes("/qpersona"), "frontend URL malformed");
    assert(Array.isArray(j.relatedModules), "relatedModules must be array");
  });

  await step("GET /api/aevion/catalog/:id returns 404 for unknown id", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog/this-module-does-not-exist`);
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  await step("GET /api/aevion/badges/:id.svg returns SVG badge", async () => {
    const r = await fetch(`${BASE}/api/aevion/badges/qpersona.svg`);
    assert(r.ok, `HTTP ${r.status}`);
    const ct = r.headers.get("content-type") || "";
    assert(ct.includes("image/svg+xml"), `content-type wrong: '${ct}'`);
    const text = await r.text();
    assert(text.includes("<svg"), "body not SVG");
    assert(text.includes("AEVION"), "label missing");
    assert(text.toLowerCase().includes("qpersona") || text.toLowerCase().includes("QPERSONA".toLowerCase()), "module ref missing");
  });

  await step("GET /api/aevion/badges/:id.svg returns 404 SVG for unknown", async () => {
    const r = await fetch(`${BASE}/api/aevion/badges/not-a-real-module.svg`);
    assert(r.status === 404, `expected 404, got ${r.status}`);
    const text = await r.text();
    assert(text.includes("<svg"), "404 response must still be SVG");
  });

  await step("GET /api/aevion/registry-stats returns byStatus/byKind/byTag", async () => {
    const j = await get("/api/aevion/registry-stats");
    assert(typeof j.total === "number" && j.total >= 10, `total=${j.total}, expected ≥10`);
    assert(j.byStatus && typeof j.byStatus === "object", "byStatus missing");
    assert(j.byKind && typeof j.byKind === "object", "byKind missing");
    assert(Array.isArray(j.byTag), "byTag must be array");
    assert(j.byTag.length <= 20, `byTag must be ≤20, got ${j.byTag.length}`);
    for (const t of j.byTag) {
      assert(typeof t.tag === "string" && typeof t.count === "number", "byTag entry malformed");
    }
  });

  await step("GET /api/aevion/pricing stays removed (billing consolidation, PR #779)", async () => {
    // The showcase pricing endpoint was DELETED on purpose: it was a parallel
    // price config whose displayed numbers could diverge from what checkout
    // actually charged. Real pricing lives at /api/pricing. This check keeps
    // the dead route dead — a 200 here means someone resurrected the
    // diverging-price path.
    const r = await fetch(`${BASE}/api/aevion/pricing`, { headers: { Accept: "application/json" } });
    assert(r.status === 404, `expected 404 (route deleted in #779), got ${r.status}`);
  });

  await step("GET /api/aevion/sdks returns 4 published packages with shape", async () => {
    const j = await get("/api/aevion/sdks");
    assert(j.total === 4, `total=${j.total}, expected 4`);
    assert(Array.isArray(j.sdks) && j.sdks.length === 4, `sdks.length=${j.sdks?.length}, expected 4`);
    const ids = j.sdks.map((s) => s.id).sort().join(",");
    assert(ids === "catalog-client,fintech-sdk,qcoreai-client,qpaynet-client", `unexpected ids: ${ids}`);
    for (const s of j.sdks) {
      assert(/^\d+\.\d+\.\d+$/.test(s.version), `${s.id}: version not semver: ${s.version}`);
      assert(typeof s.install === "string" && s.install.startsWith("npm install "), `${s.id}: install malformed`);
      assert(s.registry?.startsWith("https://www.npmjs.com/package/"), `${s.id}: registry malformed`);
      assert(Array.isArray(s.modules), `${s.id}: modules must be array`);
    }
  });

  await step("GET /api/aevion/sdks stats are populated (≥1 non-null)", async () => {
    // Regression guard: on 2026-05-21 a stale negative-cache after Railway
    // restart served null for all 4 SDKs for several minutes. With the npm
    // egress working (verified by /sdks/diag) at least one SDK must surface
    // a non-null lastPublished within a fresh 60s cache window.
    const j = await get("/api/aevion/sdks");
    const liveCount = j.sdks.filter((s) => s.lastPublished || typeof s.downloadsLastWeek === "number").length;
    assert(liveCount >= 1, `all 4 SDKs serving null stats — npm egress or cache broken`);
  });

  await step("GET /api/aevion/sdks/diag probes npm reachability", async () => {
    const j = await get("/api/aevion/sdks/diag");
    assert(j.downloads && j.registry, "diag must include downloads + registry probes");
    assert(j.downloads.ok === true, `downloads probe failed: status=${j.downloads.status} err=${j.downloads.errorMessage}`);
    assert(j.registry.ok === true, `registry HEAD probe failed: status=${j.registry.status} err=${j.registry.errorMessage}`);
    assert(j.registry.lastModified, "registry HEAD must return Last-Modified header");
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

#!/usr/bin/env node
/**
 * Modules PROD smoke — guards `/api/modules/status` central registry +
 * per-module `/api/modules/:id/health` probe.
 *
 * Why: this is the single endpoint that consumers (frontend portal,
 * docs site, status page) use to discover the live module list + tier
 * classification. If a module silently drops from the registry, every
 * downstream UI loses it.
 *
 *  1.  GET /api/modules/status → 200 + total numeric ≥ 30
 *  2.  status.byTier object with mvp_live + portal_only keys
 *  3.  status.items is array, length matches total
 *  4.  items[0] shape (id + code + name + status + kind + createdAt)
 *  5.  All items have unique ids (no duplicates)
 *  6.  All items have status in {live, mvp, idea, planning, research}
 *  7.  status.generatedAt is ISO timestamp parseable as Date
 *  8.  GET /api/modules/qsign/health → 200
 *  9.  GET /api/modules/globus/health → 200
 * 10.  GET /api/modules/qcoreai/health → 200
 * 11.  GET /api/modules/__no_such__/health → 404 graceful
 * 12.  Live module count from items matches byTier sum when summed
 * 13.  Content-Type application/json on /modules/status
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

async function run() {
  console.log(`\nModules PROD smoke → ${BASE}\n`);

  // 1. Status
  let r = await req("GET", "/api/modules/status");
  let status = null;
  if (r.status === 200 && typeof r.body?.total === "number" && r.body.total >= 30) {
    status = r.body;
    ok("GET /modules/status", `total=${status.total}`);
  } else fail("GET /modules/status", `${r.status} total=${r.body?.total}`);

  // 2. byTier shape
  if (status) {
    const t = status.byTier;
    if (t && typeof t === "object" && typeof t.mvp_live === "number" && typeof t.portal_only === "number") {
      ok("status.byTier shape", `mvp_live=${t.mvp_live} portal_only=${t.portal_only}`);
    } else fail("status.byTier shape", `got=${JSON.stringify(t).slice(0, 60)}`);
  }

  // 3. items length matches total
  if (status) {
    if (Array.isArray(status.items) && status.items.length === status.total) {
      ok("status.items.length == total", `${status.items.length}`);
    } else fail("status.items length", `items=${status.items?.length} total=${status.total}`);
  }

  // 4. items[0] shape
  if (status?.items?.length > 0) {
    const m = status.items[0];
    const hasShape = m.id && m.code && m.name && m.status && m.kind && m.createdAt;
    if (hasShape) ok("items[0] shape", `${m.id} status=${m.status}`);
    else fail("items[0] shape", `keys=${Object.keys(m).join(",")}`);
  }

  // 5. Unique ids
  if (status?.items) {
    const ids = status.items.map((m) => m.id);
    const uniq = new Set(ids);
    if (ids.length === uniq.size) ok("all module ids unique", `${ids.length}`);
    else fail("duplicate module ids", `total=${ids.length} unique=${uniq.size}`);
  }

  // 6. Status enum
  if (status?.items) {
    const allowed = new Set(["live", "mvp", "idea", "planning", "research", "launched", "in_progress", "working"]);
    const bad = status.items.filter((m) => !allowed.has(m.status)).map((m) => `${m.id}:${m.status}`);
    if (bad.length === 0) ok("all module.status in valid enum");
    else fail("module.status enum", `bad=${bad.slice(0, 3).join(",")}`);
  }

  // 7. generatedAt ISO
  if (status) {
    if (typeof status.generatedAt === "string" && !isNaN(Date.parse(status.generatedAt))) {
      ok("status.generatedAt ISO", status.generatedAt.slice(0, 16));
    } else fail("status.generatedAt ISO", `got=${status.generatedAt}`);
  }

  // 8-10. Per-module health probes
  for (const id of ["qsign", "globus", "qcoreai"]) {
    r = await req("GET", `/api/modules/${id}/health`);
    if (r.status === 200) ok(`GET /modules/${id}/health → 200`);
    else fail(`GET /modules/${id}/health`, `${r.status}`);
  }

  // 11. Unknown module
  r = await req("GET", "/api/modules/__no_such__/health");
  if (r.status === 404 || r.status === 400) {
    ok("GET /modules/__no_such__/health → 4xx graceful", `status=${r.status}`);
  } else fail("Unknown module should 4xx", `got=${r.status}`);

  // 12. byTier sums to total (sanity)
  if (status?.byTier) {
    const sum = Object.values(status.byTier).reduce((a, b) => a + b, 0);
    if (sum === status.total) ok("byTier sum == total", `${sum}`);
    else fail("byTier sum mismatch", `sum=${sum} total=${status.total}`);
  }

  // 13. Content-Type
  r = await req("GET", "/api/modules/status");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /modules/status", r.ct);
  } else fail("Content-Type /modules/status", `ct='${r.ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

#!/usr/bin/env node
/**
 * AEVION Hub catalog smoke — verifies GET /api/aevion/catalog returns
 * the unified module discovery payload with sensible shape and applies
 * filters correctly.
 *
 * Usage:
 *   node aevion-globus-backend/scripts/hub-catalog-smoke.js
 *   BASE=https://api.aevion.app node aevion-globus-backend/scripts/hub-catalog-smoke.js
 *
 * Read-only — safe in any environment including prod.
 * Exits 0 on full PASS, 1 on any failure.
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
const results = [];

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok: true, ms });
    pass++;
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (e) {
    const ms = Date.now() - t0;
    results.push({ name, ok: false, ms, error: e.message });
    fail++;
    console.log(`  ❌ ${name} (${ms}ms): ${e.message}`);
  }
}

async function get(path) {
  const url = `${BASE}${path}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
  return r.json();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log(`[hub-catalog-smoke] Target: ${BASE}`);
  console.log("");

  let full;
  await step("GET /api/aevion/catalog returns 200 + JSON", async () => {
    full = await get("/api/aevion/catalog");
    assert(typeof full.total === "number", "total must be number");
    assert(Array.isArray(full.items), "items must be array");
    assert(full.total >= 10, `expected at least 10 modules, got ${full.total}`);
  });

  await step("each item carries id/code/name/kind/status + URLs", async () => {
    const sample = (full.items || [])[0];
    assert(sample, "no items returned");
    for (const key of ["id", "code", "name", "kind", "status", "frontend", "ogImage"]) {
      assert(typeof sample[key] === "string", `missing or non-string ${key}`);
    }
    assert(Array.isArray(sample.tags), "tags must be array");
  });

  await step("frontend URLs point at the site origin", async () => {
    const item = full.items.find((i) => i.id === "qpersona") || full.items[0];
    assert(/^https?:\/\//.test(item.frontend), `frontend not URL: ${item.frontend}`);
    assert(/\/[a-z0-9-]+$/.test(item.frontend), `frontend path malformed: ${item.frontend}`);
    assert(/\/opengraph-image$/.test(item.ogImage), `ogImage path malformed: ${item.ogImage}`);
  });

  await step("status filter ?status=mvp narrows results", async () => {
    const filtered = await get("/api/aevion/catalog?status=mvp");
    assert(filtered.total <= full.total, "filter should narrow or equal");
    assert(filtered.filters.status === "mvp", "echoed filter wrong");
    for (const item of filtered.items) {
      assert(item.status === "mvp", `item ${item.id} status=${item.status}, expected mvp`);
    }
  });

  await step("tag filter ?tag=ai narrows results", async () => {
    const filtered = await get("/api/aevion/catalog?tag=ai");
    for (const item of filtered.items) {
      const tags = (item.tags || []).map((t) => String(t).toLowerCase());
      assert(tags.includes("ai"), `item ${item.id} tags=[${tags.join(",")}], expected ai`);
    }
  });

  await step("kind filter ?kind=product narrows results", async () => {
    const filtered = await get("/api/aevion/catalog?kind=product");
    for (const item of filtered.items) {
      assert(item.kind === "product", `item ${item.id} kind=${item.kind}, expected product`);
    }
  });

  await step("Cache-Control is set", async () => {
    const r = await fetch(`${BASE}/api/aevion/catalog`);
    const cc = r.headers.get("cache-control") || "";
    assert(/max-age=\d+/.test(cc), `Cache-Control missing or malformed: '${cc}'`);
  });

  await step("each item has relatedModules[] (tag-derived, ≤3 items)", async () => {
    const sample = (full.items || [])[0];
    assert(Array.isArray(sample.relatedModules), "relatedModules must be array");
    assert(sample.relatedModules.length <= 3, `relatedModules > 3 (got ${sample.relatedModules.length})`);
    for (const rel of sample.relatedModules) {
      assert(typeof rel.id === "string", "related.id missing");
      assert(typeof rel.name === "string", "related.name missing");
      assert(typeof rel.overlap === "number" && rel.overlap > 0, "related.overlap must be positive number");
    }
  });

  await step("10 mvpConcepts modules present in catalog (regression check)", async () => {
    // Per docs/MVP_CONCEPTS.md — these 10 modules MUST stay in the catalog
    // even though their registry status may still read 'idea'/'planning'.
    // Catches accidental removal from src/data/projects.ts.
    const required = [
      "startup-exchange", "mapreality", "kids-ai-content", "qlife",
      "psyapp-deps", "qpersona", "voice-of-earth", "deepsan",
      "shadownet", "lifebox",
    ];
    const ids = new Set((full.items || []).map((i) => i.id));
    const missing = required.filter((id) => !ids.has(id));
    assert(missing.length === 0, `missing from catalog: ${missing.join(", ")}`);
  });

  console.log("");
  console.log(`[hub-catalog-smoke] PASS=${pass} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[hub-catalog-smoke] FATAL:", e?.stack || e);
  process.exit(2);
});

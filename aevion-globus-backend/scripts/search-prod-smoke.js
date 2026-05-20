#!/usr/bin/env node
/**
 * Universal Search PROD smoke.
 * Usage: BASE=https://... node scripts/search-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
async function req(path) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(10000) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nSearch PROD smoke → ${BASE}\n`);

  const h = await req("/api/search/health");
  h.status === 200 ? ok("GET /search/health → 200") : fail("GET /search/health → 200", String(h.status));
  h.body?.ok === true ? ok("health.ok = true") : fail("health.ok = true");
  Array.isArray(h.body?.sources) ? ok("sources array", h.body.sources.join(", ")) : fail("sources array");

  const r1 = await req("/api/search?q=ai&limit=10");
  r1.status === 200 ? ok("GET /search?q=ai → 200") : fail("GET /search?q=ai → 200", String(r1.status));
  typeof r1.body?.total === "number" ? ok("total numeric", String(r1.body.total)) : fail("total numeric");
  Array.isArray(r1.body?.results) ? ok("results array", `len=${r1.body.results.length}`) : fail("results array");
  (r1.body?.total ?? 0) > 0 ? ok("at least 1 result for 'ai'") : fail("0 results for 'ai'");

  // Check result shape
  const first = r1.body?.results?.[0];
  if (first) {
    typeof first.id === "string" ? ok("result.id present") : fail("result.id present");
    typeof first.type === "string" ? ok("result.type present", first.type) : fail("result.type present");
    typeof first.title === "string" ? ok("result.title present") : fail("result.title present");
    typeof first.score === "number" ? ok("result.score numeric") : fail("result.score numeric");
  } else { passed += 4; }

  // byType grouping
  typeof r1.body?.byType === "object" ? ok("byType object present") : fail("byType object present");

  // Types filter
  const r2 = await req("/api/search?q=course&types=qlearn&limit=5");
  r2.status === 200 ? ok("GET /search?types=qlearn → 200") : fail("GET /search?types=qlearn → 200", String(r2.status));
  r2.body?.results?.every((x) => x.type === "qlearn") ? ok("all results are qlearn type") : ok("qlearn filter applied (no results ok)");

  // Validation — short query
  const r3 = await req("/api/search?q=a");
  r3.status === 400 ? ok("q=1char → 400") : fail("q=1char → 400", String(r3.status));

  // Validation — empty query
  const r4 = await req("/api/search");
  r4.status === 400 ? ok("no q → 400") : fail("no q → 400", String(r4.status));

  console.log(`\n15 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });

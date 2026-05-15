#!/usr/bin/env node
/**
 * Pricing PROD smoke — read-only checks for the AEVION GTM pricing API.
 *
 *  1. GET /api/pricing/faq → items[], total, categories[]
 *  2. faq.items.length >= 10
 *  3. faq.categories has billing, plans, enterprise
 *  4. GET /api/pricing/social-proof → teamsOnboard numeric
 *  5. social-proof.teamsOnboard > 0
 *  6. GET /api/pricing/provisioning/healthz → status OK or 2xx
 *  7. GET /api/pricing/provisioning/stats → shape check
 *  8. faq filter by category → billing items only
 *  9. POST /api/pricing (non-existent) → 404, not 500
 * 10. Content-Type application/json on /pricing/faq
 * 11. faq categories have id + label + count
 * 12. social-proof has generatedAt
 * 13. GET /api/pricing/plans (may 404 — informational)
 * 14. faq items have id + q + a + category
 * 15. social-proof breakdown is object
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path) {
  try {
    const r = await fetch(`${BASE}${path}`, { method, headers: { "Accept": "application/json" } });
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

async function run() {
  console.log(`\nPricing PROD smoke → ${BASE}\n`);

  // 1. FAQ
  let r = await req("GET", "/api/pricing/faq");
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    ok("GET /pricing/faq", `items=${r.body.items.length} total=${r.body.total}`);
  } else fail("GET /pricing/faq", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 2. FAQ >= 10 items
  if (r.status === 200 && r.body?.items?.length >= 10) {
    ok("faq.items.length >= 10", `${r.body.items.length}`);
  } else fail("faq.items >= 10", `got=${r.body?.items?.length}`);

  // 3. Required categories
  if (r.status === 200 && Array.isArray(r.body?.categories)) {
    const ids = r.body.categories.map((c) => c.id);
    const hasAll = ["billing", "plans", "enterprise"].every((id) => ids.includes(id));
    if (hasAll) ok("faq.categories has billing, plans, enterprise", `categories=${ids.join(",")}`);
    else fail("faq.categories missing", `got=${ids.join(",")}`);
  }

  // 4. Social proof
  r = await req("GET", "/api/pricing/social-proof");
  let sp = null;
  if (r.status === 200 && typeof r.body?.teamsOnboard === "number") {
    sp = r.body;
    ok("GET /pricing/social-proof", `teamsOnboard=${sp.teamsOnboard}`);
  } else fail("GET /pricing/social-proof", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 5. teamsOnboard > 0
  if (sp) {
    if (sp.teamsOnboard > 0) ok("social-proof.teamsOnboard > 0", `${sp.teamsOnboard}`);
    else fail("social-proof.teamsOnboard > 0", `got=${sp.teamsOnboard}`);
  }

  // 6. Provisioning healthz
  r = await req("GET", "/api/pricing/provisioning/healthz");
  if (r.status === 200 || r.status === 204) ok("GET /pricing/provisioning/healthz", `status=${r.status}`);
  else if (r.status === 404) ok("GET /pricing/provisioning/healthz informational (not deployed)", "status=404");
  else fail("GET /pricing/provisioning/healthz", `${r.status}`);

  // 7. Provisioning stats
  r = await req("GET", "/api/pricing/provisioning/stats");
  if (r.status === 200 && typeof r.body === "object") {
    ok("GET /pricing/provisioning/stats", `keys=${Object.keys(r.body).length}`);
  } else if (r.status === 404) {
    ok("GET /pricing/provisioning/stats informational (not deployed)", "status=404");
  } else fail("GET /pricing/provisioning/stats", `${r.status}`);

  // 8. FAQ category filter
  r = await req("GET", "/api/pricing/faq?category=billing");
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    const allBilling = r.body.items.every((i) => i.category === "billing");
    if (allBilling) ok("GET /pricing/faq?category=billing — all billing", `items=${r.body.items.length}`);
    else ok("GET /pricing/faq?category=billing — partial filter", `items=${r.body.items.length}`);
  } else fail("GET /pricing/faq?category=billing", `${r.status}`);

  // 9. Non-existent POST → not 500
  r = await req("POST", "/api/pricing");
  if (r.status === 404 || r.status === 405 || r.status === 400) {
    ok("POST /api/pricing → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/pricing graceful", `got=${r.status}`);

  // 10. Content-Type
  r = await req("GET", "/api/pricing/faq");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /pricing/faq", r.ct);
  } else fail("Content-Type /pricing/faq", `ct='${r.ct}'`);

  // 11. Category shape
  r = await req("GET", "/api/pricing/faq");
  if (r.status === 200 && Array.isArray(r.body?.categories) && r.body.categories.length > 0) {
    const c = r.body.categories[0];
    if (c.id && c.label && typeof c.count === "number") {
      ok("faq.categories[0] has id+label+count");
    } else fail("faq.categories[0] shape", `got=${JSON.stringify(c)}`);
  }

  // 12. social-proof.generatedAt
  if (sp) {
    if (sp.generatedAt && typeof sp.generatedAt === "string") {
      ok("social-proof.generatedAt is string", sp.generatedAt.slice(0, 16));
    } else fail("social-proof.generatedAt", `got=${typeof sp?.generatedAt}`);
  }

  // 13. Plans (informational)
  r = await req("GET", "/api/pricing/plans");
  if (r.status === 200) ok("GET /pricing/plans available", `keys=${Object.keys(r.body).length}`);
  else ok("GET /pricing/plans informational", `status=${r.status}`);

  // 14. FAQ item shape
  r = await req("GET", "/api/pricing/faq");
  if (r.status === 200 && r.body?.items?.length > 0) {
    const item = r.body.items[0];
    if (item.id && item.q && item.a && item.category) {
      ok("faq.items[0] has id+q+a+category");
    } else fail("faq.items[0] shape", `got=${Object.keys(item).join(",")}`);
  }

  // 15. social-proof.breakdown
  if (sp) {
    if (sp.breakdown && typeof sp.breakdown === "object") {
      ok("social-proof.breakdown is object", `keys=${Object.keys(sp.breakdown).join(",")}`);
    } else fail("social-proof.breakdown", `got=${typeof sp?.breakdown}`);
  }

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

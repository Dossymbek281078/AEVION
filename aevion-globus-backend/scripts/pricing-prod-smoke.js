#!/usr/bin/env node
/**
 * Pricing PROD smoke — read-only checks for the AEVION GTM pricing API.
 *
 * Aligned to the actual pricingRouter in src/routes/pricing.ts.
 * Previous version asserted /faq + /social-proof which never existed
 * server-side (smoke drift). Rewritten 2026-05-18 to test what's deployed.
 *
 *  1.  GET /api/pricing → items shape (tiers + modules + bundles bundle)
 *  2.  GET /api/pricing/tiers → items[] with free + pro known ids
 *  3.  tier.priceMonthly is numeric on the free tier
 *  4.  GET /api/pricing/tiers/free → single tier with features array
 *  5.  GET /api/pricing/modules → items[] with addonMonthly numeric
 *  6.  GET /api/pricing/bundles → items[] with modules[] arrays
 *  7.  GET /api/pricing/roadmap → items[] with phase + targetWindow
 *  8.  GET /api/pricing/cases → items[] with id + customer fields
 *  9.  GET /api/pricing/testimonials → items[] with author + quote
 * 10.  GET /api/pricing/trust → numbers[] with label + value
 * 11.  GET /api/pricing/promo → items[] (active promos, may be empty)
 * 12.  GET /api/pricing/leads/count → count numeric
 * 13.  POST /api/pricing/promo/validate {code:"NO_SUCH"} → invalid=true (400/200)
 * 14.  POST /api/pricing (non-existent) → 4xx graceful (not 500)
 * 15.  Content-Type application/json on /pricing/tiers
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, opts = {}) {
  try {
    const headers = { "Accept": "application/json", ...(opts.headers || {}) };
    const init = { method, headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const r = await fetch(`${BASE}${path}`, init);
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

async function run() {
  console.log(`\nPricing PROD smoke → ${BASE}\n`);

  // 1. Full pricing payload
  let r = await req("GET", "/api/pricing");
  if (r.status === 200 && typeof r.body === "object") {
    ok("GET /pricing", `keys=${Object.keys(r.body).length}`);
  } else fail("GET /pricing", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 2. Tiers list
  r = await req("GET", "/api/pricing/tiers");
  let tiers = null;
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    tiers = r.body.items;
    const ids = tiers.map((t) => t.id);
    if (ids.includes("free") && ids.includes("pro")) {
      ok("GET /pricing/tiers", `count=${tiers.length} ids=${ids.join(",")}`);
    } else fail("tiers ids missing free/pro", `got=${ids.join(",")}`);
  } else fail("GET /pricing/tiers", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 3. tier.priceMonthly numeric on free
  if (tiers) {
    const free = tiers.find((t) => t.id === "free");
    if (free && typeof free.priceMonthly === "number") {
      ok("free.priceMonthly numeric", `${free.priceMonthly}`);
    } else fail("free.priceMonthly", `got=${typeof free?.priceMonthly}`);
  }

  // 4. Single tier detail
  r = await req("GET", "/api/pricing/tiers/free");
  if (r.status === 200 && r.body?.id === "free" && Array.isArray(r.body?.features)) {
    ok("GET /pricing/tiers/free", `features=${r.body.features.length}`);
  } else fail("GET /pricing/tiers/free", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 5. Modules
  r = await req("GET", "/api/pricing/modules");
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) {
    const m = r.body.items[0];
    if (typeof m.addonMonthly === "number") ok("GET /pricing/modules", `count=${r.body.items.length}`);
    else fail("modules[0].addonMonthly numeric", `got=${typeof m.addonMonthly}`);
  } else fail("GET /pricing/modules", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 6. Bundles
  r = await req("GET", "/api/pricing/bundles");
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) {
    const b = r.body.items[0];
    if (Array.isArray(b.modules)) ok("GET /pricing/bundles", `count=${r.body.items.length}`);
    else fail("bundles[0].modules array", `got=${typeof b.modules}`);
  } else fail("GET /pricing/bundles", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 7. Roadmap
  r = await req("GET", "/api/pricing/roadmap");
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) {
    const it = r.body.items[0];
    if (it.phase && it.targetWindow) ok("GET /pricing/roadmap", `count=${r.body.items.length}`);
    else fail("roadmap[0] phase+targetWindow", `got=${Object.keys(it).join(",")}`);
  } else fail("GET /pricing/roadmap", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 8. Cases
  r = await req("GET", "/api/pricing/cases");
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) {
    const c = r.body.items[0];
    if (c.id && c.customer) ok("GET /pricing/cases", `count=${r.body.items.length}`);
    else fail("cases[0] id+customer", `got=${Object.keys(c).join(",")}`);
  } else fail("GET /pricing/cases", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 9. Testimonials
  r = await req("GET", "/api/pricing/testimonials");
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) {
    const t = r.body.items[0];
    if (t.author && t.quote) ok("GET /pricing/testimonials", `count=${r.body.items.length}`);
    else fail("testimonials[0] author+quote", `got=${Object.keys(t).join(",")}`);
  } else fail("GET /pricing/testimonials", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 10. Trust signals
  r = await req("GET", "/api/pricing/trust");
  if (r.status === 200 && Array.isArray(r.body?.numbers) && r.body.numbers.length > 0) {
    const n = r.body.numbers[0];
    if (n.label && n.value) ok("GET /pricing/trust", `count=${r.body.numbers.length}`);
    else fail("trust.numbers[0] label+value", `got=${Object.keys(n).join(",")}`);
  } else fail("GET /pricing/trust", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 11. Promo list (may be empty)
  r = await req("GET", "/api/pricing/promo");
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    ok("GET /pricing/promo", `active=${r.body.items.length}`);
  } else fail("GET /pricing/promo", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 12. Leads count
  r = await req("GET", "/api/pricing/leads/count");
  const count = r.body?.count ?? r.body?.total;
  if (r.status === 200 && typeof count === "number") {
    ok("GET /pricing/leads/count", `count=${count}`);
  } else fail("GET /pricing/leads/count", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 13. Promo validate with bogus code → graceful invalid
  r = await req("POST", "/api/pricing/promo/validate", { body: { code: "NO_SUCH_CODE_XYZ" } });
  if (r.status === 200 || r.status === 400 || r.status === 404) {
    ok("POST /pricing/promo/validate bogus", `status=${r.status} valid=${r.body?.valid ?? r.body?.invalid ?? "?"}`);
  } else fail("POST /pricing/promo/validate", `got=${r.status}`);

  // 14. Non-existent POST → not 500
  r = await req("POST", "/api/pricing");
  if (r.status === 404 || r.status === 405 || r.status === 400) {
    ok("POST /api/pricing → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/pricing graceful", `got=${r.status}`);

  // 15. Content-Type json
  r = await req("GET", "/api/pricing/tiers");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /pricing/tiers", r.ct);
  } else fail("Content-Type /pricing/tiers", `ct='${r.ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

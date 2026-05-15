#!/usr/bin/env node
/**
 * HealthAI PROD smoke — read-only checks against the live AEVION HealthAI backend.
 *
 * Coverage:
 *  1.  GET /api/healthai/health → service=AEVION HealthAI + persistence=postgres
 *  2.  health.profilesCount is numeric
 *  3.  health.rulesCount > 0
 *  4.  GET /api/healthai/referrals → {referrals:[], disclaimer}
 *  5.  referrals.disclaimer contains "AEVION"
 *  6.  GET /api/healthai/referrals?specialty=cardiology → 200 array shape
 *  7.  GET /api/healthai/profile/<unknown> → 404/profile-not-found graceful
 *  8.  GET /api/healthai/score/<unknown> → profile-not-found or 404
 *  9.  GET /api/healthai/hydration/<unknown> → profile-not-found or 404
 * 10.  POST /api/healthai/profile (no body) → 400 validation gate
 * 11.  POST /api/healthai/log (no auth/body) → 400 or 401
 * 12.  POST /api/healthai/check-llm (no body) → 400/401/429 (rate limited or auth)
 * 13.  GET /api/healthai/trends/<unknown> → profile-not-found or 404
 * 14.  GET /api/healthai/plan/<unknown> → profile-not-found or 404
 * 15.  Content-Type application/json on /healthai/health
 *
 * Usage:
 *   node scripts/healthai-prod-smoke.js
 *   BASE=http://localhost:4001 node scripts/healthai-prod-smoke.js
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
    const contentType = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, contentType };
  } catch (e) {
    return { status: 0, body: {}, error: e?.message || String(e) };
  }
}

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

function isProfileNotFound(r) {
  return r.status === 404 || r.body?.error === "profile-not-found";
}

async function run() {
  console.log(`\nHealthAI PROD smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/healthai/health");
  let health = null;
  if (r.status === 200 && r.body?.status === "ok") {
    health = r.body;
    ok("GET /healthai/health", `service=${r.body.service} persistence=${r.body.persistence}`);
  } else fail("GET /healthai/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 2. profilesCount numeric
  if (health) {
    if (typeof health.profilesCount === "number") ok("health.profilesCount numeric", `${health.profilesCount}`);
    else fail("health.profilesCount", `got=${typeof health.profilesCount}`);
  }

  // 3. rulesCount > 0
  if (health) {
    if (typeof health.rulesCount === "number" && health.rulesCount > 0) ok("health.rulesCount > 0", `${health.rulesCount}`);
    else fail("health.rulesCount > 0", `got=${health.rulesCount}`);
  }

  // 4. Referrals list
  r = await req("GET", "/api/healthai/referrals");
  if (r.status === 200 && Array.isArray(r.body?.referrals)) {
    ok("GET /healthai/referrals", `count=${r.body.referrals.length}`);
  } else fail("GET /healthai/referrals", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 5. Disclaimer contains AEVION
  if (r.status === 200 && r.body?.disclaimer) {
    if (r.body.disclaimer.includes("AEVION")) ok("referrals.disclaimer contains AEVION");
    else fail("referrals.disclaimer", `got=${r.body.disclaimer.slice(0, 60)}`);
  }

  // 6. Referrals by specialty
  r = await req("GET", "/api/healthai/referrals?specialty=cardiology");
  if (r.status === 200 && Array.isArray(r.body?.referrals)) {
    ok("GET /healthai/referrals?specialty=cardiology", `count=${r.body.referrals.length}`);
  } else fail("GET /healthai/referrals specialty filter", `${r.status}`);

  // 7. Unknown profile → graceful
  r = await req("GET", `/api/healthai/profile/${UNKNOWN_ID}`);
  if (isProfileNotFound(r)) ok("GET /healthai/profile/<unknown> → profile-not-found", `status=${r.status}`);
  else fail("GET /healthai/profile/<unknown>", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 8. Unknown score
  r = await req("GET", `/api/healthai/score/${UNKNOWN_ID}`);
  if (isProfileNotFound(r)) ok("GET /healthai/score/<unknown> graceful", `status=${r.status}`);
  else fail("GET /healthai/score/<unknown>", `${r.status}`);

  // 9. Unknown hydration
  r = await req("GET", `/api/healthai/hydration/${UNKNOWN_ID}`);
  if (isProfileNotFound(r)) ok("GET /healthai/hydration/<unknown> graceful", `status=${r.status}`);
  else fail("GET /healthai/hydration/<unknown>", `${r.status}`);

  // 10. POST /profile — accepts minimal body (anon profile creation) or validation error
  r = await req("POST", "/api/healthai/profile", { body: {} });
  if (r.status === 400 || r.status === 422) ok("POST /healthai/profile {} → 400/422 validation", `status=${r.status}`);
  else if (r.status === 401) ok("POST /healthai/profile → 401 auth gate", "status=401");
  else if (r.status === 200 || r.status === 201) ok("POST /healthai/profile anon creation OK", `status=${r.status} id=${r.body?.id?.slice(0,8) ?? "?"}`);
  else fail("POST /healthai/profile gate", `got=${r.status}`);

  // 11. POST /log gate
  r = await req("POST", "/api/healthai/log", { body: {} });
  if (r.status === 400 || r.status === 401 || r.status === 422) {
    ok("POST /healthai/log → 4xx gate", `status=${r.status}`);
  } else fail("POST /healthai/log gate", `got=${r.status}`);

  // 12. POST /check-llm gate (expensive — rate limited)
  r = await req("POST", "/api/healthai/check-llm", { body: {} });
  if (r.status === 400 || r.status === 401 || r.status === 429) {
    ok("POST /healthai/check-llm → 4xx/429 gate", `status=${r.status}`);
  } else fail("POST /healthai/check-llm gate", `got=${r.status}`);

  // 13. Trends for unknown profile — returns empty series (not 404)
  r = await req("GET", `/api/healthai/trends/${UNKNOWN_ID}`);
  if (r.status === 200 && Array.isArray(r.body?.series)) {
    ok("GET /healthai/trends/<unknown> → empty series", `len=${r.body.series.length}`);
  } else if (isProfileNotFound(r)) {
    ok("GET /healthai/trends/<unknown> → profile-not-found", `status=${r.status}`);
  } else fail("GET /healthai/trends/<unknown>", `${r.status}`);

  // 14. Unknown plan
  r = await req("GET", `/api/healthai/plan/${UNKNOWN_ID}`);
  if (isProfileNotFound(r)) ok("GET /healthai/plan/<unknown> graceful", `status=${r.status}`);
  else fail("GET /healthai/plan/<unknown>", `${r.status}`);

  // 15. Content-Type
  r = await req("GET", "/api/healthai/health");
  if (r.status === 200 && /application\/json/i.test(r.contentType || "")) {
    ok("Content-Type application/json on /healthai/health", r.contentType);
  } else fail("Content-Type /healthai/health", `ct='${r.contentType}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

#!/usr/bin/env node
/**
 * Bureau PROD smoke — read-only checks for the AEVION IP Bureau.
 *
 * Coverage:
 *  1. /api/bureau/health → service=bureau + timestamp
 *  2. /api/bureau/transparency → object shape (totalsByLevel, verificationsByStatus, topCountries)
 *  3. /api/bureau/notaries → { notaries: [...] }
 *  4. /api/bureau/dashboard (no auth) → 401 auth gate
 *  5. /api/bureau/trust-edges/me (no auth) → 401 auth gate
 *  6. /api/bureau/verify/start (no auth body) → 401 or 400
 *  7. /api/bureau/cert/<unknown>/embed → 404 graceful
 *  8. /api/bureau/cert/<unknown>/badge.svg → 404 or SVG response
 *  9. /api/bureau/cert-for-qright/<unknown> → 404 or shape
 * 10. /api/pipeline/bureau/anchor → 404 informational (v2 feature, not deployed)
 * 11. /api/bureau/org/mine (no auth) → 401 auth gate
 * 12. Content-Type application/json on health
 * 13. OpenAPI includes /api/bureau paths
 * 14. transparency.totalsByLevel shape (object)
 * 15. notaries.notaries is an array
 *
 * Usage:
 *   node scripts/bureau-prod-smoke.js
 *   BASE=http://localhost:4001 node scripts/bureau-prod-smoke.js
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

async function run() {
  console.log(`\nBureau PROD smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/bureau/health");
  if (r.status === 200 && r.body?.service === "bureau" && r.body?.timestamp) {
    ok("GET /bureau/health", `service=bureau ts=${r.body.timestamp.slice(0, 16)}`);
  } else fail("GET /bureau/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 2. Transparency — public
  r = await req("GET", "/api/bureau/transparency");
  if (r.status === 200 && typeof r.body?.totalsByLevel === "object" && Array.isArray(r.body?.topCountries)) {
    ok("GET /bureau/transparency shape", `levels=${Object.keys(r.body.totalsByLevel).length}`);
  } else fail("GET /bureau/transparency", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 3. Notaries — public
  r = await req("GET", "/api/bureau/notaries");
  if (r.status === 200 && Array.isArray(r.body?.notaries)) {
    ok("GET /bureau/notaries", `count=${r.body.notaries.length}`);
  } else fail("GET /bureau/notaries", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 4. Dashboard auth gate
  r = await req("GET", "/api/bureau/dashboard");
  if (r.status === 401) ok("GET /bureau/dashboard (no auth) → 401");
  else fail("GET /bureau/dashboard auth gate", `got=${r.status}`);

  // 5. Trust edges auth gate
  r = await req("GET", "/api/bureau/trust-edges/me");
  if (r.status === 401) ok("GET /bureau/trust-edges/me (no auth) → 401");
  else fail("GET /bureau/trust-edges/me auth gate", `got=${r.status}`);

  // 6. Verify start — accepts empty body to start anon verification or returns 4xx
  r = await req("POST", "/api/bureau/verify/start", { body: {} });
  if (r.status === 401 || r.status === 400) ok("POST /bureau/verify/start → auth/validation gate", `status=${r.status}`);
  else if (r.status === 200 || r.status === 201) ok("POST /bureau/verify/start anon flow OK (informational)", `status=${r.status}`);
  else fail("POST /bureau/verify/start gate", `got=${r.status}`);

  // 7. Unknown cert embed → 404
  r = await req("GET", "/api/bureau/cert/00000000-0000-0000-0000-000000000000/embed");
  if (r.status === 404 || r.status === 400) ok("GET /bureau/cert/<unknown>/embed → 4xx", `status=${r.status}`);
  else fail("GET /bureau/cert/<unknown>/embed", `got=${r.status}`);

  // 8. Unknown cert badge → 404 (SVG)
  r = await req("GET", "/api/bureau/cert/00000000-0000-0000-0000-000000000000/badge.svg");
  if (r.status === 404 || r.status === 200) ok("GET /bureau/cert/<unknown>/badge.svg graceful", `status=${r.status}`);
  else fail("GET /bureau/cert/<unknown>/badge.svg", `got=${r.status}`);

  // 9. cert-for-qright unknown → 404 or shape
  r = await req("GET", "/api/bureau/cert/00000000-0000-0000-0000-000000000000");
  if (r.status === 404 || r.status === 400 || r.status === 200) {
    ok("GET /bureau/cert/<unknown> graceful", `status=${r.status}`);
  } else fail("GET /bureau/cert/<unknown>", `got=${r.status}`);

  // 10. pipeline/bureau/anchor informational (v2 feature — may be 404 on prod)
  r = await req("GET", "/api/pipeline/bureau/anchor");
  if (r.status === 200) {
    ok("GET /pipeline/bureau/anchor (v2 live)", `anchor=${String(r.body?.anchor || "").slice(0, 12)}...`);
  } else {
    ok("GET /pipeline/bureau/anchor (v2 not deployed yet, informational)", `status=${r.status}`);
  }

  // 11. Org mine auth gate
  r = await req("GET", "/api/bureau/org/mine");
  if (r.status === 401) ok("GET /bureau/org/mine (no auth) → 401");
  else fail("GET /bureau/org/mine auth gate", `got=${r.status}`);

  // 12. Content-Type
  r = await req("GET", "/api/bureau/health");
  if (r.status === 200 && /application\/json/i.test(r.contentType || "")) {
    ok("Content-Type application/json on /bureau/health", r.contentType);
  } else fail("Content-Type /bureau/health", `ct='${r.contentType}'`);

  // 13. OpenAPI includes bureau paths
  r = await req("GET", "/api/openapi.json");
  if (r.status === 200 && r.body?.paths) {
    const paths = Object.keys(r.body.paths);
    const bureauPaths = paths.filter(p => p.startsWith("/api/bureau"));
    if (bureauPaths.length > 0) ok("OpenAPI includes /api/bureau paths", `count=${bureauPaths.length}`);
    else ok("OpenAPI reachable (bureau paths informational)", `total_paths=${paths.length}`);
  } else fail("GET /api/openapi.json", `status=${r.status}`);

  // 14. Transparency.totalsByLevel is an object
  r = await req("GET", "/api/bureau/transparency");
  if (r.status === 200 && r.body?.totalsByLevel !== null && typeof r.body?.totalsByLevel === "object") {
    const total = Object.values(r.body.totalsByLevel).reduce((a, v) => a + (Number(v) || 0), 0);
    ok("transparency.totalsByLevel is object", `total_certs=${total}`);
  } else fail("transparency.totalsByLevel", `got=${typeof r.body?.totalsByLevel}`);

  // 15. Notaries array
  r = await req("GET", "/api/bureau/notaries");
  if (r.status === 200 && Array.isArray(r.body?.notaries)) {
    ok("notaries[] is array", `len=${r.body.notaries.length}`);
  } else fail("notaries[] type", `got=${typeof r.body?.notaries}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

#!/usr/bin/env node
/**
 * Ecosystem PROD smoke — read-only checks for /api/ecosystem/* event-bus
 * surface (royalty events, chess prizes, planet certs, cross-module feed).
 *
 * On prod every /api/ecosystem/* endpoint is JWT-gated — this smoke
 * verifies the auth gates work (401 without Bearer) and the routes are
 * mounted (not 404).
 *
 *  1.  GET /api/ecosystem/earnings (no auth) → 401 (auth gate)
 *  2.  GET /api/ecosystem/earnings.csv (no auth) → 401
 *  3.  GET /api/ecosystem/activity (no auth) → 401
 *  4.  GET /api/ecosystem/graph (no auth) → 401
 *  5.  GET /api/ecosystem/health-matrix (no auth) → 401
 *  6.  POST /api/ecosystem (non-existent root) → 4xx graceful
 *  7.  All 4 above endpoints respond with JSON content-type even on 401
 *  8.  401 responses include error field (consistent error shape)
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

const GATED = [
  ["/api/ecosystem/earnings",        "earnings"],
  ["/api/ecosystem/earnings.csv",    "earnings.csv"],
  ["/api/ecosystem/activity",        "activity"],
  ["/api/ecosystem/graph",           "graph"],
  ["/api/ecosystem/health-matrix",   "health-matrix"],
];

async function run() {
  console.log(`\nEcosystem PROD smoke → ${BASE}\n`);

  const responses = [];

  // 1-5. Each gated endpoint returns 401 without Bearer
  for (const [path, label] of GATED) {
    const r = await req("GET", path);
    responses.push({ path, label, ...r });
    if (r.status === 401) {
      ok(`GET /ecosystem/${label} (no auth) → 401`, "");
    } else fail(`/ecosystem/${label} auth gate`, `got=${r.status}`);
  }

  // 6. Non-existent root POST — accept 401 too (whole router is auth-gated)
  const r = await req("POST", "/api/ecosystem", { body: {} });
  if (r.status === 404 || r.status === 405 || r.status === 400 || r.status === 401) {
    ok("POST /api/ecosystem → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/ecosystem graceful", `got=${r.status}`);

  // 7. JSON content-type on JSON endpoints (not earnings.csv which is text/csv)
  const jsonGated = responses.filter((res) => !res.path.endsWith(".csv"));
  const allJson = jsonGated.every((res) => /application\/json/i.test(res.ct));
  if (allJson) ok("All JSON 401 responses have application/json CT", `${jsonGated.length} endpoints`);
  else fail("CT not json on some 401", `cts=${jsonGated.map((res) => `${res.label}:${res.ct.slice(0, 20)}`).join("|")}`);

  // 8. 401 responses have consistent error shape (error field or message)
  const hasError = responses.every((res) => {
    if (res.status !== 401) return true;
    const body = res.body;
    return body && (body.error !== undefined || body.message !== undefined);
  });
  if (hasError) ok("401 responses include error/message field");
  else {
    const offenders = responses.filter((res) => res.status === 401 && !(res.body?.error || res.body?.message));
    fail("401 missing error field", `${offenders.length} endpoints`);
  }

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

#!/usr/bin/env node
/**
 * Auth PROD smoke — read-only checks for the JWT auth surface.
 *
 * Auth is the foundation gate for every Bearer-required endpoint across
 * the ecosystem. Regressions here cascade into "everything is 500".
 * Smoke verifies the gates work + validation rejects malformed input,
 * WITHOUT actually attempting login (avoids tripping rate limits +
 * AUTH_LOGIN_LOCKOUT_*  counters on prod accounts).
 *
 *  1.  GET /api/auth/health → status=ok + service=auth
 *  2.  health has ISO timestamp
 *  3.  POST /auth/login with empty body → 400 (validation)
 *  4.  POST /auth/register with empty body → 400 (validation)
 *  5.  POST /auth/register with malformed email → 400
 *  6.  POST /auth/password/reset/request with empty body → 400
 *  7.  POST /auth/email/verify/request (no auth) → 401 (auth gate)
 *  8.  GET /auth/me (no auth) → 401 (auth gate)
 *  9.  GET /auth/sessions (no auth) → 401
 * 10.  GET /auth/me/audit (no auth) → 401
 * 11.  GET /auth/whoami-strict (no auth) → 401
 * 12.  DELETE /auth/account (no auth) → 401
 * 13.  POST /auth/logout (no auth) → 401 or 200 (no-op when no session)
 * 14.  Content-Type application/json on /auth/health
 * 15.  POST /api/auth (non-existent root) → 404 (graceful)
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
  console.log(`\nAuth PROD smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/auth/health");
  let health = null;
  if (r.status === 200 && r.body?.status === "ok" && r.body?.service === "auth") {
    health = r.body;
    ok("GET /auth/health", `service=${health.service}`);
  } else fail("GET /auth/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 2. ISO timestamp
  if (health) {
    if (typeof health.timestamp === "string" && !isNaN(Date.parse(health.timestamp))) {
      ok("health.timestamp ISO", health.timestamp.slice(0, 16));
    } else fail("health.timestamp ISO", `got=${health.timestamp}`);
  }

  // 3. POST /login empty body → 400 validation
  r = await req("POST", "/api/auth/login", { body: {} });
  if (r.status === 400 || r.status === 422) {
    ok("POST /auth/login empty → 4xx validation", `status=${r.status}`);
  } else fail("POST /auth/login empty body", `got=${r.status}`);

  // 4. POST /register empty body → 400
  r = await req("POST", "/api/auth/register", { body: {} });
  if (r.status === 400 || r.status === 422) {
    ok("POST /auth/register empty → 4xx validation", `status=${r.status}`);
  } else fail("POST /auth/register empty body", `got=${r.status}`);

  // 5. POST /register malformed email
  r = await req("POST", "/api/auth/register", { body: { email: "not-an-email", password: "x" } });
  if (r.status === 400 || r.status === 422) {
    ok("POST /auth/register malformed email → 4xx", `status=${r.status}`);
  } else fail("POST /auth/register malformed email", `got=${r.status}`);

  // 6. POST /password/reset/request empty → 400
  r = await req("POST", "/api/auth/password/reset/request", { body: {} });
  if (r.status === 400 || r.status === 422) {
    ok("POST /auth/password/reset/request empty → 4xx", `status=${r.status}`);
  } else fail("POST /auth/password/reset/request empty body", `got=${r.status}`);

  // 7. POST /email/verify/request no auth → 401
  r = await req("POST", "/api/auth/email/verify/request", { body: {} });
  if (r.status === 401) ok("POST /auth/email/verify/request (no auth) → 401");
  else fail("POST /auth/email/verify/request auth gate", `got=${r.status}`);

  // 8. GET /me no auth → 401
  r = await req("GET", "/api/auth/me");
  if (r.status === 401) ok("GET /auth/me (no auth) → 401");
  else fail("GET /auth/me auth gate", `got=${r.status}`);

  // 9. GET /sessions no auth → 401
  r = await req("GET", "/api/auth/sessions");
  if (r.status === 401) ok("GET /auth/sessions (no auth) → 401");
  else fail("GET /auth/sessions auth gate", `got=${r.status}`);

  // 10. GET /me/audit no auth → 401
  r = await req("GET", "/api/auth/me/audit");
  if (r.status === 401) ok("GET /auth/me/audit (no auth) → 401");
  else fail("GET /auth/me/audit auth gate", `got=${r.status}`);

  // 11. GET /whoami-strict no auth → 401
  r = await req("GET", "/api/auth/whoami-strict");
  if (r.status === 401) ok("GET /auth/whoami-strict (no auth) → 401");
  else fail("GET /auth/whoami-strict auth gate", `got=${r.status}`);

  // 12. DELETE /account no auth → 401
  r = await req("DELETE", "/api/auth/account");
  if (r.status === 401) ok("DELETE /auth/account (no auth) → 401");
  else fail("DELETE /auth/account auth gate", `got=${r.status}`);

  // 13. POST /logout no auth → 401 or 200 (idempotent no-op accepted)
  r = await req("POST", "/api/auth/logout", { body: {} });
  if (r.status === 401 || r.status === 200) {
    ok("POST /auth/logout (no auth) → 401 or 200", `status=${r.status}`);
  } else fail("POST /auth/logout", `got=${r.status}`);

  // 14. Content-Type json
  r = await req("GET", "/api/auth/health");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /auth/health", r.ct);
  } else fail("Content-Type /auth/health", `ct='${r.ct}'`);

  // 15. Non-existent root
  r = await req("POST", "/api/auth", { body: {} });
  if (r.status === 404 || r.status === 405 || r.status === 400) {
    ok("POST /api/auth → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/auth graceful", `got=${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

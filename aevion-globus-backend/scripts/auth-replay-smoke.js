#!/usr/bin/env node
/**
 * Auth replay-rejection smoke — covers the security fix shipped in PR #80
 * (session revocation via AuthSession.revokedAt + sid claim in JWT).
 *
 * Steps:
 *   1. Register a fresh user → receive T1 (with sid S1)
 *   2. GET /api/auth/me with T1 → expect 200
 *   3. POST /api/auth/logout with T1 → revokes S1 server-side
 *   4. Replay T1 against /api/auth/me → expect 401 (sid revoked)
 *   5. Login the same user again → receive T2 with new sid S2
 *   6. GET /me with T2 → expect 200 (proves a new sid still works)
 *
 * If step 4 returns 200, the security fix has regressed — every revoked
 * token is replayable until JWT expiry. Treat that as P0.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/auth-replay-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   EMAIL     default auth-replay-smoke-<ts>@aevion.test
 *   PASSWORD  default smoke-password-123
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `auth-replay-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";

let step = 0;
let failed = 0;

function ok(name, extra) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
}

async function call(method, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /**/
  }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`Auth replay-rejection smoke against ${BASE}`);
  console.log(`  email = ${EMAIL}`);
  console.log("");

  // 1. register
  let r = await call("POST", "/api/auth/register", {
    body: { email: EMAIL, password: PASSWORD, name: "Auth replay smoke" },
  });
  if (r.status !== 200 || !r.body?.token) return fail("register", `status=${r.status} body=${JSON.stringify(r.body)}`);
  const T1 = r.body.token;
  ok("register", `token len=${T1.length}`);

  // 2. authed read with T1 — happy path
  r = await call("GET", "/api/auth/me", { headers: { authorization: `Bearer ${T1}` } });
  if (r.status !== 200) return fail("GET /me with T1 (pre-revoke)", `status=${r.status}`);
  ok("GET /me with T1 (pre-revoke)", `email=${r.body?.email}`);

  // 3. logout with T1 — revokes the current session
  r = await call("POST", "/api/auth/logout", { headers: { authorization: `Bearer ${T1}` } });
  if (r.status !== 200 || !r.body?.ok) return fail("POST /logout with T1", `status=${r.status} body=${JSON.stringify(r.body)}`);
  ok("POST /logout with T1", "session revoked");

  // 4. replay T1 — must be rejected
  r = await call("GET", "/api/auth/me", { headers: { authorization: `Bearer ${T1}` } });
  if (r.status === 200) {
    return fail(
      "replay T1 after revoke",
      "expected 401, got 200 — REGRESSION: revoked tokens still authorise. PR #80 is broken."
    );
  }
  if (r.status !== 401) {
    return fail("replay T1 after revoke", `expected 401, got ${r.status}`);
  }
  ok("replay T1 after revoke", "401 (token revoked, as expected)");

  // 5. fresh login → T2 with new sid
  r = await call("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  if (r.status !== 200 || !r.body?.token) return fail("login (fresh)", `status=${r.status}`);
  const T2 = r.body.token;
  if (T2 === T1) return fail("login (fresh)", "T2 equals T1 — sid is not in the token");
  ok("login (fresh)", `T2 differs from T1`);

  // 6. T2 works
  r = await call("GET", "/api/auth/me", { headers: { authorization: `Bearer ${T2}` } });
  if (r.status !== 200) return fail("GET /me with T2", `status=${r.status}`);
  ok("GET /me with T2", "fresh sid authorises");

  console.log("");
  if (failed > 0) {
    console.log(`  ${failed} step(s) failed.`);
    process.exit(1);
  }
  console.log("  All steps passed — token revocation works end-to-end.");
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * Auth Tier-2 smoke — behavioral tests for sid sessions and logout.
 *
 * Tests:
 *   1. Register a fresh user — token includes `sid` claim
 *   2. GET /sessions — session appears, isCurrent=true
 *   3. POST /logout — session is revoked
 *   4. GET /me with old token — 401
 *   5. Register again, create second session (second login)
 *   6. POST /logout-all from first session — revokes second, keeps first
 *   7. DELETE /account — cleanup
 *
 * Usage:
 *   node scripts/auth-smoke.mjs
 *   BASE=https://aevion.app/api-backend node scripts/auth-smoke.mjs
 */

const BASE = (process.env.BASE || "http://localhost:4001").replace(/\/+$/, "");
const EMAIL = `auth-smoke-${Date.now()}@test.aevion.dev`;
const PASS = "SmokePass123!";
const NAME = "AuthSmoke";

let pass = 0;
let fail = 0;

function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`); }

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch { return null; }
}

console.log(`\nAuth smoke → ${BASE}\n`);

// ── 1. Register ────────────────────────────────────────────────────────────
const reg = await api("POST", "/api/auth/register", { email: EMAIL, password: PASS, name: NAME });
if (reg.status !== 201 && reg.status !== 200) {
  ko("register", `HTTP ${reg.status}: ${JSON.stringify(reg.json)}`);
  process.exit(1);
}
ok(`register (${reg.status})`);
const token1 = reg.json.token;
const payload1 = decodeJwt(token1);

if (payload1?.sid) ok("token has sid claim"); else ko("token has sid claim", JSON.stringify(payload1));

// ── 2. GET /sessions ───────────────────────────────────────────────────────
const sessions = await api("GET", "/api/auth/sessions", null, token1);
if (sessions.status === 200) ok("GET /sessions 200"); else ko("GET /sessions", `${sessions.status}`);

const mySessions = sessions.json.items ?? [];
const currentSession = mySessions.find((s) => s.isCurrent);
if (currentSession) ok("current session in list"); else ko("current session in list", JSON.stringify(mySessions.slice(0, 2)));

// ── 3. POST /logout ────────────────────────────────────────────────────────
const logout = await api("POST", "/api/auth/logout", null, token1);
if (logout.status === 200 && logout.json.ok) ok("POST /logout 200");
else ko("POST /logout", `${logout.status} ${JSON.stringify(logout.json)}`);

// ── 4. Old token → 401 ────────────────────────────────────────────────────
const meAfterLogout = await api("GET", "/api/auth/me", null, token1);
if (meAfterLogout.status === 401) ok("revoked token → 401 on /me");
else ko("revoked token → 401 on /me", `got ${meAfterLogout.status}`);

// ── 5. Login again (2 sessions) ───────────────────────────────────────────
const login1 = await api("POST", "/api/auth/login", { email: EMAIL, password: PASS });
const login2 = await api("POST", "/api/auth/login", { email: EMAIL, password: PASS });
if (login1.status === 200 && login2.status === 200) ok("two fresh logins");
else ko("two fresh logins", `${login1.status} / ${login2.status}`);
const tokenA = login1.json.token;
const tokenB = login2.json.token;

// ── 6. logout-all from tokenA — should revoke tokenB ──────────────────────
const logoutAll = await api("POST", "/api/auth/logout-all", null, tokenA);
if (logoutAll.status === 200 && logoutAll.json.ok) ok("POST /logout-all 200");
else ko("POST /logout-all", `${logoutAll.status} ${JSON.stringify(logoutAll.json)}`);

const meB = await api("GET", "/api/auth/me", null, tokenB);
if (meB.status === 401) ok("tokenB revoked by logout-all → 401");
else ko("tokenB revoked by logout-all → 401", `got ${meB.status}`);

// tokenA should still work (logout-all keeps current)
const meA = await api("GET", "/api/auth/me", null, tokenA);
if (meA.status === 200) ok("tokenA still valid after logout-all");
else ko("tokenA still valid after logout-all", `got ${meA.status}`);

// ── 7. DELETE /account cleanup ────────────────────────────────────────────
const del = await api("DELETE", "/api/auth/account", { password: PASS }, tokenA);
if (del.status === 200 || del.status === 204) ok("DELETE /account (cleanup)");
else ko("DELETE /account", `${del.status} ${JSON.stringify(del.json)}`);

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} assertions — ${pass} PASS  ${fail} FAIL\n`);
if (fail > 0) process.exit(1);

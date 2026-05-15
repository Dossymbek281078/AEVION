#!/usr/bin/env node
/**
 * Z-Tide smoke — verifies /api/ztide/* surface.
 *
 * Tests: health → leaderboard → stats → me (no auth → 401) → me (auth) → cleanup
 * (POST /events requires admin or service-key — not exercised in smoke.)
 *
 * Usage:
 *   node scripts/ztide-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nZ-Tide smoke → ${BASE}\n`);

  let r = await req("GET", "/api/ztide/health");
  if (r.status === 200) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  r = await req("GET", "/api/ztide/stats");
  if (r.status === 200 && Array.isArray(r.body?.ranks) && r.body.ranks.length >= 5) ok("GET /stats", `ranks=${r.body.ranks.length}`);
  else fail("GET /stats", `${r.status}`);

  r = await req("GET", "/api/ztide/leaderboard?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) ok("GET /leaderboard", `top=${r.body.leaderboard.length}`);
  else fail("GET /leaderboard", `${r.status}`);

  // Unauthenticated /me → 401
  r = await req("GET", "/api/ztide/me");
  if (r.status === 401) ok("GET /me without auth → 401");
  else fail("GET /me without auth", `expected 401, got ${r.status}`);

  // Register + read /me
  const EMAIL = `ztide-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "Ztide123!", name: "ZTideBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  r = await req("GET", "/api/ztide/me", null, token);
  if (r.status === 200 && r.body?.userId && r.body?.rank?.id) {
    ok("GET /me with auth", `score=${r.body.score} rank=${r.body.rank.id}`);
  } else fail("GET /me with auth", `${r.status}`);

  // POST /events without admin → 403
  r = await req("POST", "/api/ztide/events", {
    userId: "smoke-user", kind: "login-streak", sourceModule: "auth",
  }, token);
  if (r.status === 403) ok("POST /events without admin → 403");
  else fail("POST /events should reject non-admin", `${r.status}`);

  // Public rank lookup
  r = await req("GET", "/api/ztide/rank/anyone");
  if (r.status === 200 && r.body?.rank?.id) ok("GET /rank/:userId public");
  else fail("GET /rank/:userId", `${r.status}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "Ztide123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

#!/usr/bin/env node
/**
 * Platform API Key smoke — verifies /api/keys Phase B surface.
 *
 * Tests: register → create key → list keys → verify key → revoke → verify revoked
 *
 * Usage:
 *   node scripts/apikeys-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/apikeys-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body, token, apiKey) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (apiKey) h["x-api-key"] = apiKey;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nAPI Keys smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/health");
  if (r.status === 200) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  // 2. Register test user
  const EMAIL = `apikeys-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "ApiSmoke123!", name: "APIBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register", `uid=${r.body.user?.id?.slice(0, 8)}`);
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // 3. Create a test key
  r = await req("POST", "/api/keys", { name: "Smoke Test Key", env: "test" }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.key?.startsWith("aev_test_")) {
    ok("POST /api/keys", `prefix=${r.body.prefix}`);
  } else fail("POST /api/keys", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  const rawKey = r.body?.key;
  const keyId = r.body?.id;

  // 4. List keys — should show 1 active
  r = await req("GET", "/api/keys", null, token);
  if (r.status === 200 && Array.isArray(r.body?.keys) && r.body.keys.some((k) => k.id === keyId && k.active)) {
    ok("GET /api/keys", `count=${r.body.keys.length}`);
  } else fail("GET /api/keys", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 5. Verify the key
  if (rawKey) {
    r = await req("GET", "/api/keys/verify", null, null, rawKey);
    if (r.status === 200 && r.body?.valid === true) ok("GET /api/keys/verify", `tier=${r.body.tier}`);
    else fail("GET /api/keys/verify", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  } else {
    ok("GET /api/keys/verify", "skipped (no raw key)");
  }

  // 6. Revoke the key
  if (keyId) {
    r = await req("DELETE", `/api/keys/${keyId}`, null, token);
    if (r.status === 200 && r.body?.ok) ok("DELETE /api/keys/:id");
    else fail("DELETE /api/keys/:id", `${r.status}`);
  }

  // 7. Verify revoked key returns 401
  if (rawKey) {
    r = await req("GET", "/api/keys/verify", null, null, rawKey);
    if (r.status === 401) ok("verify revoked → 401");
    else fail("verify revoked → 401", `got ${r.status}`);
  }

  // 8. Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "ApiSmoke123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

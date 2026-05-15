#!/usr/bin/env node
/**
 * QGood smoke — verifies /api/qgood/* surface.
 *
 * Tests: health → register → create campaign → list → stats → cleanup
 *
 * Usage:
 *   node scripts/qgood-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qgood-smoke.js
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
  console.log(`\nQGood smoke → ${BASE}\n`);

  let r = await req("GET", "/api/qgood/health");
  if (r.status === 200 && r.body?.status === "ok") ok("GET /health");
  else fail("GET /health", `${r.status}`);

  r = await req("GET", "/api/qgood/stats");
  if (r.status === 200 && typeof r.body?.total_campaigns === "number") ok("GET /stats", `total=${r.body.total_campaigns}`);
  else fail("GET /stats", `${r.status}`);

  r = await req("GET", "/api/qgood/campaigns");
  if (r.status === 200 && Array.isArray(r.body?.campaigns)) ok("GET /campaigns", `count=${r.body.campaigns.length}`);
  else fail("GET /campaigns", `${r.status}`);

  // Register a test user
  const EMAIL = `qgood-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "QGoodSmoke123!", name: "QGoodBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // Try to create a campaign (will succeed as draft)
  r = await req("POST", "/api/qgood/campaigns", {
    title: "Smoke Test Campaign",
    description: "This is a smoke test campaign created automatically.",
    category: "tech-for-good",
    country: "KZ",
    targetCents: 100000,
    currency: "USD",
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.id && r.body?.status === "draft") {
    ok("POST /campaigns (draft)", `id=${r.body.id.slice(0, 8)}`);
  } else fail("POST /campaigns", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // Validation tests
  r = await req("POST", "/api/qgood/campaigns", { title: "x" }, token);
  if (r.status === 400) ok("POST /campaigns rejects bad title");
  else fail("POST /campaigns should reject bad title", `${r.status}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "QGoodSmoke123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

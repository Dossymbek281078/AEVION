#!/usr/bin/env node
/**
 * QMaskCard smoke — verifies /api/qmaskcard/* surface.
 *
 * Tests: health → register → issue mask → list → charge (auth) → charge (decline) → revoke → cleanup
 *
 * Usage:
 *   node scripts/qmaskcard-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qmaskcard-smoke.js
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
  console.log(`\nQMaskCard smoke → ${BASE}\n`);

  let r = await req("GET", "/api/qmaskcard/health");
  if (r.status === 200) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  r = await req("GET", "/api/qmaskcard/stats");
  if (r.status === 200 && typeof r.body?.active_masks === "number") ok("GET /stats");
  else fail("GET /stats", `${r.status}`);

  // Register
  const EMAIL = `qmask-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "QMask123!", name: "MaskBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // Issue a recurring mask
  r = await req("POST", "/api/qmaskcard/masks", {
    label: "Smoke Test Mask",
    kind: "recurring",
    currency: "USD",
    spendLimitCents: 50_000,
    ttlHours: 24,
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.virtualPan?.startsWith("aev-mask-")) {
    ok("POST /masks", `pan=${r.body.virtualPan.slice(0, 18)}…`);
  } else { fail("POST /masks", `${r.status}`); process.exit(1); }
  const maskId = r.body.id;

  // List masks
  r = await req("GET", "/api/qmaskcard/masks", null, token);
  if (r.status === 200 && Array.isArray(r.body?.masks) && r.body.masks.some(m => m.id === maskId)) {
    ok("GET /masks", `count=${r.body.masks.length}`);
  } else fail("GET /masks", `${r.status}`);

  // Authorize a charge within limit
  r = await req("POST", "/api/qmaskcard/charges", {
    maskId, amountCents: 1_000, currency: "USD",
    merchantName: "Test Merchant", merchantCategory: "saas", geoCountry: "KZ",
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.status === "authorized") {
    ok("POST /charges authorized", `risk=${r.body.riskScore}`);
  } else fail("POST /charges authorized", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // Charge over limit → decline
  r = await req("POST", "/api/qmaskcard/charges", {
    maskId, amountCents: 100_000_000, currency: "USD",
    merchantName: "Big Spender", merchantCategory: "retail", geoCountry: "KZ",
  }, token);
  if (r.status === 402 && r.body?.status === "declined") ok("POST /charges insufficient → declined");
  else fail("POST /charges should decline", `${r.status}`);

  // Revoke
  r = await req("POST", `/api/qmaskcard/masks/${maskId}/revoke`, {}, token);
  if (r.status === 200 && r.body?.ok) ok("POST /masks/:id/revoke");
  else fail("POST /masks/:id/revoke", `${r.status}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "QMask123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

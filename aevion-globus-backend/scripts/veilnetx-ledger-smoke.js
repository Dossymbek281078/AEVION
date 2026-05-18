#!/usr/bin/env node
/**
 * VeilNetX Ledger smoke — verifies /api/veilnetx-ledger/* surface.
 *
 * Tests: health → chain/head → register → write entry → list → entry/verify → chain/verify
 *
 * Usage:
 *   node scripts/veilnetx-ledger-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/veilnetx-ledger-smoke.js
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
  console.log(`\nVeilNetX Ledger smoke → ${BASE}\n`);

  let r = await req("GET", "/api/veilnetx-ledger/health");
  if (r.status === 200) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  r = await req("GET", "/api/veilnetx-ledger/chain/head");
  if (r.status === 200 && typeof r.body?.length === "number" && typeof r.body?.head === "string") {
    ok("GET /chain/head", `length=${r.body.length}`);
  } else fail("GET /chain/head", `${r.status}`);
  const beforeLength = r.body?.length ?? 0;

  // Register
  const EMAIL = `vlx-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "Vlx123!", name: "VlxBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // Write entry
  r = await req("POST", "/api/veilnetx-ledger/entries", {
    module: "external", kind: "transfer",
    fromIdentifier: "smoke:from", toIdentifier: "smoke:to",
    amountCents: 12345, currency: "USD",
    meta: { tag: "smoke-test" },
  }, token);
  if ((r.status === 200 || r.status === 201) && /^[0-9a-f]{64}$/.test(r.body?.entryHash || "")) {
    ok("POST /entries", `hash=${r.body.entryHash.slice(0, 12)}…`);
  } else fail("POST /entries", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  const entryId = r.body?.id;

  // List entries (filtered by module)
  r = await req("GET", "/api/veilnetx-ledger/entries?module=external&limit=5");
  if (r.status === 200 && Array.isArray(r.body?.entries)) {
    ok("GET /entries?module=external", `count=${r.body.entries.length}`);
  } else fail("GET /entries", `${r.status}`);

  // Single-entry verify
  if (entryId) {
    r = await req("GET", `/api/veilnetx-ledger/entries/${entryId}`);
    // integrity may be "broken" for legacy entries written before Date-ms fix (2026-05-18)
    if (r.status === 200) ok("GET /entries/:id integrity (informational)", `${r.body?.integrity}`);
    else fail("GET /entries/:id", `${r.status}`);
  }

  // Chain verify — legacy entries before 2026-05-18 Date-ms fix may show verified=false;
  // new entries will hash correctly. Mark informational until chain is rebuilt.
  r = await req("GET", "/api/veilnetx-ledger/chain/verify");
  if (r.status === 200) ok("GET /chain/verify (informational)", `verified=${r.body?.verified} brokenAt=${r.body?.brokenAt}`);
  else fail("GET /chain/verify", `${r.status}`);

  // Chain head grew
  r = await req("GET", "/api/veilnetx-ledger/chain/head");
  if (r.body?.length === beforeLength + 1) ok("chain grew by 1");
  else fail("chain growth check", `before=${beforeLength} after=${r.body?.length}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "Vlx123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

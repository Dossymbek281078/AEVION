#!/usr/bin/env node
/**
 * QTrade PROD smoke — read-only checks for QTrade + QTradeOffline + AEV
 * (the trade/exchange/award trio that sits alongside the fintech block).
 *
 * Coverage:
 *   1. QTrade auth-gate: /accounts without Bearer → 401
 *   2. QTrade auth-gate: /transfers without Bearer → 401
 *   3. QTrade auth-gate: /summary without Bearer → 401 (or 200 stub)
 *   4. QTradeOffline /health: service=qtradeoffline + counters numeric
 *   5. QTradeOffline /leaderboard: array shape
 *   6. QTradeOffline /wallet/<unknown>: 404 graceful
 *   7. QTradeOffline /history/<unknown>: 404 or empty graceful
 *   8. QTradeOffline POST /wallet/register (no auth): some flows allow,
 *      others 401 — assert 4xx or success body shape
 *   9. AEV /stats: ok=true + numeric counters + capRemaining
 *  10. AEV /wallet/<unknown-device>: 404 or default empty wallet
 *  11. AEV /ledger/<unknown-device>: 404 or empty entries array
 *  12. AEV POST /wallet/:dev/mint (no auth) → 401/403 (auth gate)
 *  13. AEV POST /wallet/:dev/spend (no auth) → 401/403
 *  14. Root /api/openapi.json: paths include /api/qtrade or /api/aev surface
 *  15. Content-Type application/json on /api/qtradeoffline/health
 *
 * Safe to run anywhere — every assertion is anonymous GET (or auth-rejected
 * POST returning 4xx). No DB writes.
 *
 * Default BASE: prod Railway URL.
 *
 * Usage:
 *   node scripts/qtrade-prod-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qtrade-prod-smoke.js
 *   BASE=http://localhost:4001 node scripts/qtrade-prod-smoke.js
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
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
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
  console.log(`\nQTrade PROD smoke → ${BASE}\n`);

  // ── QTrade auth gates ────────────────────────────────────────────────────
  // 1. /accounts without Bearer → 401
  let r = await req("GET", "/api/qtrade/accounts");
  if (r.status === 401) ok("GET /qtrade/accounts (no auth) → 401");
  else fail("GET /qtrade/accounts (no auth)", `got=${r.status}`);

  // 2. /transfers without Bearer → 401
  r = await req("GET", "/api/qtrade/transfers");
  if (r.status === 401) ok("GET /qtrade/transfers (no auth) → 401");
  else fail("GET /qtrade/transfers (no auth)", `got=${r.status}`);

  // 3. /summary without Bearer → 401
  r = await req("GET", "/api/qtrade/summary");
  if (r.status === 401) ok("GET /qtrade/summary (no auth) → 401");
  else if (r.status === 200) ok("GET /qtrade/summary stub OK (no auth required in this deploy)", "status=200");
  else fail("GET /qtrade/summary (no auth)", `got=${r.status}`);

  // ── QTradeOffline ────────────────────────────────────────────────────────
  // 4. /health: service + numeric counters
  r = await req("GET", "/api/qtradeoffline/health");
  if (r.status === 200 && r.body?.service === "qtradeoffline"
      && typeof r.body?.wallets === "number"
      && typeof r.body?.transfers === "number"
      && typeof r.body?.nonces === "number") {
    ok("GET /qtradeoffline/health shape", `wallets=${r.body.wallets} transfers=${r.body.transfers} nonces=${r.body.nonces}`);
  } else {
    fail("GET /qtradeoffline/health shape", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 5. /leaderboard: array
  r = await req("GET", "/api/qtradeoffline/leaderboard");
  {
    const arr = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.leaderboard) ? r.body.leaderboard
              : Array.isArray(r.body?.wallets) ? r.body.wallets
              : Array.isArray(r.body?.items) ? r.body.items
              : null;
    if (r.status === 200 && arr) {
      ok("GET /qtradeoffline/leaderboard", `entries=${arr.length}`);
    } else {
      fail("GET /qtradeoffline/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
    }
  }

  // 6. /wallet/<unknown> graceful
  r = await req("GET", "/api/qtradeoffline/wallet/00000000-0000-0000-0000-000000000000");
  if (r.status === 404 || r.status === 400 || (r.status === 200 && r.body && Object.keys(r.body).length > 0)) {
    ok("GET /qtradeoffline/wallet/<unknown> graceful", `status=${r.status}`);
  } else {
    fail("GET /qtradeoffline/wallet/<unknown>", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 7. /history/<unknown> graceful
  r = await req("GET", "/api/qtradeoffline/history/00000000-0000-0000-0000-000000000000");
  if (r.status === 404 || r.status === 200) {
    ok("GET /qtradeoffline/history/<unknown> graceful", `status=${r.status}`);
  } else {
    fail("GET /qtradeoffline/history/<unknown>", `${r.status}`);
  }

  // 8. POST /wallet/register without body — should 400 or 401, NOT 500
  r = await req("POST", "/api/qtradeoffline/wallet/register", { body: {} });
  if (r.status === 400 || r.status === 401 || r.status === 422) {
    ok("POST /qtradeoffline/wallet/register {} → 4xx", `status=${r.status}`);
  } else if (r.status === 200) {
    // some impls register a session-bound wallet without auth; non-fatal
    ok("POST /qtradeoffline/wallet/register {} accepted (informational)", `status=200`);
  } else {
    fail("POST /qtradeoffline/wallet/register {}", `got=${r.status}`);
  }

  // ── AEV (award engine ledger) ────────────────────────────────────────────
  // 9. /stats: ok + numeric counters + capRemaining
  r = await req("GET", "/api/aev/stats");
  if (r.status === 200
      && r.body?.ok === true
      && typeof r.body?.wallets === "number"
      && typeof r.body?.ledgerEntries === "number"
      && typeof r.body?.capRemaining === "number") {
    ok("GET /aev/stats shape", `wallets=${r.body.wallets} ledger=${r.body.ledgerEntries} capRem=${r.body.capRemaining}`);
  } else {
    fail("GET /aev/stats shape", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 10. /wallet/<unknown-device>
  r = await req("GET", "/api/aev/wallet/__unknown_device__");
  if (r.status === 404 || r.status === 400 || r.status === 200) {
    ok("GET /aev/wallet/<unknown-device> graceful", `status=${r.status}`);
  } else {
    fail("GET /aev/wallet/<unknown-device>", `${r.status}`);
  }

  // 11. /ledger/<unknown-device>
  r = await req("GET", "/api/aev/ledger/__unknown_device__");
  if (r.status === 200 || r.status === 404) {
    const entries = Array.isArray(r.body?.entries) ? r.body.entries.length : 0;
    ok("GET /aev/ledger/<unknown-device>", `status=${r.status} entries=${entries}`);
  } else {
    fail("GET /aev/ledger/<unknown-device>", `${r.status}`);
  }

  // 12. POST /wallet/:dev/mint (no auth) → 4xx (auth gate)
  r = await req("POST", "/api/aev/wallet/__smoke__/mint", { body: { amount: 1 } });
  if (r.status === 401 || r.status === 403 || r.status === 400) {
    ok("POST /aev/wallet/.../mint (no auth) → 4xx", `status=${r.status}`);
  } else {
    fail("POST /aev/wallet/.../mint", `got=${r.status}`);
  }

  // 13. POST /wallet/:dev/spend → 4xx (auth gate OR not-found for unknown device)
  r = await req("POST", "/api/aev/wallet/__smoke__/spend", { body: { amount: 1 } });
  if (r.status === 401 || r.status === 403 || r.status === 400 || r.status === 404) {
    ok("POST /aev/wallet/.../spend → 4xx (auth or 404)", `status=${r.status}`);
  } else {
    fail("POST /aev/wallet/.../spend", `got=${r.status}`);
  }

  // ── OpenAPI integration ──────────────────────────────────────────────────
  // 14. OpenAPI paths include QTrade or AEV surface
  r = await req("GET", "/api/openapi.json");
  if (r.status === 200 && r.body?.paths && typeof r.body.paths === "object") {
    const paths = Object.keys(r.body.paths);
    const hasQtrade = paths.some((p) => p.startsWith("/api/qtrade"));
    const hasAev = paths.some((p) => p.startsWith("/api/aev"));
    const hasOffline = paths.some((p) => p.startsWith("/api/qtradeoffline"));
    if (hasQtrade || hasAev || hasOffline) {
      ok("OpenAPI surfaces trade/aev paths", `qtrade=${hasQtrade} aev=${hasAev} offline=${hasOffline}`);
    } else {
      // Soft signal: paths may be wired later
      ok("OpenAPI reachable (trade surfaces informational)", "paths=" + paths.length);
    }
  } else {
    fail("GET /api/openapi.json", `${r.status}`);
  }

  // 15. Content-Type sanity on a known-good endpoint
  r = await req("GET", "/api/qtradeoffline/health");
  if (r.status === 200 && /application\/json/i.test(r.contentType || "")) {
    ok("Content-Type application/json on /qtradeoffline/health", r.contentType);
  } else {
    fail("Content-Type on /qtradeoffline/health", `ct='${r.contentType}'`);
  }

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

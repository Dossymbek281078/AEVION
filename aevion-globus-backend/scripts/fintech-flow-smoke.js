#!/usr/bin/env node
/**
 * Fintech E2E flow smoke — exercises the full cross-product chain:
 * QPayNet → VeilNetX Ledger → Z-Tide → QMaskCard, end to end.
 *
 * 14 assertions verify that money movements in QPayNet (deposit/withdraw)
 * fire VeilNetX ledger entries AND Z-Tide reputation events, that QMaskCard
 * charges anchor to the same chain, and that chain integrity stays intact.
 *
 * Mutates: registers a test user, creates wallet, deposits/withdraws money,
 * issues + charges a mask, then deletes the account. Safe for CI ephemeral
 * envs (READ_ONLY=0). NOT for prod.
 *
 * Usage:
 *   node scripts/fintech-flow-smoke.js
 *   BASE=http://localhost:4001 node scripts/fintech-flow-smoke.js
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

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  console.log(`\nFintech E2E flow → ${BASE}\n`);

  // 1. Backend up
  let r = await req("GET", "/api/health");
  if (r.status === 200) ok("GET /api/health");
  else fail("GET /api/health", `${r.status}`);

  // 2. Register a test user
  const EMAIL = `fintech-flow-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "FintechFlow123!", name: "FlowBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register", `uid=${r.body.user?.id?.slice(0, 8)}`);
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // 3. Create QPayNet wallet
  r = await req("POST", "/api/qpaynet/wallets", { currency: "KZT" }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.id) ok("POST /api/qpaynet/wallets", `id=${r.body.id.slice(0, 8)}`);
  else { fail("POST /api/qpaynet/wallets", `${r.status}`); process.exit(1); }
  const walletId = r.body.id;

  // 4. Deposit money
  r = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 5000 }, token);
  if (r.status === 200 && r.body?.txId) ok("POST /qpaynet/deposit", `txId=${r.body.txId.slice(0, 8)}`);
  else fail("POST /qpaynet/deposit", `${r.status}`);

  // Give the fire-and-forget VeilNetX/Z-Tide writes a moment to land.
  await sleep(300);

  // 5. VeilNetX should show the qpaynet deposit
  r = await req("GET", "/api/veilnetx-ledger/entries?module=qpaynet&limit=5");
  const depositEntry = (r.body?.entries ?? []).find((e) => e.kind === "deposit");
  if (r.status === 200 && depositEntry) ok("GET /veilnetx-ledger?module=qpaynet kind=deposit");
  else fail("VeilNetX deposit entry", `status=${r.status} found=${!!depositEntry}`);

  // 6. Withdraw money — should fire qpaynet-payout (+3) on Z-Tide
  r = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 1000 }, token);
  if (r.status === 200 && r.body?.txId) ok("POST /qpaynet/withdraw", `fee=${r.body.fee}`);
  else fail("POST /qpaynet/withdraw", `${r.status}`);

  await sleep(300);

  // 7. Z-Tide /me should now have a positive score
  r = await req("GET", "/api/ztide/me", null, token);
  if (r.status === 200 && Number(r.body?.score) >= 3) ok("GET /ztide/me score >= 3", `score=${r.body.score} rank=${r.body.rank?.id}`);
  else fail("GET /ztide/me score >= 3", `score=${r.body?.score}`);

  // 8. Issue a QMaskCard mask
  r = await req("POST", "/api/qmaskcard/masks", {
    label: "Flow smoke mask",
    kind: "recurring",
    currency: "USD",
    spendLimitCents: 50_000,
    ttlHours: 24,
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.id) ok("POST /qmaskcard/masks", `pan=${r.body.virtualPan?.slice(0, 18)}…`);
  else { fail("POST /qmaskcard/masks", `${r.status}`); process.exit(1); }
  const maskId = r.body.id;

  // 9. Authorize a charge against the mask
  r = await req("POST", "/api/qmaskcard/charges", {
    maskId, amountCents: 1000, currency: "USD",
    merchantName: "FlowMerchant", merchantCategory: "saas", geoCountry: "KZ",
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.status === "authorized") {
    ok("POST /qmaskcard/charges authorized", `risk=${r.body.riskScore}`);
  } else fail("POST /qmaskcard/charges", `${r.status}`);

  await sleep(300);

  // 10. VeilNetX should show the qmaskcard settlement
  r = await req("GET", "/api/veilnetx-ledger/entries?module=qmaskcard&limit=5");
  const settleEntry = (r.body?.entries ?? []).find((e) => e.kind === "settlement");
  if (r.status === 200 && settleEntry) ok("GET /veilnetx-ledger?module=qmaskcard kind=settlement");
  else fail("VeilNetX qmaskcard settlement", `status=${r.status} found=${!!settleEntry}`);

  // 11. Chain integrity intact
  r = await req("GET", "/api/veilnetx-ledger/chain/verify");
  if (r.status === 200 && r.body?.verified === true) ok("GET /veilnetx-ledger/chain/verify", `length=${r.body.length}`);
  else fail("chain integrity", `verified=${r.body?.verified}`);

  // 12. Z-Tide leaderboard still readable (regression check)
  r = await req("GET", "/api/ztide/leaderboard?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) ok("GET /ztide/leaderboard");
  else fail("GET /ztide/leaderboard", `${r.status}`);

  // 13. Z-Tide me/login-streak — first claim succeeds
  r = await req("POST", "/api/ztide/me/login-streak", {}, token);
  if (r.status === 200 || r.status === 201) ok("POST /ztide/me/login-streak first claim");
  else fail("login-streak first claim", `${r.status}`);

  // 14. Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "FintechFlow123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /api/auth/account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });

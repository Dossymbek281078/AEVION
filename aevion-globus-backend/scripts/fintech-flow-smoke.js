#!/usr/bin/env node
/**
 * Fintech E2E smoke — exercises the cross-product fintech chain.
 *
 * Flow: register → wallet → deposit → veilnetx (deposit) → withdraw →
 *       z-tide (qpaynet-payout +3) → qmaskcard (mask + charge) →
 *       veilnetx (settlement) → chain/verify → cleanup
 *
 * Verifies that fire-and-forget hooks from QPayNet + QMaskCard correctly
 * land in VeilNetX ledger and Z-Tide reputation, and that the VeilNetX
 * chain stays cryptographically consistent across multiple modules writing
 * concurrently within a single user's flow.
 *
 * Usage:
 *   node scripts/fintech-flow-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/fintech-flow-smoke.js
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log(`\nFintech E2E smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/health");
  if (r.status === 200) ok("GET /api/health");
  else fail("GET /api/health", `${r.status}`);

  // 2. Register test user
  const EMAIL = `fintech-smoke-${Date.now()}@aevion.test`;
  const PASSWORD = "FintechSmoke123!";
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: PASSWORD, name: "FintechBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) {
    ok("POST /api/auth/register", `uid=${r.body.user?.id?.slice(0, 8)}`);
  } else { fail("POST /api/auth/register", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); process.exit(1); }
  const token = r.body.token;

  // 3. Create QPayNet wallet
  r = await req("POST", "/api/qpaynet/wallets", { name: "Fintech Smoke Wallet", currency: "KZT" }, token);
  if (r.status === 201 && typeof r.body?.id === "string") {
    ok("POST /api/qpaynet/wallets", `walletId=${r.body.id.slice(0, 8)}`);
  } else { fail("POST /api/qpaynet/wallets", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); process.exit(1); }
  const walletId = r.body.id;

  // 4. Deposit 5000 KZT
  r = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 5000, description: "Smoke deposit" }, token);
  if (r.status === 200 && typeof r.body?.txId === "string" && r.body?.newBalance === 5000) {
    ok("POST /api/qpaynet/deposit", `txId=${r.body.txId.slice(0, 8)} bal=${r.body.newBalance}`);
  } else fail("POST /api/qpaynet/deposit", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
  const depositTxId = r.body?.txId;

  // Give fire-and-forget VeilNetX/Z-Tide writes a moment to flush.
  await sleep(300);

  // 5. VeilNetX ledger should contain a qpaynet/deposit entry
  r = await req("GET", "/api/veilnetx-ledger/entries?module=qpaynet&limit=5");
  if (r.status === 200 && Array.isArray(r.body?.entries) && r.body.entries.some((e) => e.kind === "deposit")) {
    ok("GET /veilnetx-ledger?module=qpaynet has deposit", `count=${r.body.entries.length}`);
  } else fail("GET /veilnetx-ledger qpaynet/deposit", `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);

  // 6. Withdraw 1000 KZT — fires Z-Tide qpaynet-payout (+3)
  r = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 1000, description: "Smoke withdraw" }, token);
  if (r.status === 200 && typeof r.body?.fee === "number" && typeof r.body?.newBalance === "number") {
    ok("POST /api/qpaynet/withdraw", `fee=${r.body.fee} bal=${r.body.newBalance}`);
  } else fail("POST /api/qpaynet/withdraw", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 7. Wait for fire-and-forget Z-Tide writes.
  await sleep(300);

  // 8. Z-Tide /me should show non-zero score (one qpaynet-payout event at +3).
  r = await req("GET", "/api/ztide/me", null, token);
  if (r.status === 200 && typeof r.body?.score === "number" && r.body.score >= 3) {
    ok("GET /api/ztide/me score>=3", `score=${r.body.score} rank=${r.body.rank?.id}`);
  } else fail("GET /api/ztide/me score>=3", `${r.status} score=${r.body?.score}`);

  // 9. Issue a recurring QMaskCard mask
  r = await req("POST", "/api/qmaskcard/masks", {
    label: "Smoke", kind: "recurring", currency: "USD",
    spendLimitCents: 50_000, ttlHours: 24,
  }, token);
  if ((r.status === 200 || r.status === 201) && typeof r.body?.id === "string") {
    ok("POST /api/qmaskcard/masks", `maskId=${r.body.id.slice(0, 8)}`);
  } else { fail("POST /api/qmaskcard/masks", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); process.exit(1); }
  const maskId = r.body.id;

  // 10. Authorize a charge against the mask
  r = await req("POST", "/api/qmaskcard/charges", {
    maskId, amountCents: 1000, currency: "USD",
    merchantName: "Smoke", merchantCategory: "saas", geoCountry: "KZ",
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.status === "authorized") {
    ok("POST /api/qmaskcard/charges authorized", `risk=${r.body.riskScore}`);
  } else fail("POST /api/qmaskcard/charges authorized", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 11. Wait for fire-and-forget VeilNetX settlement write.
  await sleep(300);

  // 12. VeilNetX ledger should contain a qmaskcard/settlement entry
  r = await req("GET", "/api/veilnetx-ledger/entries?module=qmaskcard&limit=5");
  if (r.status === 200 && Array.isArray(r.body?.entries) && r.body.entries.some((e) => e.kind === "settlement")) {
    ok("GET /veilnetx-ledger?module=qmaskcard has settlement", `count=${r.body.entries.length}`);
  } else fail("GET /veilnetx-ledger qmaskcard/settlement", `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);

  // 13. Chain integrity — every entry must hash-link cleanly across modules.
  r = await req("GET", "/api/veilnetx-ledger/chain/verify");
  if (r.status === 200 && r.body?.verified === true) {
    ok("GET /veilnetx-ledger/chain/verify", `length=${r.body.length}`);
  } else fail("GET /veilnetx-ledger/chain/verify", `${r.status} verified=${r.body?.verified}`);

  // 14. Cleanup test account
  r = await req("DELETE", "/api/auth/account", { password: PASSWORD }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /api/auth/account");
  else fail("DELETE /api/auth/account", `${r.status}`);

  void depositTxId; // captured for debug; not asserted on directly past step 4

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

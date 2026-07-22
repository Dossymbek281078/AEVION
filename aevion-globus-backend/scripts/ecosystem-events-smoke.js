#!/usr/bin/env node
/**
 * Ecosystem events smoke — verifies that each cross-product action that
 * is supposed to emit a VeilNetX ledger entry AND/OR a Z-Tide reputation
 * event actually does so, with the right `module`, `kind`, and (for Z-Tide)
 * weight.
 *
 * Different from fintech-flow-smoke: that one walks a happy-path E2E
 * (deposit→withdraw→mask→charge) and asserts an outcome at each step.
 * This one is event-bus focused — it triggers one action per emission
 * kind, then queries the ledger + Z-Tide directly to confirm the trace.
 *
 * Mutates: registers a single test user, fires actions, deletes account
 * at the end. Safe for CI ephemeral envs (READ_ONLY=0). NOT for prod.
 *
 * Usage:
 *   node scripts/ecosystem-events-smoke.js
 *   BASE=http://localhost:4001 node scripts/ecosystem-events-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

/** Highest ledger sequenceNumber for a module — a monotonic watermark.
 *  Counting kinds inside a limited window breaks once the module has more
 *  than `limit` total entries (a new entry just pushes an old one of the
 *  same kind out of the window; count stays flat — exactly what happened
 *  when prod passed 25 deposits + 25 withdrawals). */
async function ledgerMaxSeq(module) {
  const r = await req("GET", `/api/veilnetx-ledger/entries?module=${module}&limit=50`);
  if (r.status !== 200 || !Array.isArray(r.body?.entries)) return -1;
  return r.body.entries.reduce((m, e) => Math.max(m, Number(e.sequenceNumber) || 0), 0);
}

/** True when an entry of `kind` exists with sequenceNumber > afterSeq. */
async function ledgerHasNew(module, kind, afterSeq) {
  const r = await req("GET", `/api/veilnetx-ledger/entries?module=${module}&limit=50`);
  if (r.status !== 200 || !Array.isArray(r.body?.entries)) return false;
  return r.body.entries.some((e) => e.kind === kind && (Number(e.sequenceNumber) || 0) > afterSeq);
}

async function ztideScore(token) {
  const r = await req("GET", "/api/ztide/me", null, token);
  if (r.status !== 200) return -1;
  return Number(r.body?.score ?? 0);
}

async function run() {
  console.log(`\nEcosystem events smoke → ${BASE}\n`);

  let r = await req("GET", "/api/health");
  if (r.status === 200) ok("GET /api/health"); else { fail("health", `${r.status}`); process.exit(1); }

  const EMAIL = `ecosystem-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "Eco123!", name: "EcoBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // Baseline snapshots — sequence watermarks, not window counts
  const paySeqBefore = await ledgerMaxSeq("qpaynet");
  const maskSeqBefore = await ledgerMaxSeq("qmaskcard");
  const scoreBefore = await ztideScore(token);
  ok("baseline snapshot", `paySeq=${paySeqBefore} maskSeq=${maskSeqBefore} score=${scoreBefore}`);

  // 1. qpaynet/deposit emission
  r = await req("POST", "/api/qpaynet/wallets", { currency: "KZT" }, token);
  if (r.status === 200 || r.status === 201) ok("POST /qpaynet/wallets");
  else { fail("create wallet", `${r.status}`); process.exit(1); }
  const walletId = r.body.id;

  r = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 5000 }, token);
  if (r.status === 200 && r.body?.txId) ok("POST /qpaynet/deposit");
  else fail("deposit", `${r.status}`);

  await sleep(400);
  if (await ledgerHasNew("qpaynet", "deposit", paySeqBefore)) ok("VeilNetX: new qpaynet/deposit entry");
  else fail("deposit ledger trace", `no deposit entry with seq > ${paySeqBefore}`);

  // 2. qpaynet/withdrawal emission — both VeilNetX (kind=withdrawal) AND Z-Tide (qpaynet-payout +3)
  r = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 1000 }, token);
  if (r.status === 200) ok("POST /qpaynet/withdraw");
  else fail("withdraw", `${r.status}`);

  await sleep(400);
  if (await ledgerHasNew("qpaynet", "withdrawal", paySeqBefore)) ok("VeilNetX: new qpaynet/withdrawal entry");
  else fail("withdrawal ledger trace", `no withdrawal entry with seq > ${paySeqBefore}`);

  const scoreAfterWd = await ztideScore(token);
  if (scoreAfterWd >= scoreBefore + 3) ok("Z-Tide: +3 (qpaynet-payout) after withdrawal", `score=${scoreAfterWd}`);
  else fail("Z-Tide payout event", `score before=${scoreBefore} after=${scoreAfterWd}`);

  // 3. qmaskcard/settlement emission
  r = await req("POST", "/api/qmaskcard/masks", {
    label: "Eco smoke", kind: "recurring", currency: "USD",
    spendLimitCents: 50_000, ttlHours: 24,
  }, token);
  if (r.status === 200 || r.status === 201) ok("POST /qmaskcard/masks");
  else { fail("create mask", `${r.status}`); process.exit(1); }
  const maskId = r.body.id;

  r = await req("POST", "/api/qmaskcard/charges", {
    maskId, amountCents: 500, currency: "USD",
    merchantName: "EcoMerchant", merchantCategory: "saas", geoCountry: "KZ",
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.status === "authorized") ok("POST /qmaskcard/charges authorized");
  else fail("mask charge", `${r.status}`);

  await sleep(400);
  if (await ledgerHasNew("qmaskcard", "settlement", maskSeqBefore)) ok("VeilNetX: new qmaskcard/settlement entry");
  else fail("settlement ledger trace", `no settlement entry with seq > ${maskSeqBefore}`);

  // 4. Z-Tide direct emission via login-streak (kind: login-streak, weight 1)
  const scoreBeforeStreak = await ztideScore(token);
  r = await req("POST", "/api/ztide/me/login-streak", {}, token);
  if (r.status === 200 || r.status === 201) ok("POST /ztide/me/login-streak");
  else fail("login-streak", `${r.status}`);
  const scoreAfterStreak = await ztideScore(token);
  if (scoreAfterStreak >= scoreBeforeStreak + 1) ok("Z-Tide: +1 (login-streak)", `score=${scoreAfterStreak}`);
  else fail("login-streak score delta", `before=${scoreBeforeStreak} after=${scoreAfterStreak}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "Eco123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /api/auth/account");
  else fail("delete account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });

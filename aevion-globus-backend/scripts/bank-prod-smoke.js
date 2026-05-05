#!/usr/bin/env node
/**
 * Bank prod smoke — end-to-end AEV wallet + QTrade account/transfer flow.
 *
 * Exercises the bank-relevant surface against a real deploy:
 *   AEV    : stats → mint → sync → spend → insufficient → ledger → wallet
 *   Auth   : register fresh user → token (cleanup DELETE at end)
 *   QTrade : create 2 accounts → topup → transfer → list → cap-status
 *   Bureau : trust-edges read endpoints + claim-aec auth/404 plumbing (P3-4)
 *
 * Default BASE points through the Vercel rewrite (`/api-backend/*`) so the
 * smoke validates the full prod path: browser → Vercel → Railway → Express →
 * mounted router. Override with `BASE=https://aevion-production-a70c.up.railway.app`
 * to skip the rewrite and hit Railway directly.
 *
 * Usage:
 *   node scripts/bank-prod-smoke.js
 *   BASE=<url> node scripts/bank-prod-smoke.js
 *   ARTIFACT=docs/bank/SMOKE_PROD_$(date +%s).json node scripts/bank-prod-smoke.js
 *
 * Exit codes: 0 = all green, 1 = at least one step failed, 2 = crash.
 *
 * Pollution: registers ONE user (smoke+<ts>@aevion.test) and creates
 * accounts/wallets. Self-cleans the user via DELETE /api/auth/account.
 * Wallet/ledger entries persist (append-only ledger is bounded).
 */

const { writeFileSync, mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const DEFAULT_PUBLIC_URL = "https://aevion.app/api-backend";
const BASE = (process.env.BASE || DEFAULT_PUBLIC_URL).replace(/\/+$/, "");
const DEVICE = process.env.DEVICE || `bank-smoke-${Date.now()}`;
const SMOKE_EMAIL = `smoke+${Date.now()}@aevion.test`;
const SMOKE_PASSWORD = "smoke-password-1234";
const SMOKE_NAME = "Bank Prod Smoke";
const ARTIFACT = process.env.ARTIFACT || null;

let step = 0;
let failed = 0;
const calls = [];

function ok(name, extra) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
}

async function call(method, path, { body, token, idemKey } = {}) {
  const url = `${BASE}${path}`;
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (idemKey) headers["idempotency-key"] = idemKey;

  const t0 = Date.now();
  let status = 0;
  let json = null;
  let text = null;
  try {
    const res = await fetch(url, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      json = await res.json().catch(() => null);
    } else {
      text = (await res.text().catch(() => "")).slice(0, 400);
    }
  } catch (err) {
    text = `fetch_failed: ${err?.message || String(err)}`;
  }
  const durMs = Date.now() - t0;
  calls.push({ method, path, status, durMs, body: body || null, response: json ?? text });
  return { status, body: json, text, durMs };
}

function fmtMs(ms) {
  return `${ms}ms`;
}

async function runAev() {
  console.log(`\n[AEV layer] device=${DEVICE}`);

  let r = await call("GET", "/api/aev/stats");
  if (r.status === 200 && r.body?.ok) ok("AEV baseline /stats", `wallets=${r.body.wallets} ledger=${r.body.ledgerEntries} ${fmtMs(r.durMs)}`);
  else return fail("AEV baseline /stats", `status=${r.status} ${fmtMs(r.durMs)}`);

  r = await call("POST", `/api/aev/wallet/${DEVICE}/mint`, { body: { amount: 0.5, sourceKind: "play", sourceModule: "smoke", reason: "smoke-mint-1" } });
  if (r.status === 200 && r.body?.wallet?.balance === 0.5) ok("AEV mint 0.5", `balance=${r.body.wallet.balance} ${fmtMs(r.durMs)}`);
  else return fail("AEV mint 0.5", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);

  r = await call("POST", `/api/aev/wallet/${DEVICE}/mint`, { body: { amount: 1.25, sourceKind: "play", sourceModule: "smoke" } });
  if (r.status === 200 && r.body?.wallet?.balance === 1.75) ok("AEV mint 1.25", `balance=${r.body.wallet.balance} ${fmtMs(r.durMs)}`);
  else return fail("AEV mint 1.25", `expected balance=1.75 got ${r.body?.wallet?.balance}`);

  r = await call("POST", `/api/aev/wallet/${DEVICE}/sync`, { body: { balance: 1.75, lifetimeMined: 5, modes: { play: false, compute: true, stewardship: true } } });
  if (r.status === 200 && r.body?.wallet?.lifetimeMined >= 5 && r.body?.wallet?.modes?.compute === true) ok("AEV sync (max+modes)", `lifetimeMined=${r.body.wallet.lifetimeMined} ${fmtMs(r.durMs)}`);
  else return fail("AEV sync", `status=${r.status}`);

  r = await call("POST", `/api/aev/wallet/${DEVICE}/spend`, { body: { amount: 0.75, reason: "smoke-spend-1" } });
  if (r.status === 200 && Math.abs((r.body?.wallet?.balance ?? -1) - 1) < 1e-6) ok("AEV spend 0.75", `balance=${r.body.wallet.balance} ${fmtMs(r.durMs)}`);
  else return fail("AEV spend 0.75", `expected balance≈1 got ${r.body?.wallet?.balance}`);

  r = await call("POST", `/api/aev/wallet/${DEVICE}/spend`, { body: { amount: 999 } });
  if (r.status === 409 && r.body?.error === "insufficient_funds") ok("AEV spend 999 → 409 insufficient_funds", fmtMs(r.durMs));
  else return fail("AEV spend 999", `expected 409 got ${r.status}`);

  r = await call("GET", `/api/aev/ledger/${DEVICE}?limit=10`);
  if (r.status === 200 && r.body?.count >= 3 && Array.isArray(r.body?.entries)) ok("AEV ledger tail", `count=${r.body.count} ${fmtMs(r.durMs)}`);
  else return fail("AEV ledger tail", `status=${r.status} count=${r.body?.count}`);

  r = await call("GET", `/api/aev/wallet/${DEVICE}`);
  if (r.status === 200 && r.body?.wallet?.deviceId === DEVICE) ok("AEV wallet snapshot", `balance=${r.body.wallet.balance} ${fmtMs(r.durMs)}`);
  else return fail("AEV wallet snapshot", `status=${r.status}`);

  r = await call("GET", "/api/aev/wallet/x");
  if (r.status === 400 && r.body?.error === "invalid_device_id") ok("AEV invalid deviceId → 400", fmtMs(r.durMs));
  else return fail("AEV invalid deviceId", `expected 400 got ${r.status}`);
}

async function runAuthAndQtrade() {
  console.log(`\n[Auth + QTrade] email=${SMOKE_EMAIL}`);

  let r = await call("POST", "/api/auth/register", { body: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD, name: SMOKE_NAME } });
  if (r.status !== 201 || !r.body?.token) {
    fail("auth register", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);
    return null;
  }
  const token = r.body.token;
  ok("auth register", `userId=${r.body.user?.id?.slice(0, 8)} ${fmtMs(r.durMs)}`);

  r = await call("GET", "/api/auth/me", { token });
  if (r.status === 200 && r.body?.user?.email === SMOKE_EMAIL) ok("auth /me", `role=${r.body.user.role} ${fmtMs(r.durMs)}`);
  else fail("auth /me", `status=${r.status} email=${r.body?.user?.email}`);

  r = await call("POST", "/api/qtrade/accounts", { token });
  if (r.status !== 201 || !r.body?.id) {
    fail("qtrade create acc1", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);
    return token;
  }
  const acc1 = r.body.id;
  ok("qtrade create acc1", `id=${acc1} ${fmtMs(r.durMs)}`);

  r = await call("POST", "/api/qtrade/accounts", { token });
  if (r.status !== 201 || !r.body?.id) {
    fail("qtrade create acc2", `status=${r.status}`);
    return token;
  }
  const acc2 = r.body.id;
  ok("qtrade create acc2", `id=${acc2} ${fmtMs(r.durMs)}`);

  const idemKey = `smoke-topup-${Date.now()}`;
  r = await call("POST", "/api/qtrade/topup", { body: { accountId: acc1, amount: 100 }, token, idemKey });
  if (r.status === 200 && r.body?.balance === 100) ok("qtrade topup 100 → acc1", `balance=${r.body.balance} ${fmtMs(r.durMs)}`);
  else fail("qtrade topup 100", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);

  r = await call("POST", "/api/qtrade/transfer", { body: { from: acc1, to: acc2, amount: 35, memo: "smoke-transfer" }, token });
  if (r.status === 200) ok("qtrade transfer acc1→acc2 35", fmtMs(r.durMs));
  else fail("qtrade transfer", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);

  r = await call("GET", "/api/qtrade/transfers", { token });
  if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length >= 1) ok("qtrade transfers list", `n=${r.body.items.length} ${fmtMs(r.durMs)}`);
  else fail("qtrade transfers list", `status=${r.status}`);

  r = await call("GET", "/api/qtrade/cap-status", { token });
  if (r.status === 200 && r.body?.topup && r.body?.transfer) ok("qtrade cap-status", `topup.used=${r.body.topup.used}/${r.body.topup.cap} transfer.used=${r.body.transfer.used}/${r.body.transfer.cap} ${fmtMs(r.durMs)}`);
  else fail("qtrade cap-status", `status=${r.status}`);

  r = await call("GET", "/api/qtrade/summary", { token });
  if (r.status === 200 && r.body?.accounts >= 2) ok("qtrade summary", `accounts=${r.body.accounts} totalBalance=${r.body.totalBalance} ${fmtMs(r.durMs)}`);
  else fail("qtrade summary", `status=${r.status}`);

  return token;
}

async function runBureauTrustGraph(token) {
  console.log(`\n[Bureau Trust Graph plumbing]`);
  if (!token) {
    fail("bureau trust-edges/me", "no token from auth step — skipped");
    return;
  }

  // Fresh user has no edges. Endpoint should return 200 with empty array.
  let r = await call("GET", "/api/bureau/trust-edges/me", { token });
  if (r.status === 200 && Array.isArray(r.body?.edges) && r.body.edges.length === 0) {
    ok("bureau /trust-edges/me empty", `userId=${r.body.userId?.slice(0, 8)} ${fmtMs(r.durMs)}`);
  } else {
    fail("bureau /trust-edges/me empty", `status=${r.status} edges=${JSON.stringify(r.body?.edges)?.slice(0, 200)}`);
  }

  // Public read for an unknown cert should return 200 with empty edges.
  const fakeCert = `nonexistent-${Date.now()}`;
  r = await call("GET", `/api/bureau/trust-edges/cert/${fakeCert}`);
  if (r.status === 200 && Array.isArray(r.body?.edges) && r.body.edges.length === 0) {
    ok("bureau /trust-edges/cert empty", fmtMs(r.durMs));
  } else {
    fail("bureau /trust-edges/cert empty", `status=${r.status}`);
  }

  // claim-aec without auth → 401.
  r = await call("POST", `/api/bureau/trust-edges/${fakeCert}/claim-aec`, { body: { deviceId: DEVICE } });
  if (r.status === 401) {
    ok("bureau claim-aec unauth → 401", fmtMs(r.durMs));
  } else {
    fail("bureau claim-aec unauth", `expected 401 got ${r.status}`);
  }

  // claim-aec with auth on missing edge → 404.
  r = await call("POST", `/api/bureau/trust-edges/${fakeCert}/claim-aec`, { body: { deviceId: DEVICE }, token });
  if (r.status === 404 && r.body?.error === "edge not found") {
    ok("bureau claim-aec missing edge → 404", fmtMs(r.durMs));
  } else {
    fail("bureau claim-aec missing edge", `expected 404 got ${r.status}`);
  }

  // claim-aec with auth, no deviceId → 400.
  r = await call("POST", `/api/bureau/trust-edges/${fakeCert}/claim-aec`, { body: {}, token });
  if (r.status === 400 && /deviceId/.test(r.body?.error || "")) {
    ok("bureau claim-aec no deviceId → 400", fmtMs(r.durMs));
  } else {
    fail("bureau claim-aec no deviceId", `expected 400 got ${r.status}`);
  }
}

async function cleanup(token) {
  if (!token) return;
  console.log(`\n[Cleanup]`);
  const r = await call("DELETE", "/api/auth/account", { token });
  if (r.status === 200 || r.status === 204) ok("auth /account DELETE", fmtMs(r.durMs));
  else console.warn(`  -- WARN: account delete returned status=${r.status} (smoke user remains)`);
}

async function main() {
  console.log(`Bank prod smoke against ${BASE}`);
  console.log(`Run id: deviceId=${DEVICE} email=${SMOKE_EMAIL}`);

  await runAev();
  const token = await runAuthAndQtrade();
  await runBureauTrustGraph(token);
  await cleanup(token);

  if (ARTIFACT) {
    const out = resolve(ARTIFACT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      base: BASE,
      runAt: new Date().toISOString(),
      device: DEVICE,
      email: SMOKE_EMAIL,
      stepsTotal: step,
      stepsFailed: failed,
      calls,
    }, null, 2));
    console.log(`\nartifact: ${out}`);
  }

  console.log(`\n${failed === 0 ? "✅ all steps passed" : `❌ ${failed} step(s) failed`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crash:", e);
  process.exit(2);
});

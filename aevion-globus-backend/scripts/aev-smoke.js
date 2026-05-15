#!/usr/bin/env node
/**
 * AEV wallet/ledger — end-to-end smoke test.
 *
 * Walks /api/aev/* surface: stats baseline → mint x2 → sync → spend →
 * insufficient_funds reject → ledger tail → wallet snapshot → final stats.
 * Pass/fail per step; exits 1 on first failure.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/aev-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   DEVICE    default aev-smoke-<ts>  (unique per run)
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const DEVICE = process.env.DEVICE || `aev-smoke-${Date.now()}`;

let step = 0;
let failed = 0;

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

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {/**/}
  return { status: res.status, body: json };
}

async function main() {
  console.log(`AEV smoke against ${BASE} (deviceId=${DEVICE})\n`);

  // 1. baseline stats
  let r = await call("GET", "/api/aev/stats");
  if (r.status === 200 && r.body?.ok) ok("baseline GET /api/aev/stats", `wallets=${r.body.wallets} ledger=${r.body.ledgerEntries}`);
  else return fail("baseline GET /api/aev/stats", `status=${r.status}`);

  // 2. mint 0.5 AEV
  r = await call("POST", `/api/aev/wallet/${DEVICE}/mint`, { amount: 0.5, sourceKind: "play", sourceModule: "smoke", reason: "smoke-mint-1" });
  if (r.status === 200 && r.body?.wallet?.balance === 0.5 && r.body?.entry?.kind === "mint") ok("mint 0.5", `balance=${r.body.wallet.balance}`);
  else return fail("mint 0.5", `status=${r.status} balance=${r.body?.wallet?.balance}`);

  // 3. mint 1.25 AEV
  r = await call("POST", `/api/aev/wallet/${DEVICE}/mint`, { amount: 1.25, sourceKind: "play", sourceModule: "smoke" });
  if (r.status === 200 && r.body?.wallet?.balance === 1.75) ok("mint 1.25", `balance=${r.body.wallet.balance}`);
  else return fail("mint 1.25", `expected balance=1.75 got ${r.body?.wallet?.balance}`);

  // 4. sync — last-writer-wins on balance, max() on lifetime
  r = await call("POST", `/api/aev/wallet/${DEVICE}/sync`, { balance: 1.75, lifetimeMined: 5, modes: { play: false, compute: true, stewardship: true } });
  if (r.status === 200 && r.body?.wallet?.lifetimeMined >= 5 && r.body?.wallet?.modes?.compute === true) ok("sync (max lifetime + modes)", `lifetimeMined=${r.body.wallet.lifetimeMined}`);
  else return fail("sync", `status=${r.status}`);

  // 5. spend 0.75
  r = await call("POST", `/api/aev/wallet/${DEVICE}/spend`, { amount: 0.75, reason: "smoke-spend-1" });
  if (r.status === 200 && Math.abs((r.body?.wallet?.balance ?? -1) - 1) < 1e-6) ok("spend 0.75", `balance=${r.body.wallet.balance}`);
  else return fail("spend 0.75", `expected balance≈1 got ${r.body?.wallet?.balance}`);

  // 6. spend exceed → 409 insufficient_funds
  r = await call("POST", `/api/aev/wallet/${DEVICE}/spend`, { amount: 999 });
  if (r.status === 409 && r.body?.error === "insufficient_funds") ok("spend 999 → 409 insufficient_funds");
  else return fail("spend 999", `expected 409 got status=${r.status} error=${r.body?.error}`);

  // 7. ledger tail
  r = await call("GET", `/api/aev/ledger/${DEVICE}?limit=10`);
  if (r.status === 200 && r.body?.count >= 3 && Array.isArray(r.body?.entries)) ok("ledger tail", `count=${r.body.count}`);
  else return fail("ledger tail", `status=${r.status} count=${r.body?.count}`);

  // 8. wallet snapshot
  r = await call("GET", `/api/aev/wallet/${DEVICE}`);
  if (r.status === 200 && r.body?.wallet?.deviceId === DEVICE) ok("wallet snapshot", `balance=${r.body.wallet.balance} lifetime=${r.body.wallet.lifetimeMined}`);
  else return fail("wallet snapshot", `status=${r.status}`);

  // 9. final stats — wallets count and ledgerEntries should both be ≥ baseline
  r = await call("GET", "/api/aev/stats");
  if (r.status === 200 && r.body?.ok) ok("final GET /api/aev/stats", `wallets=${r.body.wallets} ledger=${r.body.ledgerEntries}`);
  else return fail("final stats", `status=${r.status}`);

  // 10. invalid deviceId → 400
  r = await call("GET", `/api/aev/wallet/x`);
  if (r.status === 400 && r.body?.error === "invalid_device_id") ok("invalid deviceId → 400");
  else return fail("invalid deviceId", `expected 400 got ${r.status}`);
}

main()
  .then(() => {
    console.log(`\n${failed === 0 ? "✅ all steps passed" : `❌ ${failed} step(s) failed`}`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("smoke crash:", e);
    process.exit(2);
  });

#!/usr/bin/env node
/**
 * QPayNet smoke test — run against live backend
 * Usage: node scripts/qpaynet-smoke.js [BASE_URL]
 * Default BASE_URL: http://localhost:4001
 */

const BASE = process.argv[2] ?? process.env.BACKEND_URL ?? "http://localhost:4001";
const JWT  = process.env.TEST_JWT ?? ""; // optional bearer token for auth endpoints

let passed = 0;
let failed = 0;

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

function assert(label, condition, info = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${info ? " — " + info : ""}`);
    failed++;
  }
}

async function run() {
  console.log(`\nQPayNet smoke test → ${BASE}\n`);
  const auth = JWT ? { Authorization: `Bearer ${JWT}` } : {};

  // 1. Public stats
  console.log("1. Public stats");
  const stats = await req("GET", "/api/qpaynet/stats");
  assert("GET /api/qpaynet/stats → 200", stats.status === 200);
  assert("stats has activeWallets", typeof stats.body.activeWallets === "number");
  assert("stats has totalTransactions", typeof stats.body.totalTransactions === "number");

  if (!JWT) {
    console.log("\n[Skipping auth-required tests — no TEST_JWT provided]");
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  // 2. Create wallet
  console.log("\n2. Wallets");
  const createW = await req("POST", "/api/qpaynet/wallets", { name: "Smoke Test Wallet" }, auth);
  assert("POST /api/qpaynet/wallets → 201", createW.status === 201);
  assert("wallet has id", typeof createW.body.id === "string");
  const walletId = createW.body.id;

  // 3. List wallets
  const listW = await req("GET", "/api/qpaynet/wallets", null, auth);
  assert("GET /api/qpaynet/wallets → 200", listW.status === 200);
  assert("wallets array", Array.isArray(listW.body.wallets));

  // 4. Get wallet detail
  const detailW = await req("GET", `/api/qpaynet/wallets/${walletId}`, null, auth);
  assert("GET /api/qpaynet/wallets/:id → 200", detailW.status === 200);
  assert("balance is 0", detailW.body.balance === 0);

  // 5. Deposit
  console.log("\n3. Deposit");
  const dep = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 10000, description: "Smoke deposit" }, auth);
  assert("POST /api/qpaynet/deposit → 200", dep.status === 200);
  assert("newBalance is 10000", dep.body.newBalance === 10000);

  // 6. Check updated balance
  const updW = await req("GET", `/api/qpaynet/wallets/${walletId}`, null, auth);
  assert("balance updated to 10000", updW.body.balance === 10000);

  // 7. Withdraw
  console.log("\n4. Withdraw");
  const wd = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 1000, description: "Smoke withdraw" }, auth);
  assert("POST /api/qpaynet/withdraw → 200", wd.status === 200);
  assert("fee is 1 (0.1%)", wd.body.fee === 1);
  assert("newBalance is 8999", wd.body.newBalance === 8999);

  // 8. Transaction history
  console.log("\n5. Transactions");
  const txs = await req("GET", `/api/qpaynet/transactions?walletId=${walletId}`, null, auth);
  assert("GET /api/qpaynet/transactions → 200", txs.status === 200);
  assert("has 2 transactions", txs.body.transactions?.length >= 2);

  // 9. Merchant key
  console.log("\n6. Merchant keys");
  const mkCreate = await req("POST", "/api/qpaynet/merchant/keys", { name: "Smoke Key", walletId }, auth);
  assert("POST /api/qpaynet/merchant/keys → 201", mkCreate.status === 201);
  assert("key starts with qpn_live_", typeof mkCreate.body.key === "string" && mkCreate.body.key.startsWith("qpn_live_"));
  const apiKey = mkCreate.body.key;
  const mkId = mkCreate.body.id;

  // 10. List keys
  const mkList = await req("GET", "/api/qpaynet/merchant/keys", null, auth);
  assert("GET /api/qpaynet/merchant/keys → 200", mkList.status === 200);

  // 11. Revoke key
  const mkRevoke = await req("DELETE", `/api/qpaynet/merchant/keys/${mkId}`, null, auth);
  assert("DELETE /api/qpaynet/merchant/keys/:id → 200", mkRevoke.status === 200);

  // 12. Public recipient lookup (no auth)
  console.log("\n7. Recipient lookup");
  const pub = await req("GET", `/api/qpaynet/wallets/${walletId}/public`);
  assert("GET wallets/:id/public → 200", pub.status === 200);
  assert("public has name, no balance", typeof pub.body.name === "string" && pub.body.balance === undefined);
  assert("public.active === true", pub.body.active === true);
  const pubMissing = await req("GET", "/api/qpaynet/wallets/00000000-0000-0000-0000-000000000000/public");
  assert("public lookup of missing → 404", pubMissing.status === 404);

  // 13. Wallet rename
  console.log("\n8. Wallet rename");
  const rename = await req("PATCH", `/api/qpaynet/wallets/${walletId}`, { name: "Renamed Smoke" }, auth);
  assert("PATCH wallets/:id → 200", rename.status === 200);
  assert("name updated", rename.body.name === "Renamed Smoke");
  const renameNo = await req("PATCH", `/api/qpaynet/wallets/${walletId}`, { name: "" }, auth);
  assert("PATCH empty name → 400", renameNo.status === 400);

  // 14. CSV export
  console.log("\n9. CSV export");
  const csvR = await fetch(`${BASE}/api/qpaynet/transactions.csv`, { headers: auth });
  const csvText = await csvR.text();
  assert("GET transactions.csv → 200", csvR.status === 200);
  assert("csv has header row", csvText.startsWith("id,wallet_id,type,"));
  assert("csv has data", csvText.split("\n").length > 1);

  // 15. Insufficient balance
  console.log("\n10. Edge cases");
  const bigWd = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 999999 }, auth);
  assert("withdraw beyond balance → 400", bigWd.status === 400 && bigWd.body.error === "insufficient_balance");

  console.log(`\n${"═".repeat(40)}`);
  console.log(`QPayNet smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });

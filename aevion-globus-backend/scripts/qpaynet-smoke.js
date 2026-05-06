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

  // 15. Payment requests (tracked)
  console.log("\n10. Payment requests");
  const prCreate = await req("POST", "/api/qpaynet/requests", {
    toWalletId: walletId, amount: 500, description: "Smoke pay request",
  }, auth);
  assert("POST /requests → 201", prCreate.status === 201);
  assert("has token + payUrl", typeof prCreate.body.token === "string" && typeof prCreate.body.payUrl === "string");
  const prToken = prCreate.body.token;
  const prId = prCreate.body.id;

  const prPublic = await req("GET", `/api/qpaynet/requests/${prToken}`);
  assert("GET /requests/:token (public) → 200", prPublic.status === 200);
  assert("public amount is 500", prPublic.body.amount === 500);
  assert("public status is pending", prPublic.body.status === "pending");

  const prList = await req("GET", "/api/qpaynet/requests", null, auth);
  assert("GET /requests → 200", prList.status === 200);
  assert("list contains created", prList.body.requests?.some(r => r.id === prId));

  const prCancel = await req("DELETE", `/api/qpaynet/requests/${prId}`, null, auth);
  assert("DELETE /requests/:id → 200", prCancel.status === 200);

  const prAfter = await req("GET", `/api/qpaynet/requests/${prToken}`);
  assert("cancelled status reflected", prAfter.body.status === "cancelled");

  // 16. Limit enforcement
  console.log("\n11. Limits");
  const overTransfer = await req("POST", "/api/qpaynet/transfer", {
    fromWalletId: walletId, toWalletId: walletId, amount: 9999999,
  }, auth);
  assert("transfer > MAX_TRANSFER → 400", overTransfer.status === 400 &&
    (overTransfer.body.error === "transfer_amount_exceeds_max" || overTransfer.body.error === "cannot_transfer_to_same_wallet"));

  const sameWallet = await req("POST", "/api/qpaynet/transfer", {
    fromWalletId: walletId, toWalletId: walletId, amount: 100,
  }, auth);
  assert("transfer to self → 400", sameWallet.status === 400 && sameWallet.body.error === "cannot_transfer_to_same_wallet");

  const overReq = await req("POST", "/api/qpaynet/requests", {
    toWalletId: walletId, amount: 9999999, description: "over limit",
  }, auth);
  assert("request > MAX_TRANSFER → 400", overReq.status === 400 && overReq.body.error === "request_amount_exceeds_max");

  const badNotify = await req("POST", "/api/qpaynet/requests", {
    toWalletId: walletId, amount: 100, description: "bad notify",
    notifyUrl: "ftp://evil.example",
  }, auth);
  assert("notifyUrl non-http → 400", badNotify.status === 400 && badNotify.body.error === "notifyUrl_must_be_http_or_https");

  const okNotify = await req("POST", "/api/qpaynet/requests", {
    toWalletId: walletId, amount: 100, description: "with webhook",
    notifyUrl: "https://example.com/hook",
  }, auth);
  assert("notifyUrl valid → 201", okNotify.status === 201);
  assert("notifySecret returned", typeof okNotify.body.notifySecret === "string" && okNotify.body.notifySecret.length > 20);

  const deliveries = await req("GET", `/api/qpaynet/requests/${okNotify.body.id}/deliveries`, null, auth);
  assert("GET /requests/:id/deliveries → 200", deliveries.status === 200);
  assert("delivery has status field", typeof deliveries.body.status === "string");
  assert("delivery has notifyUrl", deliveries.body.notifyUrl === "https://example.com/hook");

  // 17. KYC stub
  console.log("\n12. KYC");
  const kycStatus0 = await req("GET", "/api/qpaynet/kyc/status", null, auth);
  assert("GET /kyc/status → 200", kycStatus0.status === 200);
  assert("kyc threshold field present", typeof kycStatus0.body.thresholdKzt === "number");

  const kycBad = await req("POST", "/api/qpaynet/kyc/submit", { fullName: "X", iin: "123" }, auth);
  assert("kyc submit short name → 400", kycBad.status === 400);

  const kycShortIin = await req("POST", "/api/qpaynet/kyc/submit", { fullName: "Иванов Иван", iin: "1234" }, auth);
  assert("kyc submit short iin → 400", kycShortIin.status === 400 && kycShortIin.body.error === "iin_must_be_12_digits");

  // 18. Generic merchant webhook subscriptions
  console.log("\n13. Webhook subs");
  const subCreate = await req("POST", "/api/qpaynet/webhook-subs", { url: "https://example.com/hook" }, auth);
  assert("POST /webhook-subs → 201", subCreate.status === 201);
  assert("returns secret", typeof subCreate.body.secret === "string" && subCreate.body.secret.length > 20);
  const subId = subCreate.body.id;

  const subList = await req("GET", "/api/qpaynet/webhook-subs", null, auth);
  assert("GET /webhook-subs → 200", subList.status === 200);
  assert("list has the new sub", subList.body.subscriptions?.some(s => s.id === subId));

  const subDel = await req("DELETE", `/api/qpaynet/webhook-subs/${subId}`, null, auth);
  assert("DELETE /webhook-subs/:id → 200", subDel.status === 200);

  // 19. Notifications
  console.log("\n14. Notifications");
  const notif = await req("GET", "/api/qpaynet/notifications", null, auth);
  assert("GET /notifications → 200", notif.status === 200);
  assert("notifications array", Array.isArray(notif.body.notifications));

  const unread = await req("GET", "/api/qpaynet/notifications/unread-count", null, auth);
  assert("GET /notifications/unread-count → 200", unread.status === 200);
  assert("unread is number", typeof unread.body.unread === "number");

  // 20. Deposit checkout (stub mode if Stripe not configured)
  console.log("\n15. Deposit checkout");
  const checkout = await req("POST", "/api/qpaynet/deposit/checkout", { walletId, amount: 500 }, auth);
  assert("POST /deposit/checkout → 200", checkout.status === 200);
  assert("checkout has id + url", typeof checkout.body.id === "string" && typeof checkout.body.url === "string");
  assert("provider is stripe or stub", ["stripe", "stub"].includes(checkout.body.provider));

  // 21. Payouts
  console.log("\n16. Payouts");
  const payoutBad = await req("POST", "/api/qpaynet/payouts", { walletId, amount: 10, method: "invalid", destination: "x" }, auth);
  assert("payout invalid method → 400", payoutBad.status === 400 && payoutBad.body.error === "method_must_be_card_bank_transfer_or_kaspi");

  const payoutShort = await req("POST", "/api/qpaynet/payouts", { walletId, amount: 10, method: "card", destination: "x" }, auth);
  assert("payout short destination → 400", payoutShort.status === 400 && payoutShort.body.error === "destination_required");

  const payoutsList = await req("GET", "/api/qpaynet/payouts", null, auth);
  assert("GET /payouts → 200", payoutsList.status === 200);
  assert("payouts array", Array.isArray(payoutsList.body.payouts));

  // 22. Notification preferences
  console.log("\n17. Notification prefs");
  const prefsGet = await req("GET", "/api/qpaynet/notifications/preferences", null, auth);
  assert("GET /notifications/preferences → 200", prefsGet.status === 200);
  assert("availableKinds is array", Array.isArray(prefsGet.body.availableKinds));
  assert("emailEnabled defaults true", prefsGet.body.emailEnabled === true);

  const prefsPatch = await req("PATCH", "/api/qpaynet/notifications/preferences", {
    emailEnabled: false, mutedKinds: ["payout_approved"],
  }, auth);
  assert("PATCH preferences → 200", prefsPatch.status === 200);
  assert("emailEnabled persisted false", prefsPatch.body.emailEnabled === false);
  assert("muted kind persisted", prefsPatch.body.mutedKinds.includes("payout_approved"));

  // Restore defaults
  await req("PATCH", "/api/qpaynet/notifications/preferences", {
    emailEnabled: true, inAppEnabled: true, mutedKinds: [],
  }, auth);

  // 23. Admin payouts (only meaningful if QPAYNET_ADMIN_EMAILS unset = open access)
  console.log("\n18. Admin payouts");
  const adminList = await req("GET", "/api/qpaynet/admin/payouts", null, auth);
  assert("GET /admin/payouts → 200 or 403", [200, 403].includes(adminList.status));
  if (adminList.status === 200) {
    assert("admin payouts array", Array.isArray(adminList.body.payouts));
    const adminStats = await req("GET", "/api/qpaynet/admin/payouts/stats", null, auth);
    assert("GET /admin/payouts/stats → 200", adminStats.status === 200);
    assert("stats has shape", typeof adminStats.body.stats === "object");
  }

  // 24. Personal dashboard
  console.log("\n19. Dashboard");
  const dash = await req("GET", "/api/qpaynet/me/dashboard", null, auth);
  assert("GET /me/dashboard → 200", dash.status === 200);
  assert("dashboard.wallets shape", typeof dash.body.wallets?.totalBalanceKzt === "number");
  assert("dashboard.thisMonth shape", typeof dash.body.thisMonth?.netKzt === "number");
  assert("dashboard.last7days array", Array.isArray(dash.body.last7days));

  // 25. Concurrency safety — fire 5 parallel transfers from a wallet that can only afford 1
  console.log("\n20. Concurrency (atomicity proof)");
  // Top up to 1000 KZT exactly so 5×500 transfers can't all succeed.
  await req("POST", "/api/qpaynet/deposit", { walletId, amount: 1000 }, auth);

  // Create receiver wallet
  const recv = await req("POST", "/api/qpaynet/wallets", { name: "concurrency-recv" }, auth);
  const recvId = recv.body.id;

  // Fire 5 parallel transfers of 500 each (only 1 should succeed without atomicity → race)
  const transfers = await Promise.all(
    [1, 2, 3, 4, 5].map(() => req("POST", "/api/qpaynet/transfer", {
      fromWalletId: walletId, toWalletId: recvId, amount: 500,
    }, auth))
  );
  const successes = transfers.filter(t => t.status === 200).length;
  const insufficient = transfers.filter(t => t.body?.error === "insufficient_balance").length;
  assert("at most 1 parallel transfer succeeded", successes <= 1, `${successes} succeeded`);
  assert("rest got insufficient_balance", successes + insufficient === 5);

  // Verify wallet balance consistent: original - successful*500.001(fee)
  const finalW = await req("GET", `/api/qpaynet/wallets/${walletId}`, null, auth);
  assert("final balance non-negative", finalW.body.balance >= 0, `balance=${finalW.body.balance}`);

  // 26. Idempotency replay
  console.log("\n21. Idempotency");
  const idemKey = "smoke-" + Date.now();
  const dep1 = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 100 }, { ...auth, "Idempotency-Key": idemKey });
  const dep2 = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 100 }, { ...auth, "Idempotency-Key": idemKey });
  assert("first deposit → 200", dep1.status === 200);
  assert("replay → 200 (cached)", dep2.status === 200);
  assert("same txId (proves cache hit)", dep1.body.txId === dep2.body.txId);

  const dep3 = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 200 }, { ...auth, "Idempotency-Key": idemKey });
  assert("different body, same key → 409", dep3.status === 409 && dep3.body.error === "idempotency_key_body_mismatch");

  // 27. Audit log
  console.log("\n22. Audit log");
  const audit = await req("GET", "/api/qpaynet/me/audit?limit=10", null, auth);
  assert("GET /me/audit → 200", audit.status === 200);
  assert("events array", Array.isArray(audit.body.events));
  assert("recent transfer logged", audit.body.events?.some(e => e.action === "transfer"));

  // 28. Insufficient balance
  console.log("\n23. Edge cases");
  const bigWd = await req("POST", "/api/qpaynet/withdraw", { walletId, amount: 999999 }, auth);
  assert("withdraw beyond balance → 400", bigWd.status === 400 && bigWd.body.error === "insufficient_balance");

  // 29. Boundary validation — proves validateOr400 helper rejects bad input
  // before any DB work runs.
  console.log("\n24. Boundary validation");
  const badUuid = await req("POST", "/api/qpaynet/transfer", {
    fromWalletId: "not-a-uuid", toWalletId: walletId, amount: 1,
  }, auth);
  assert("non-uuid fromWalletId → 400 validation_failed",
    badUuid.status === 400 && badUuid.body.error === "validation_failed" && badUuid.body.field === "fromWalletId");

  const noAmount = await req("POST", "/api/qpaynet/deposit", { walletId }, auth);
  assert("missing amount → 400 validation_failed",
    noAmount.status === 400 && noAmount.body.error === "validation_failed" && noAmount.body.field === "amount");

  const tooManyDecimals = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 1.234 }, auth);
  assert("3-decimal amount → 400 validation_failed",
    tooManyDecimals.status === 400 && tooManyDecimals.body.error === "validation_failed");

  const longDesc = await req("POST", "/api/qpaynet/deposit",
    { walletId, amount: 1, description: "x".repeat(500) }, auth);
  assert("description > 200 chars → 400 validation_failed",
    longDesc.status === 400 && longDesc.body.error === "validation_failed" && longDesc.body.field === "description");

  // 26. Wallet freeze / unfreeze (admin)
  console.log("\n26. Wallet freeze");
  const fwResp = await req("POST", "/api/qpaynet/wallets", { name: "freeze-test" }, auth);
  const fwId = fwResp.body.id;
  const fwNoReason = await req("POST", `/api/qpaynet/admin/wallets/${fwId}/freeze`, {}, auth);
  assert("freeze without reason → 400 or 403", [400, 403].includes(fwNoReason.status));
  const fwOk = await req("POST", `/api/qpaynet/admin/wallets/${fwId}/freeze`,
    { reason: "smoke freeze" }, auth);
  assert("freeze with reason → 200 or 403", [200, 403].includes(fwOk.status));
  if (fwOk.status === 200) {
    const dep = await req("POST", "/api/qpaynet/deposit",
      { walletId: fwId, amount: 1 }, auth);
    assert("deposit to frozen wallet → 400 wallet_inactive",
      dep.status === 400 && dep.body.error === "wallet_inactive");
    const unfreeze = await req("POST", `/api/qpaynet/admin/wallets/${fwId}/unfreeze`,
      { reason: "smoke unfreeze" }, auth);
    assert("unfreeze → 200", unfreeze.status === 200);
    const dep2 = await req("POST", "/api/qpaynet/deposit",
      { walletId: fwId, amount: 1 }, auth);
    assert("deposit after unfreeze → 200", dep2.status === 200);
  }

  // 27. Refund — full + double-refund rejection
  console.log("\n27. Refund");
  const depForRefund = await req("POST", "/api/qpaynet/deposit",
    { walletId, amount: 100 }, auth);
  const refundTxId = depForRefund.body.txId;
  const rNoReason = await req("POST", "/api/qpaynet/admin/refund", { txId: refundTxId }, auth);
  assert("refund without reason → 400 or 403", [400, 403].includes(rNoReason.status));
  const rOk = await req("POST", "/api/qpaynet/admin/refund",
    { txId: refundTxId, reason: "smoke refund" }, auth);
  assert("refund → 200 or 403", [200, 403].includes(rOk.status));
  if (rOk.status === 200) {
    assert("refund returns refundId", typeof rOk.body.refundId === "string");
    assert("refund records correct amount", rOk.body.refundedKzt === 100);
    const rDup = await req("POST", "/api/qpaynet/admin/refund",
      { txId: refundTxId, reason: "smoke double" }, auth);
    assert("double refund → 409 tx_already_refunded",
      rDup.status === 409 && rDup.body.error === "tx_already_refunded");
  }

  // 28. Reconciliation endpoint — money supply must match the ledger.
  // Admin-gated; if QPAYNET_ADMIN_EMAILS unset, open access. Skip if 403.
  console.log("\n28. Reconcile");
  const recon = await req("GET", "/api/qpaynet/admin/reconcile", null, auth);
  assert("GET /admin/reconcile → 200 or 403", [200, 403].includes(recon.status));
  if (recon.status === 200) {
    assert("reconcile reports drift_tiin field", typeof recon.body.drift_tiin === "string");
    assert("reconcile reports breakdown", typeof recon.body.breakdown === "object");
    assert("reconcile drift is zero (ledger consistent)",
      recon.body.drift_tiin === "0",
      `drift=${recon.body.drift_tiin}t — ledger inconsistent, investigate immediately`);
    assert("no negative wallets", recon.body.negative_wallet_count === 0,
      `${recon.body.negative_wallet_count} wallets have negative balance`);
    assert("breakdown.refunds_tiin present", "refunds_tiin" in recon.body.breakdown);
  }

  // 29. Refund Idempotency-Key — replay returns same body, mismatch → 409
  console.log("\n29. Refund idempotency");
  const idemDep = await req("POST", "/api/qpaynet/deposit", { walletId, amount: 50 }, auth);
  const idemTxId = idemDep.body.txId;
  const idemKey = "refund-" + Date.now();
  const ref1 = await req("POST", "/api/qpaynet/admin/refund",
    { txId: idemTxId, reason: "idem test" }, { ...auth, "Idempotency-Key": idemKey });
  if (ref1.status === 200) {
    const ref2 = await req("POST", "/api/qpaynet/admin/refund",
      { txId: idemTxId, reason: "idem test" }, { ...auth, "Idempotency-Key": idemKey });
    assert("refund replay same key+body → 200 cached", ref2.status === 200);
    assert("refund cached refundId matches", ref2.body.refundId === ref1.body.refundId);
    const ref3 = await req("POST", "/api/qpaynet/admin/refund",
      { txId: idemTxId, reason: "different reason" }, { ...auth, "Idempotency-Key": idemKey });
    assert("refund replay same key+different body → 409",
      ref3.status === 409 && ref3.body.error === "idempotency_key_body_mismatch");
  }

  // 30. Refund list endpoint
  console.log("\n30. Refund list");
  const rList = await req("GET", "/api/qpaynet/admin/refunds?limit=20", null, auth);
  assert("GET /admin/refunds → 200 or 403", [200, 403].includes(rList.status));
  if (rList.status === 200) {
    assert("refund list has items array", Array.isArray(rList.body.items));
    if (rList.body.items.length > 0) {
      const first = rList.body.items[0];
      assert("refund item has refundId", typeof first.refundId === "string");
      assert("refund item has originalTxId", typeof first.originalTxId === "string");
    }
  }

  // 31. Webhook deliveries admin view (durable fan-out queue)
  console.log("\n31. Webhook deliveries");
  const wd = await req("GET", "/api/qpaynet/admin/webhook-deliveries?limit=10", null, auth);
  assert("GET /admin/webhook-deliveries → 200 or 403", [200, 403].includes(wd.status));
  if (wd.status === 200) {
    assert("deliveries items array", Array.isArray(wd.body.items));
  }
  const wdStuck = await req("GET", "/api/qpaynet/admin/webhook-deliveries?status=stuck", null, auth);
  assert("GET deliveries?status=stuck → 200 or 403", [200, 403].includes(wdStuck.status));

  // 32. Health endpoint surfaces pool + stuck count
  console.log("\n32. Health diag");
  const health = await req("GET", "/api/qpaynet/health");
  assert("GET /api/qpaynet/health → 200", health.status === 200);
  assert("health reports pool stats or null", health.body.pool === null || typeof health.body.pool === "object");
  assert("health reports stuckWebhookDeliveries number",
    typeof health.body.stuckWebhookDeliveries === "number");
  assert("health reports encryption flag",
    health.body.encryption === "enabled" || health.body.encryption === "disabled");

  // 33. Public OpenAPI spec — partners use this for SDK gen / docs
  console.log("\n33. OpenAPI");
  const spec = await req("GET", "/api/qpaynet/openapi.json");
  assert("GET /api/qpaynet/openapi.json → 200", spec.status === 200);
  assert("OpenAPI version 3.1.0", spec.body.openapi === "3.1.0");
  assert("info.title is QPayNet", spec.body.info?.title?.includes("QPayNet"));
  assert("paths includes /transfer", typeof spec.body.paths?.["/transfer"] === "object");
  assert("paths includes /merchant/charge", typeof spec.body.paths?.["/merchant/charge"] === "object");
  assert("admin paths NOT exposed (partner-facing only)",
    !spec.body.paths?.["/admin/refund"] && !spec.body.paths?.["/admin/reconcile"]);
  assert("x-webhook-contract present", typeof spec.body["x-webhook-contract"] === "object");

  console.log(`\n${"═".repeat(40)}`);
  console.log(`QPayNet smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });

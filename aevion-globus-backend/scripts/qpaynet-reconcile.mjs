#!/usr/bin/env node
/**
 * QPayNet — reconciliation check.
 *
 * Sums all wallet balances and compares against the expected balance derived
 * from the immutable transaction ledger:
 *
 *   sum(balance) === sum(deposits) - sum(withdrawals + withdraw_fees)
 *                                  - sum(transfer_out_fees)
 *                                  - sum(merchant_charge_fees)
 *
 * Why this matters: every code path that touches `qpaynet_wallets.balance`
 * MUST also insert a matching `qpaynet_transactions` row. If they ever drift,
 * either there's a bug or someone wrote SQL by hand. Either way: page on it.
 *
 * Wire as a cron in production:
 *   */15 * * * * node /app/scripts/qpaynet-reconcile.mjs || curl -X POST $ALERT_URL
 *
 * Exit code:
 *   0  reconciled
 *   1  drift detected (alert)
 *   2  query failed (alert, may be DB outage)
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

try {
  const r = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(balance)::bigint, 0) FROM qpaynet_wallets) AS actual,
      (SELECT COALESCE(SUM(amount)::bigint, 0) FROM qpaynet_transactions WHERE type='deposit') AS deposits,
      (SELECT COALESCE(SUM(amount + COALESCE(fee,0))::bigint, 0) FROM qpaynet_transactions WHERE type='withdraw') AS withdraw_total,
      (SELECT COALESCE(SUM(fee)::bigint, 0) FROM qpaynet_transactions WHERE type='transfer_out') AS transfer_fees,
      (SELECT COALESCE(SUM(fee)::bigint, 0) FROM qpaynet_transactions WHERE type='merchant_charge') AS merchant_fees
  `);
  const row = r.rows[0];
  const actual = BigInt(row.actual);
  const expected = BigInt(row.deposits) - BigInt(row.withdraw_total) - BigInt(row.transfer_fees) - BigInt(row.merchant_fees);
  const drift = actual - expected;

  console.log(`[qpaynet-reconcile] actual_balance=${actual}t expected=${expected}t drift=${drift}t`);

  if (drift !== 0n) {
    console.error(`[qpaynet-reconcile] DRIFT DETECTED: ${drift} tiin (${Number(drift) / 100} KZT)`);
    console.error(`  deposits:        ${row.deposits}`);
    console.error(`  withdraw_total:  ${row.withdraw_total}`);
    console.error(`  transfer_fees:   ${row.transfer_fees}`);
    console.error(`  merchant_fees:   ${row.merchant_fees}`);
    process.exit(1);
  }
  console.log(`[qpaynet-reconcile] ok`);
  process.exit(0);
} catch (err) {
  console.error(`[qpaynet-reconcile] query failed: ${err.message}`);
  process.exit(2);
} finally {
  await pool.end();
}

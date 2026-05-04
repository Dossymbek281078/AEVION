/**
 * QPayNet Embedded — платёжная инфраструктура AEVION
 *
 * Endpoints:
 *   POST   /api/qpaynet/wallets              create wallet
 *   GET    /api/qpaynet/wallets              list my wallets
 *   GET    /api/qpaynet/wallets/:id          wallet detail + balance (owner)
 *   GET    /api/qpaynet/wallets/:id/public   recipient lookup (no auth, no balance)
 *   PATCH  /api/qpaynet/wallets/:id          rename wallet (owner)
 *   POST   /api/qpaynet/deposit              top up wallet
 *   POST   /api/qpaynet/withdraw             withdraw
 *   POST   /api/qpaynet/transfer             P2P transfer
 *   GET    /api/qpaynet/transactions         my transaction history
 *   GET    /api/qpaynet/transactions.csv     CSV export (max 5000)
 *   POST   /api/qpaynet/merchant/keys        create merchant API key
 *   GET  /api/qpaynet/merchant/keys        list my merchant keys
 *   DELETE /api/qpaynet/merchant/keys/:id  revoke key
 *   POST /api/qpaynet/merchant/charge      charge via merchant key (public, key-auth)
 *   GET  /api/qpaynet/stats                public aggregate stats
 *
 * Payment requests:
 *   POST   /api/qpaynet/requests              create request (optional notifyUrl for webhook)
 *   GET    /api/qpaynet/requests              list my requests
 *   GET    /api/qpaynet/requests/:token       public view (no auth)
 *   POST   /api/qpaynet/requests/:token/pay   pay request (auth, fires HMAC webhook on success)
 *   DELETE /api/qpaynet/requests/:id          cancel pending
 *
 * Webhook contract: when notifyUrl is set, on successful payment we POST
 *   { event: "payment_request.paid", requestId, token, amount, fee, paidBy, paidTxId, paidAt }
 * with headers:
 *   X-Aevion-Event: payment_request.paid
 *   X-Aevion-Timestamp: <unix-seconds>
 *   X-Aevion-Signature: sha256=<hmac-sha256(secret, "<ts>.<body>")>
 * Verify: HMAC-SHA256(notifySecret, `${timestamp}.${rawBody}`).
 */

import { Router, raw } from "express";
import { randomUUID, createHash, createHmac, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";

export const qpaynetRouter = Router();

const STRIPE_SK = process.env.STRIPE_SECRET_KEY?.trim();
const STRIPE_WH = process.env.QPAYNET_STRIPE_WEBHOOK_SECRET?.trim();
const stripe = STRIPE_SK ? new Stripe(STRIPE_SK, { apiVersion: "2026-04-22.dahlia" }) : null;
const FRONTEND = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ── Bootstrap ────────────────────────────────────────────────────────────────

let tablesReady = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_wallets (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        currency    TEXT NOT NULL DEFAULT 'KZT',
        balance     BIGINT NOT NULL DEFAULT 0,    -- stored in tiin (1 KZT = 100 tiin)
        status      TEXT NOT NULL DEFAULT 'active',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpw_owner ON qpaynet_wallets (owner_id);

      CREATE TABLE IF NOT EXISTS qpaynet_transactions (
        id          TEXT PRIMARY KEY,
        wallet_id   TEXT NOT NULL,
        owner_id    TEXT NOT NULL,
        type        TEXT NOT NULL,   -- deposit|withdraw|transfer_out|transfer_in|merchant_charge
        amount      BIGINT NOT NULL, -- tiin
        fee         BIGINT NOT NULL DEFAULT 0,
        currency    TEXT NOT NULL DEFAULT 'KZT',
        description TEXT,
        ref_tx_id   TEXT,            -- paired transfer
        merchant_id TEXT,
        status      TEXT NOT NULL DEFAULT 'completed',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpt_wallet ON qpaynet_transactions (wallet_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_qpt_owner  ON qpaynet_transactions (owner_id,  created_at DESC);

      CREATE TABLE IF NOT EXISTS qpaynet_merchant_keys (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        key_hash    TEXT UNIQUE NOT NULL,
        key_prefix  TEXT NOT NULL,  -- first 8 chars for display
        wallet_id   TEXT NOT NULL,
        revoked_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpmk_owner ON qpaynet_merchant_keys (owner_id);
      CREATE INDEX IF NOT EXISTS idx_qpmk_hash  ON qpaynet_merchant_keys (key_hash);
    `);
    tablesReady = true;
  } catch (err) {
    console.warn("[qpaynet] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FEE_PCT = 0.001; // 0.1% on transfers
const DAILY_DEPOSIT_CAP_KZT = parseInt(process.env.QPAYNET_DAILY_DEPOSIT_CAP ?? "500000", 10);
const MAX_TRANSFER_KZT      = parseInt(process.env.QPAYNET_MAX_TRANSFER ?? "100000", 10);
const KYC_THRESHOLD_KZT     = parseInt(process.env.QPAYNET_KYC_THRESHOLD ?? "1000000", 10); // monthly cumulative
const KYC_AUTO_VERIFY       = process.env.QPAYNET_KYC_AUTO_VERIFY === "1";

let kycTableReady = false;
let merchantWebhooksTableReady = false;
let payoutsTableReady = false;
let notificationsTableReady = false;
let depositCheckoutsTableReady = false;

async function ensureKycTable(): Promise<void> {
  if (kycTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_kyc (
        owner_id      TEXT PRIMARY KEY,
        status        TEXT NOT NULL DEFAULT 'pending',  -- pending|verified|rejected
        full_name     TEXT NOT NULL,
        iin           TEXT NOT NULL,                     -- 12-digit Kazakh tax ID
        address       TEXT,
        rejected_reason TEXT,
        submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at   TIMESTAMPTZ,
        rejected_at   TIMESTAMPTZ
      );
    `);
    kycTableReady = true;
  } catch (err) {
    console.warn("[qpaynet kyc] table init skipped:", err instanceof Error ? err.message : err);
  }
}

async function ensurePayoutsTable(): Promise<void> {
  if (payoutsTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_payouts (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        wallet_id     TEXT NOT NULL,
        amount        BIGINT NOT NULL,                  -- tiin
        currency      TEXT NOT NULL DEFAULT 'KZT',
        method        TEXT NOT NULL,                    -- card|bank_transfer|kaspi
        destination   TEXT NOT NULL,                    -- masked card / IBAN / phone
        status        TEXT NOT NULL DEFAULT 'requested', -- requested|approved|paid|rejected
        rejected_reason TEXT,
        approved_by   TEXT,
        paid_external_ref TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at   TIMESTAMPTZ,
        paid_at       TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_qpp_owner ON qpaynet_payouts (owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_qpp_status ON qpaynet_payouts (status, created_at DESC);
    `);
    payoutsTableReady = true;
  } catch (err) {
    console.warn("[qpaynet payouts] table init skipped:", err instanceof Error ? err.message : err);
  }
}

async function ensureNotificationsTable(): Promise<void> {
  if (notificationsTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_notifications (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        kind        TEXT NOT NULL,           -- payment_received|payout_approved|payout_paid|kyc_verified
        title       TEXT NOT NULL,
        body        TEXT,
        ref_id      TEXT,
        amount      BIGINT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpn_owner ON qpaynet_notifications (owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_qpn_unread ON qpaynet_notifications (owner_id) WHERE read_at IS NULL;
    `);
    notificationsTableReady = true;
  } catch (err) {
    console.warn("[qpaynet notif] table init skipped:", err instanceof Error ? err.message : err);
  }
}

async function ensureDepositCheckoutsTable(): Promise<void> {
  if (depositCheckoutsTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_deposit_checkouts (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        wallet_id     TEXT NOT NULL,
        amount        BIGINT NOT NULL,         -- tiin
        currency      TEXT NOT NULL DEFAULT 'KZT',
        provider      TEXT NOT NULL,           -- stripe|stub
        external_id   TEXT,                    -- stripe session id
        status        TEXT NOT NULL DEFAULT 'open',  -- open|paid|expired|failed
        tx_id         TEXT,                    -- credited transaction id
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at  TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_qpd_owner ON qpaynet_deposit_checkouts (owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_qpd_external ON qpaynet_deposit_checkouts (external_id);
    `);
    depositCheckoutsTableReady = true;
  } catch (err) {
    console.warn("[qpaynet checkout] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Insert a notification row + return id; safe to fire-and-forget.
async function notify(
  pool: ReturnType<typeof getPool>,
  ownerId: string,
  kind: string,
  title: string,
  body?: string,
  refId?: string,
  amountTiin?: bigint,
): Promise<void> {
  try {
    await ensureNotificationsTable();
    await pool.query(
      "INSERT INTO qpaynet_notifications (id, owner_id, kind, title, body, ref_id, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), ownerId, kind, title.slice(0, 200), body?.slice(0, 1000) ?? null, refId ?? null, amountTiin ?? null],
    );
  } catch (err) {
    console.warn("[qpaynet notify] failed:", err instanceof Error ? err.message : err);
  }
}

async function ensureMerchantWebhooksTable(): Promise<void> {
  if (merchantWebhooksTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_merchant_webhooks (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        url           TEXT NOT NULL,
        secret        TEXT NOT NULL,
        events        TEXT NOT NULL DEFAULT 'payment_request.paid',  -- comma-sep
        revoked_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpmw_owner ON qpaynet_merchant_webhooks (owner_id) WHERE revoked_at IS NULL;
    `);
    merchantWebhooksTableReady = true;
  } catch (err) {
    console.warn("[qpaynet mwh] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Sum of outgoing amounts (transfer_out + merchant_charge) for a user this month, in tiin.
async function monthlyOutgoing(pool: ReturnType<typeof getPool>, ownerId: string): Promise<bigint> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM qpaynet_transactions
     WHERE owner_id = $1 AND type IN ('transfer_out', 'merchant_charge')
       AND created_at >= date_trunc('month', NOW())`,
    [ownerId],
  );
  return BigInt(r.rows[0]?.s ?? 0);
}

function toTiin(kzt: number): bigint { return BigInt(Math.round(kzt * 100)); }
function fromTiin(t: bigint): number { return Number(t) / 100; }
function feeFor(amount: bigint): bigint { return BigInt(Math.ceil(Number(amount) * FEE_PCT)); }

// Returns sum of today's deposits for a wallet (in tiin).
async function depositedToday(pool: ReturnType<typeof getPool>, walletId: string): Promise<bigint> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS s
     FROM qpaynet_transactions
     WHERE wallet_id = $1 AND type = 'deposit' AND created_at >= NOW() - INTERVAL '24 hours'`,
    [walletId],
  );
  return BigInt(r.rows[0]?.s ?? 0);
}

function makeMerchantKey(): { raw: string; hash: string; prefix: string } {
  const raw = "qpn_live_" + randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix: raw.slice(0, 12) };
}

// ── Wallets ───────────────────────────────────────────────────────────────────

qpaynetRouter.post("/wallets", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { name = "Мой кошелёк", currency = "KZT" } = req.body as { name?: string; currency?: string };
  const pool = getPool();
  const id = randomUUID();
  const ownerId = auth.sub ?? auth.email ?? "anon";

  await pool.query(
    "INSERT INTO qpaynet_wallets (id, owner_id, name, currency) VALUES ($1,$2,$3,$4)",
    [id, ownerId, name.slice(0, 80), currency.toUpperCase().slice(0, 3)],
  );
  res.status(201).json({ id, name, currency: currency.toUpperCase(), balance: 0, status: "active" });
});

qpaynetRouter.get("/wallets", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, currency, balance, status, created_at FROM qpaynet_wallets WHERE owner_id=$1 ORDER BY created_at DESC",
    [auth.sub ?? auth.email ?? "anon"],
  );
  res.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallets: result.rows.map((r: any) => ({ ...r, balance: fromTiin(BigInt(r.balance)) })),
  });
});

qpaynetRouter.get("/wallets/:id", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query(
    "SELECT id, name, currency, balance, status, created_at FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [req.params.id, ownerId],
  );
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });
  const r = w.rows[0];
  res.json({ ...r, balance: fromTiin(BigInt(r.balance)) });
});

// GET /api/qpaynet/wallets/:id/public — recipient lookup (no auth, no balance)
qpaynetRouter.get("/wallets/:id/public", async (req, res) => {
  await ensureTables();
  const pool = getPool();
  const w = await pool.query(
    "SELECT id, name, currency, status FROM qpaynet_wallets WHERE id=$1",
    [req.params.id],
  );
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });
  const r = w.rows[0];
  res.json({ id: r.id, name: r.name, currency: r.currency, active: r.status === "active" });
});

// PATCH /api/qpaynet/wallets/:id — rename wallet (owner only)
qpaynetRouter.patch("/wallets/:id", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { name } = req.body as { name?: string };
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.length > 80) return res.status(400).json({ error: "name_required_max_80" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const r = await pool.query(
    "UPDATE qpaynet_wallets SET name=$1 WHERE id=$2 AND owner_id=$3 RETURNING id, name",
    [trimmed, req.params.id, ownerId],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "wallet_not_found" });
  res.json({ ok: true, ...r.rows[0] });
});

// ── Deposit ───────────────────────────────────────────────────────────────────

qpaynetRouter.post("/deposit", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { walletId, amount, description } = req.body as { walletId?: string; amount?: number; description?: string };
  if (!walletId || !amount || amount <= 0) return res.status(400).json({ error: "walletId and positive amount required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query(
    "SELECT id, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [walletId, ownerId],
  );
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });
  if (w.rows[0].status !== "active") return res.status(400).json({ error: "wallet_inactive" });

  const tiin = toTiin(amount);
  const cap = toTiin(DAILY_DEPOSIT_CAP_KZT);
  const already = await depositedToday(pool, walletId);
  if (already + tiin > cap) {
    return res.status(400).json({
      error: "daily_deposit_cap_exceeded",
      capKzt: DAILY_DEPOSIT_CAP_KZT,
      depositedTodayKzt: fromTiin(already),
      remainingKzt: Math.max(0, fromTiin(cap - already)),
    });
  }
  const txId = randomUUID();

  await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, walletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description) VALUES ($1,$2,$3,'deposit',$4,$5)",
    [txId, walletId, ownerId, tiin, description ?? "Пополнение"],
  );

  const updated = await pool.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [walletId]);
  res.json({ txId, amount, newBalance: fromTiin(BigInt(updated.rows[0].balance)) });
});

// ── Withdraw ─────────────────────────────────────────────────────────────────

qpaynetRouter.post("/withdraw", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { walletId, amount, description } = req.body as { walletId?: string; amount?: number; description?: string };
  if (!walletId || !amount || amount <= 0) return res.status(400).json({ error: "walletId and positive amount required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query(
    "SELECT id, balance, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [walletId, ownerId],
  );
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });

  const tiin = toTiin(amount);
  const fee = feeFor(tiin);
  const total = tiin + fee;
  if (BigInt(w.rows[0].balance) < total) return res.status(400).json({ error: "insufficient_balance" });

  const txId = randomUUID();
  await pool.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, walletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description) VALUES ($1,$2,$3,'withdraw',$4,$5,$6)",
    [txId, walletId, ownerId, tiin, fee, description ?? "Вывод"],
  );

  const updated = await pool.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [walletId]);
  res.json({ txId, amount, fee: fromTiin(fee), newBalance: fromTiin(BigInt(updated.rows[0].balance)) });
});

// ── Transfer ──────────────────────────────────────────────────────────────────

qpaynetRouter.post("/transfer", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { fromWalletId, toWalletId, amount, description } = req.body as {
    fromWalletId?: string; toWalletId?: string; amount?: number; description?: string;
  };
  if (!fromWalletId || !toWalletId || !amount || amount <= 0) {
    return res.status(400).json({ error: "fromWalletId, toWalletId and positive amount required" });
  }
  if (amount > MAX_TRANSFER_KZT) {
    return res.status(400).json({ error: "transfer_amount_exceeds_max", maxKzt: MAX_TRANSFER_KZT });
  }
  if (fromWalletId === toWalletId) {
    return res.status(400).json({ error: "cannot_transfer_to_same_wallet" });
  }

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";

  // KYC soft enforcement: monthly outgoing > threshold requires verified status.
  await ensureKycTable();
  const monthly = await monthlyOutgoing(pool, ownerId);
  const projected = monthly + toTiin(amount);
  if (projected > toTiin(KYC_THRESHOLD_KZT)) {
    const kyc = await pool.query("SELECT status FROM qpaynet_kyc WHERE owner_id=$1", [ownerId]);
    if (kyc.rows[0]?.status !== "verified") {
      return res.status(403).json({
        error: "kyc_required",
        thresholdKzt: KYC_THRESHOLD_KZT,
        monthlyOutgoingKzt: fromTiin(monthly),
        kycStatus: kyc.rows[0]?.status ?? "none",
        message: "Submit KYC at /qpaynet/kyc to lift the monthly transfer limit.",
      });
    }
  }

  const from = await pool.query(
    "SELECT id, balance, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [fromWalletId, ownerId],
  );
  if (!from.rows[0]) return res.status(404).json({ error: "from_wallet_not_found" });
  if (from.rows[0].status !== "active") return res.status(400).json({ error: "from_wallet_inactive" });

  const to = await pool.query("SELECT id, owner_id, status FROM qpaynet_wallets WHERE id=$1", [toWalletId]);
  if (!to.rows[0]) return res.status(404).json({ error: "to_wallet_not_found" });

  const tiin = toTiin(amount);
  const fee = feeFor(tiin);
  const total = tiin + fee;
  if (BigInt(from.rows[0].balance) < total) return res.status(400).json({ error: "insufficient_balance" });

  const txOutId = randomUUID();
  const txInId  = randomUUID();
  const desc = description ?? `Перевод → ${toWalletId.slice(0, 8)}`;

  await pool.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, fromWalletId]);
  await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, toWalletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6,$7)",
    [txOutId, fromWalletId, ownerId, tiin, fee, desc, txInId],
  );
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
    [txInId, toWalletId, to.rows[0].owner_id, tiin, desc, txOutId],
  );

  const updated = await pool.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [fromWalletId]);
  res.json({ txOutId, txInId, amount, fee: fromTiin(fee), newBalance: fromTiin(BigInt(updated.rows[0].balance)) });
});

// ── Transactions ──────────────────────────────────────────────────────────────

qpaynetRouter.get("/transactions", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const walletId = req.query.walletId as string | undefined;
  const type = req.query.type as string | undefined;
  const ownerId = auth.sub ?? auth.email ?? "anon";

  const params: unknown[] = [ownerId];
  let where = "owner_id=$1";
  if (walletId) { params.push(walletId); where += ` AND wallet_id=$${params.length}`; }
  if (type) { params.push(type); where += ` AND type=$${params.length}`; }
  params.push(limit);

  const result = await pool.query(
    `SELECT id, wallet_id, type, amount, fee, currency, description, status, created_at
     FROM qpaynet_transactions WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  res.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: result.rows.map((r: any) => ({
      ...r,
      amount: fromTiin(BigInt(r.amount)),
      fee: fromTiin(BigInt(r.fee)),
    })),
  });
});

// GET /api/qpaynet/transactions.csv — CSV export
qpaynetRouter.get("/transactions.csv", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const walletId = req.query.walletId as string | undefined;

  const params: unknown[] = [ownerId];
  let where = "owner_id=$1";
  if (walletId) { params.push(walletId); where += ` AND wallet_id=$${params.length}`; }

  const result = await pool.query(
    `SELECT id, wallet_id, type, amount, fee, currency, description, status, created_at
     FROM qpaynet_transactions WHERE ${where} ORDER BY created_at DESC LIMIT 5000`,
    params,
  );

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "id,wallet_id,type,amount,fee,currency,description,status,created_at";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result.rows.map((r: any) => [
    r.id, r.wallet_id, r.type,
    fromTiin(BigInt(r.amount)),
    fromTiin(BigInt(r.fee)),
    r.currency, r.description ?? "", r.status,
    new Date(r.created_at).toISOString(),
  ].map(escape).join(","));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="qpaynet-transactions-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(header + "\n" + rows.join("\n"));
});

// ── Merchant keys ─────────────────────────────────────────────────────────────

qpaynetRouter.post("/merchant/keys", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { name = "API Key", walletId } = req.body as { name?: string; walletId?: string };
  if (!walletId) return res.status(400).json({ error: "walletId required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query("SELECT id FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2", [walletId, ownerId]);
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });

  const { raw, hash, prefix } = makeMerchantKey();
  const id = randomUUID();
  await pool.query(
    "INSERT INTO qpaynet_merchant_keys (id, owner_id, name, key_hash, key_prefix, wallet_id) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, ownerId, name.slice(0, 80), hash, prefix, walletId],
  );
  res.status(201).json({ id, name, keyPrefix: prefix, key: raw, message: "Save this key — it won't be shown again." });
});

qpaynetRouter.get("/merchant/keys", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, key_prefix, wallet_id, revoked_at, created_at FROM qpaynet_merchant_keys WHERE owner_id=$1 ORDER BY created_at DESC",
    [auth.sub ?? auth.email ?? "anon"],
  );
  res.json({ keys: result.rows });
});

qpaynetRouter.delete("/merchant/keys/:id", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_merchant_keys SET revoked_at=NOW() WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING id",
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "key_not_found_or_revoked" });
  res.json({ ok: true });
});

// POST /api/qpaynet/merchant/charge — charge a user wallet via merchant key
qpaynetRouter.post("/merchant/charge", async (req, res) => {
  await ensureTables();
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: "x-api-key header required" });

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const pool = getPool();
  const mk = await pool.query(
    "SELECT id, wallet_id, owner_id FROM qpaynet_merchant_keys WHERE key_hash=$1 AND revoked_at IS NULL",
    [keyHash],
  );
  if (!mk.rows[0]) return res.status(403).json({ error: "invalid_or_revoked_key" });

  const { amount, description, customerWalletId } = req.body as {
    amount?: number; description?: string; customerWalletId?: string;
  };
  if (!amount || amount <= 0 || !customerWalletId) {
    return res.status(400).json({ error: "amount and customerWalletId required" });
  }

  const merchantWalletId = mk.rows[0].wallet_id;
  if (merchantWalletId === customerWalletId) return res.status(400).json({ error: "cannot_charge_own_wallet" });

  const tiin = toTiin(amount);
  const fee = feeFor(tiin);
  const total = tiin + fee;

  const from = await pool.query("SELECT balance, status FROM qpaynet_wallets WHERE id=$1", [customerWalletId]);
  if (!from.rows[0]) return res.status(404).json({ error: "customer_wallet_not_found" });
  if (BigInt(from.rows[0].balance) < total) return res.status(400).json({ error: "insufficient_balance" });

  const txOutId = randomUUID();
  const txInId  = randomUUID();
  const desc = description ?? "Merchant charge";

  await pool.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, customerWalletId]);
  await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, merchantWalletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, merchant_id) VALUES ($1,$2,$3,'merchant_charge',$4,$5,$6,$7)",
    [txOutId, customerWalletId, mk.rows[0].owner_id, tiin, fee, desc, mk.rows[0].id],
  );
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, merchant_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
    [txInId, merchantWalletId, mk.rows[0].owner_id, tiin, desc, mk.rows[0].id],
  );

  res.json({ ok: true, txId: txOutId, amount, fee: fromTiin(fee) });
});

// GET /api/qpaynet/stats
qpaynetRouter.get("/stats", async (_req, res) => {
  await ensureTables();
  try {
    const pool = getPool();
    const [wallets, txs, vol] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM qpaynet_wallets WHERE status='active'"),
      pool.query("SELECT COUNT(*) AS n FROM qpaynet_transactions"),
      pool.query("SELECT COALESCE(SUM(amount),0) AS v FROM qpaynet_transactions WHERE type='deposit'"),
    ]);
    res.json({
      activeWallets: Number(wallets.rows[0]?.n ?? 0),
      totalTransactions: Number(txs.rows[0]?.n ?? 0),
      totalDepositedKzt: fromTiin(BigInt(vol.rows[0]?.v ?? 0)),
    });
  } catch {
    res.json({ activeWallets: 0, totalTransactions: 0, totalDepositedKzt: 0 });
  }
});

// ── KYC ──────────────────────────────────────────────────────────────────────
// Compliance stub for РК. Soft-blocks transfers when monthly outgoing
// exceeds QPAYNET_KYC_THRESHOLD (default 1M KZT) and KYC isn't verified.

// POST /api/qpaynet/kyc/submit
qpaynetRouter.post("/kyc/submit", async (req, res) => {
  await ensureKycTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { fullName, iin, address } = req.body as { fullName?: string; iin?: string; address?: string };
  if (!fullName?.trim() || fullName.trim().length < 5) return res.status(400).json({ error: "full_name_required" });
  if (!iin || !/^\d{12}$/.test(iin)) return res.status(400).json({ error: "iin_must_be_12_digits" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const status = KYC_AUTO_VERIFY ? "verified" : "pending";

  await pool.query(
    `INSERT INTO qpaynet_kyc (owner_id, status, full_name, iin, address, submitted_at, verified_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (owner_id) DO UPDATE SET
       status = EXCLUDED.status,
       full_name = EXCLUDED.full_name,
       iin = EXCLUDED.iin,
       address = EXCLUDED.address,
       submitted_at = NOW(),
       verified_at = EXCLUDED.verified_at,
       rejected_at = NULL,
       rejected_reason = NULL`,
    [ownerId, status, fullName.trim().slice(0, 200), iin, address?.trim().slice(0, 500) ?? null, KYC_AUTO_VERIFY ? new Date() : null],
  );
  res.json({ ok: true, status, autoVerified: KYC_AUTO_VERIFY });
});

// GET /api/qpaynet/kyc/status
qpaynetRouter.get("/kyc/status", async (req, res) => {
  await ensureKycTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const r = await pool.query(
    "SELECT status, full_name, iin, address, submitted_at, verified_at, rejected_at, rejected_reason FROM qpaynet_kyc WHERE owner_id=$1",
    [ownerId],
  );
  const monthly = await monthlyOutgoing(pool, ownerId);
  const monthlyKzt = fromTiin(monthly);
  const remainingBeforeKyc = Math.max(0, KYC_THRESHOLD_KZT - monthlyKzt);

  if (!r.rows[0]) {
    return res.json({
      status: "none",
      thresholdKzt: KYC_THRESHOLD_KZT,
      monthlyOutgoingKzt: monthlyKzt,
      remainingKztBeforeKycRequired: remainingBeforeKyc,
      autoVerifyEnabled: KYC_AUTO_VERIFY,
    });
  }
  const k = r.rows[0];
  res.json({
    status: k.status,
    fullName: k.full_name,
    iinMasked: k.iin ? `${k.iin.slice(0,4)}********` : null,
    address: k.address,
    submittedAt: k.submitted_at,
    verifiedAt: k.verified_at,
    rejectedAt: k.rejected_at,
    rejectedReason: k.rejected_reason,
    thresholdKzt: KYC_THRESHOLD_KZT,
    monthlyOutgoingKzt: monthlyKzt,
    remainingKztBeforeKycRequired: remainingBeforeKyc,
  });
});

// ── Generic merchant webhook subscriptions ───────────────────────────────────
// Set-once per owner (vs per-request notifyUrl). Fan out alongside the
// per-request webhook on payment_request.paid.

// POST /api/qpaynet/webhook-subs
qpaynetRouter.post("/webhook-subs", async (req, res) => {
  await ensureMerchantWebhooksTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { url, events = "payment_request.paid" } = req.body as { url?: string; events?: string };
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "url_must_be_http_or_https" });

  const pool = getPool();
  const id = randomUUID();
  const secret = randomBytes(24).toString("base64url");
  const ownerId = auth.sub ?? auth.email ?? "anon";

  await pool.query(
    "INSERT INTO qpaynet_merchant_webhooks (id, owner_id, url, secret, events) VALUES ($1,$2,$3,$4,$5)",
    [id, ownerId, url, secret, events.slice(0, 200)],
  );
  res.status(201).json({ id, url, events, secret, message: "Save the secret — it won't be shown again." });
});

// GET /api/qpaynet/webhook-subs
qpaynetRouter.get("/webhook-subs", async (req, res) => {
  await ensureMerchantWebhooksTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "SELECT id, url, events, revoked_at, created_at FROM qpaynet_merchant_webhooks WHERE owner_id=$1 ORDER BY created_at DESC",
    [auth.sub ?? auth.email ?? "anon"],
  );
  res.json({ subscriptions: r.rows });
});

// DELETE /api/qpaynet/webhook-subs/:id
qpaynetRouter.delete("/webhook-subs/:id", async (req, res) => {
  await ensureMerchantWebhooksTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_merchant_webhooks SET revoked_at=NOW() WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING id",
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_already_revoked" });
  res.json({ ok: true });
});

// Helper: fan out an event to all active merchant webhooks for an owner.
async function fanOutToOwner(
  pool: ReturnType<typeof getPool>,
  ownerId: string,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureMerchantWebhooksTable();
    const r = await pool.query(
      "SELECT url, secret, events FROM qpaynet_merchant_webhooks WHERE owner_id=$1 AND revoked_at IS NULL",
      [ownerId],
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subs = r.rows.filter((s: any) => (s.events as string).split(",").map(e => e.trim()).includes(eventName));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all(subs.map((s: any) => fireRequestWebhook(s.url, s.secret, payload)));
  } catch (err) {
    console.warn("[qpaynet fanout] failed:", err instanceof Error ? err.message : err);
  }
}

// ── Payment Requests ─────────────────────────────────────────────────────────
// Public "request money" link: owner creates → shares link → payer pays.

async function ensureRequestsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qpaynet_payment_requests (
      id            TEXT PRIMARY KEY,
      owner_id      TEXT NOT NULL,
      to_wallet_id  TEXT NOT NULL,
      token         TEXT UNIQUE NOT NULL,
      amount        BIGINT NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'KZT',
      description   TEXT NOT NULL,
      note          TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      paid_by       TEXT,
      paid_tx_id    TEXT,
      paid_at       TIMESTAMPTZ,
      expires_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_qpr_owner ON qpaynet_payment_requests (owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_qpr_token ON qpaynet_payment_requests (token);
    CREATE INDEX IF NOT EXISTS idx_qpr_wallet ON qpaynet_payment_requests (to_wallet_id);
  `);
  await pool.query(`
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notify_url TEXT;
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notify_secret TEXT;
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notify_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notify_last_error TEXT;
    ALTER TABLE qpaynet_payment_requests ADD COLUMN IF NOT EXISTS notify_next_retry_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_qpr_notify_due ON qpaynet_payment_requests (notify_next_retry_at)
      WHERE notify_url IS NOT NULL AND notified_at IS NULL;
  `).catch(() => {});
}

// Exponential backoff: 30s, 2m, 10m, 30m, 2h, then give up at 5 attempts.
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];
const MAX_NOTIFY_ATTEMPTS = 5;

function nextRetryAt(attempts: number): Date | null {
  if (attempts >= MAX_NOTIFY_ATTEMPTS) return null;
  return new Date(Date.now() + RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)]);
}

// Single-attempt HMAC-SHA256 signed webhook delivery for payment_request events.
// Returns { ok, status, error } for the caller to decide on retry scheduling.
// Matches AEVION convention: X-Aevion-Signature = HMAC-SHA256(secret, timestamp + "." + body).
async function fireRequestWebhook(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AEVION-QPayNet/1.0",
        "X-Aevion-Event": "payment_request.paid",
        "X-Aevion-Timestamp": String(timestamp),
        "X-Aevion-Signature": `sha256=${sig}`,
      },
      body,
    });
    clearTimeout(t);
    return { ok: r.ok, status: r.status, error: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// Build payload for a paid request — used by both initial fire and retries.
async function buildPaidPayload(
  pool: ReturnType<typeof getPool>,
  pr: { id: string; token: string; amount: bigint; description: string; paid_by: string | null; paid_tx_id: string | null; paid_at: Date | null },
): Promise<Record<string, unknown>> {
  return {
    event: "payment_request.paid",
    requestId: pr.id,
    token: pr.token,
    amount: fromTiin(pr.amount),
    fee: fromTiin(feeFor(pr.amount)),
    currency: "KZT",
    description: pr.description,
    paidBy: pr.paid_by,
    paidTxId: pr.paid_tx_id,
    paidAt: pr.paid_at?.toISOString?.() ?? null,
  };
}

// POST /api/qpaynet/requests — create payment request (auth required)
qpaynetRouter.post("/requests", async (req, res) => {
  await ensureTables();
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { toWalletId, amount, description, note, expiresAt, notifyUrl } = req.body as {
    toWalletId?: string; amount?: number; description?: string;
    note?: string; expiresAt?: string; notifyUrl?: string;
  };
  if (!toWalletId || !amount || amount <= 0 || !description?.trim()) {
    return res.status(400).json({ error: "toWalletId, positive amount, and description required" });
  }
  if (amount > MAX_TRANSFER_KZT) {
    return res.status(400).json({ error: "request_amount_exceeds_max", maxKzt: MAX_TRANSFER_KZT });
  }
  if (notifyUrl && !/^https?:\/\//i.test(notifyUrl)) {
    return res.status(400).json({ error: "notifyUrl_must_be_http_or_https" });
  }

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query("SELECT id FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2", [toWalletId, ownerId]);
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });

  const id = randomUUID();
  const token = randomBytes(16).toString("base64url");
  const tiin = toTiin(amount);
  // Auto-mint a per-request webhook secret so partners can verify HMAC.
  const notifySecret = notifyUrl ? randomBytes(24).toString("base64url") : null;

  await pool.query(
    `INSERT INTO qpaynet_payment_requests
       (id, owner_id, to_wallet_id, token, amount, description, note, expires_at, notify_url, notify_secret)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, ownerId, toWalletId, token, tiin, description.trim(), note?.trim() ?? null, expiresAt ?? null, notifyUrl ?? null, notifySecret],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  res.status(201).json({
    id, token,
    payUrl: `${frontendBase}/qpaynet/r/${token}`,
    amount, currency: "KZT",
    ...(notifyUrl ? { notifyUrl, notifySecret } : {}),
  });
});

// GET /api/qpaynet/requests — list my requests (auth required)
qpaynetRouter.get("/requests", async (req, res) => {
  await ensureTables();
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const result = await pool.query(
    `SELECT id, to_wallet_id, token, amount, currency, description, status,
            paid_at, expires_at, created_at
     FROM qpaynet_payment_requests WHERE owner_id=$1
     ORDER BY created_at DESC LIMIT 50`,
    [ownerId],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json({ requests: result.rows.map((r: any) => ({
    ...r,
    amount: fromTiin(BigInt(r.amount)),
    payUrl: `${frontendBase}/qpaynet/r/${r.token}`,
  })) });
});

// GET /api/qpaynet/requests.csv — owner accounting export (auth)
qpaynetRouter.get("/requests.csv", async (req, res) => {
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const result = await pool.query(
    `SELECT id, token, to_wallet_id, amount, currency, description, status,
            paid_by, paid_tx_id, paid_at, expires_at, created_at,
            notify_url, notify_attempts, notified_at
     FROM qpaynet_payment_requests
     WHERE owner_id=$1
     ORDER BY created_at DESC LIMIT 5000`,
    [ownerId],
  );
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "id,token,to_wallet_id,amount,currency,description,status,paid_by,paid_tx_id,paid_at,expires_at,created_at,notify_url,notify_attempts,delivered_at";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result.rows.map((r: any) => [
    r.id, r.token, r.to_wallet_id,
    fromTiin(BigInt(r.amount)),
    r.currency, r.description ?? "", r.status,
    r.paid_by ?? "", r.paid_tx_id ?? "",
    r.paid_at ? new Date(r.paid_at).toISOString() : "",
    r.expires_at ? new Date(r.expires_at).toISOString() : "",
    new Date(r.created_at).toISOString(),
    r.notify_url ?? "",
    r.notify_attempts ?? 0,
    r.notified_at ? new Date(r.notified_at).toISOString() : "",
  ].map(escape).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="qpaynet-requests-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(header + "\n" + rows.join("\n"));
});

// GET /api/qpaynet/requests/:token — view request (public, no auth)
qpaynetRouter.get("/requests/:token", async (req, res) => {
  await ensureRequestsTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, to_wallet_id, amount, currency, description, status, paid_at, expires_at, created_at
     FROM qpaynet_payment_requests WHERE token=$1`,
    [req.params.token],
  );
  const r = result.rows[0];
  if (!r) return res.status(404).json({ error: "request_not_found" });

  const expired = r.expires_at && new Date(r.expires_at) < new Date();
  res.json({
    id: r.id,
    amount: fromTiin(BigInt(r.amount)),
    currency: r.currency,
    description: r.description,
    status: expired && r.status === "pending" ? "expired" : r.status,
    paidAt: r.paid_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  });
});

// POST /api/qpaynet/requests/:token/pay — pay a request (auth required)
qpaynetRouter.post("/requests/:token/pay", async (req, res) => {
  await ensureTables();
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { fromWalletId } = req.body as { fromWalletId?: string };
  if (!fromWalletId) return res.status(400).json({ error: "fromWalletId required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";

  const reqRow = await pool.query(
    "SELECT id, to_wallet_id, amount, description, status, expires_at, notify_url, notify_secret FROM qpaynet_payment_requests WHERE token=$1",
    [req.params.token],
  );
  const pr = reqRow.rows[0];
  if (!pr) return res.status(404).json({ error: "request_not_found" });
  if (pr.status !== "pending") return res.status(400).json({ error: `request_${pr.status}` });
  if (pr.expires_at && new Date(pr.expires_at) < new Date()) return res.status(400).json({ error: "request_expired" });
  if (pr.to_wallet_id === fromWalletId) return res.status(400).json({ error: "cannot_pay_own_request" });

  const from = await pool.query(
    "SELECT id, balance, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [fromWalletId, ownerId],
  );
  if (!from.rows[0]) return res.status(404).json({ error: "from_wallet_not_found" });
  if (from.rows[0].status !== "active") return res.status(400).json({ error: "wallet_inactive" });

  const tiin = BigInt(pr.amount);
  const fee = feeFor(tiin);
  const total = tiin + fee;

  if (BigInt(from.rows[0].balance) < total) return res.status(400).json({ error: "insufficient_balance" });

  const txOutId = randomUUID();
  const txInId  = randomUUID();
  const desc = `Оплата запроса: ${pr.description}`;

  await pool.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, fromWalletId]);
  await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, pr.to_wallet_id]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6,$7)",
    [txOutId, fromWalletId, ownerId, tiin, fee, desc, txInId],
  );
  const toWallet = await pool.query("SELECT owner_id FROM qpaynet_wallets WHERE id=$1", [pr.to_wallet_id]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
    [txInId, pr.to_wallet_id, toWallet.rows[0]?.owner_id ?? "unknown", tiin, desc, txOutId],
  );
  await pool.query(
    "UPDATE qpaynet_payment_requests SET status='paid', paid_by=$1, paid_tx_id=$2, paid_at=NOW() WHERE id=$3",
    [fromWalletId, txOutId, pr.id],
  );

  const updated = await pool.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [fromWalletId]);

  // Async webhook with retry queue (handled by background worker on failure).
  const payload = {
    event: "payment_request.paid",
    requestId: pr.id,
    token: req.params.token,
    amount: fromTiin(tiin),
    fee: fromTiin(fee),
    currency: "KZT",
    description: pr.description,
    paidBy: fromWalletId,
    paidTxId: txOutId,
    paidAt: new Date().toISOString(),
  };
  // Fan out to recipient owner's generic webhook subscriptions (set-once).
  const recipientOwnerId = toWallet.rows[0]?.owner_id;
  if (recipientOwnerId) {
    void fanOutToOwner(pool, recipientOwnerId, "payment_request.paid", payload);
    // In-app notification for the recipient.
    void notify(
      pool, recipientOwnerId, "payment_received",
      `Получено ${fromTiin(tiin).toLocaleString("ru-RU")} ₸`,
      pr.description, pr.id, tiin,
    );
  }
  if (pr.notify_url && pr.notify_secret) {
    fireRequestWebhook(pr.notify_url, pr.notify_secret, payload).then(async (result) => {
      if (result.ok) {
        await pool.query(
          "UPDATE qpaynet_payment_requests SET notified_at=NOW(), notify_attempts=1, notify_next_retry_at=NULL WHERE id=$1",
          [pr.id],
        );
      } else {
        const next = nextRetryAt(1);
        await pool.query(
          "UPDATE qpaynet_payment_requests SET notify_attempts=1, notify_last_error=$1, notify_next_retry_at=$2 WHERE id=$3",
          [result.error?.slice(0, 500) ?? "unknown", next, pr.id],
        );
      }
    }).catch(() => {});
  }

  res.json({
    ok: true, txId: txOutId,
    amount: fromTiin(tiin), fee: fromTiin(fee),
    newBalance: fromTiin(BigInt(updated.rows[0].balance)),
  });
});

// DELETE /api/qpaynet/requests/:id — cancel request (owner only)
qpaynetRouter.delete("/requests/:id", async (req, res) => {
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_payment_requests SET status='cancelled' WHERE id=$1 AND owner_id=$2 AND status='pending' RETURNING id",
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_not_pending" });
  res.json({ ok: true });
});

// GET /api/qpaynet/requests/:id/deliveries — owner sees webhook delivery state
qpaynetRouter.get("/requests/:id/deliveries", async (req, res) => {
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    `SELECT id, notify_url, notify_attempts, notify_last_error, notify_next_retry_at, notified_at
     FROM qpaynet_payment_requests
     WHERE id=$1 AND owner_id=$2`,
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if (!r.rows[0]) return res.status(404).json({ error: "not_found" });
  const d = r.rows[0];
  res.json({
    requestId: d.id,
    notifyUrl: d.notify_url,
    attempts: d.notify_attempts,
    lastError: d.notify_last_error,
    nextRetryAt: d.notify_next_retry_at,
    deliveredAt: d.notified_at,
    status: d.notified_at ? "delivered" : (d.notify_attempts >= MAX_NOTIFY_ATTEMPTS ? "exhausted" : (d.notify_attempts > 0 ? "retrying" : "pending")),
  });
});

// ── Deposit checkout (Stripe) ────────────────────────────────────────────────
// Real card payment flow. With STRIPE_SECRET_KEY: creates Stripe Checkout
// Session in KZT. Without: stub session that auto-credits via /confirm-stub
// so dev/staging UX can be exercised end-to-end.

// POST /api/qpaynet/deposit/checkout — create Stripe Checkout Session
qpaynetRouter.post("/deposit/checkout", async (req, res) => {
  await ensureTables();
  await ensureDepositCheckoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { walletId, amount } = req.body as { walletId?: string; amount?: number };
  if (!walletId || !amount || amount <= 0) return res.status(400).json({ error: "walletId and positive amount required" });
  if (amount > DAILY_DEPOSIT_CAP_KZT) {
    return res.status(400).json({ error: "amount_exceeds_daily_cap", capKzt: DAILY_DEPOSIT_CAP_KZT });
  }

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query("SELECT id, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2", [walletId, ownerId]);
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });
  if (w.rows[0].status !== "active") return res.status(400).json({ error: "wallet_inactive" });

  const id = randomUUID();
  const tiin = toTiin(amount);

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "kzt",
          unit_amount: Math.round(amount * 100), // Stripe expects smallest unit (tiin for KZT)
          product_data: { name: "AEVION QPayNet — пополнение кошелька" },
        },
        quantity: 1,
      }],
      success_url: `${FRONTEND}/qpaynet/deposit/success?cid=${id}`,
      cancel_url:  `${FRONTEND}/qpaynet/deposit?cancelled=1`,
      client_reference_id: id,
      metadata: { qpaynet_checkout_id: id, walletId, ownerId },
    });
    await pool.query(
      "INSERT INTO qpaynet_deposit_checkouts (id, owner_id, wallet_id, amount, provider, external_id) VALUES ($1,$2,$3,$4,'stripe',$5)",
      [id, ownerId, walletId, tiin, session.id],
    );
    return res.json({ id, url: session.url, provider: "stripe" });
  }

  // Stub: no Stripe key — return a confirmation URL the frontend can hit.
  await pool.query(
    "INSERT INTO qpaynet_deposit_checkouts (id, owner_id, wallet_id, amount, provider) VALUES ($1,$2,$3,$4,'stub')",
    [id, ownerId, walletId, tiin],
  );
  res.json({
    id, provider: "stub",
    url: `${FRONTEND}/qpaynet/deposit/success?cid=${id}&stub=1`,
    hint: "Stripe not configured — use POST /deposit/confirm-stub to finalize.",
  });
});

// POST /api/qpaynet/deposit/confirm-stub — dev-only: simulate webhook for stub flow
qpaynetRouter.post("/deposit/confirm-stub", async (req, res) => {
  if (stripe) return res.status(400).json({ error: "stripe_configured_use_real_webhook" });
  await ensureTables();
  await ensureDepositCheckoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ error: "id required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const c = await pool.query(
    "SELECT id, wallet_id, amount, status FROM qpaynet_deposit_checkouts WHERE id=$1 AND owner_id=$2 AND provider='stub'",
    [id, ownerId],
  );
  if (!c.rows[0]) return res.status(404).json({ error: "checkout_not_found" });
  if (c.rows[0].status !== "open") return res.status(400).json({ error: `already_${c.rows[0].status}` });

  await creditDeposit(pool, c.rows[0].id, c.rows[0].wallet_id, ownerId, BigInt(c.rows[0].amount), "Stub-пополнение (dev)");
  res.json({ ok: true });
});

// POST /api/qpaynet/deposit/webhook — Stripe webhook (raw body, signature verified)
qpaynetRouter.post("/deposit/webhook", raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WH) return res.status(503).json({ error: "stripe_or_webhook_secret_missing" });
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "missing_signature" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WH);
  } catch (err) {
    return res.status(400).json({ error: "signature_verification_failed", detail: err instanceof Error ? err.message : String(err) });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutId = session.metadata?.qpaynet_checkout_id ?? session.client_reference_id;
    if (checkoutId) {
      await ensureDepositCheckoutsTable();
      const pool = getPool();
      const c = await pool.query(
        "SELECT id, owner_id, wallet_id, amount, status FROM qpaynet_deposit_checkouts WHERE id=$1",
        [checkoutId],
      );
      if (c.rows[0] && c.rows[0].status === "open") {
        await creditDeposit(pool, c.rows[0].id, c.rows[0].wallet_id, c.rows[0].owner_id, BigInt(c.rows[0].amount), "Пополнение карты (Stripe)");
      }
    }
  }
  res.json({ received: true });
});

async function creditDeposit(
  pool: ReturnType<typeof getPool>,
  checkoutId: string,
  walletId: string,
  ownerId: string,
  tiin: bigint,
  description: string,
): Promise<void> {
  const txId = randomUUID();
  await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, walletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description) VALUES ($1,$2,$3,'deposit',$4,$5)",
    [txId, walletId, ownerId, tiin, description],
  );
  await pool.query(
    "UPDATE qpaynet_deposit_checkouts SET status='paid', tx_id=$1, completed_at=NOW() WHERE id=$2",
    [txId, checkoutId],
  );
  await notify(pool, ownerId, "deposit_received", `Пополнено ${fromTiin(tiin).toLocaleString("ru-RU")} ₸`, description, txId, tiin);
}

// GET /api/qpaynet/deposit/checkout/:id — owner polls status
qpaynetRouter.get("/deposit/checkout/:id", async (req, res) => {
  await ensureDepositCheckoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "SELECT id, wallet_id, amount, currency, provider, status, tx_id, created_at, completed_at FROM qpaynet_deposit_checkouts WHERE id=$1 AND owner_id=$2",
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if (!r.rows[0]) return res.status(404).json({ error: "not_found" });
  res.json({ ...r.rows[0], amount: fromTiin(BigInt(r.rows[0].amount)) });
});

// ── Payouts (settlements) ────────────────────────────────────────────────────
// User requests a payout to external rail (bank card, Kaspi). Funds debit
// immediately (with reversal on rejected). Admin approves → marks paid with
// external ref. Manual rail until partnership is signed.

// POST /api/qpaynet/payouts — request payout
qpaynetRouter.post("/payouts", async (req, res) => {
  await ensureTables();
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { walletId, amount, method, destination } = req.body as {
    walletId?: string; amount?: number; method?: string; destination?: string;
  };
  if (!walletId || !amount || amount <= 0) return res.status(400).json({ error: "walletId and positive amount required" });
  if (!method || !["card", "bank_transfer", "kaspi"].includes(method)) return res.status(400).json({ error: "method_must_be_card_bank_transfer_or_kaspi" });
  if (!destination || destination.length < 4) return res.status(400).json({ error: "destination_required" });
  if (amount > MAX_TRANSFER_KZT) return res.status(400).json({ error: "payout_exceeds_max", maxKzt: MAX_TRANSFER_KZT });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query(
    "SELECT id, balance, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2",
    [walletId, ownerId],
  );
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });
  if (w.rows[0].status !== "active") return res.status(400).json({ error: "wallet_inactive" });

  const tiin = toTiin(amount);
  const fee = feeFor(tiin);
  const total = tiin + fee;
  if (BigInt(w.rows[0].balance) < total) return res.status(400).json({ error: "insufficient_balance" });

  const id = randomUUID();
  const txId = randomUUID();

  // Debit immediately; if admin rejects later, we issue a reversal tx.
  await pool.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, walletId]);
  await pool.query(
    "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, status) VALUES ($1,$2,$3,'withdraw',$4,$5,$6,'pending')",
    [txId, walletId, ownerId, tiin, fee, `Payout (${method}): ${destination.slice(-4)}`],
  );
  await pool.query(
    `INSERT INTO qpaynet_payouts (id, owner_id, wallet_id, amount, method, destination, paid_external_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, ownerId, walletId, tiin, method, destination.slice(0, 100), txId],
  );

  res.status(201).json({ id, amount, fee: fromTiin(fee), method, status: "requested", txId });
});

// GET /api/qpaynet/payouts — list my payouts
qpaynetRouter.get("/payouts", async (req, res) => {
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    `SELECT id, wallet_id, amount, currency, method, destination, status, rejected_reason,
            paid_external_ref, created_at, approved_at, paid_at
     FROM qpaynet_payouts WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [auth.sub ?? auth.email ?? "anon"],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json({ payouts: r.rows.map((x: any) => ({ ...x, amount: fromTiin(BigInt(x.amount)) })) });
});

// POST /api/qpaynet/admin/payouts/:id/approve — admin marks paid
// Soft-admin: gated via env QPAYNET_ADMIN_EMAILS comma-list.
qpaynetRouter.post("/admin/payouts/:id/:action", async (req, res) => {
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const adminEmails = (process.env.QPAYNET_ADMIN_EMAILS ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const callerEmail = (auth.email ?? "").toLowerCase();
  if (adminEmails.length > 0 && !adminEmails.includes(callerEmail)) {
    return res.status(403).json({ error: "not_admin" });
  }

  const action = req.params.action;
  if (!["approve", "mark-paid", "reject"].includes(action)) return res.status(400).json({ error: "invalid_action" });

  const pool = getPool();
  const p = await pool.query("SELECT id, owner_id, wallet_id, amount, paid_external_ref, status FROM qpaynet_payouts WHERE id=$1", [req.params.id]);
  if (!p.rows[0]) return res.status(404).json({ error: "not_found" });
  const po = p.rows[0];

  if (action === "approve" && po.status === "requested") {
    await pool.query("UPDATE qpaynet_payouts SET status='approved', approved_at=NOW(), approved_by=$1 WHERE id=$2", [callerEmail, po.id]);
    await notify(pool, po.owner_id, "payout_approved", `Payout одобрен`, undefined, po.id, BigInt(po.amount));
    return res.json({ ok: true, status: "approved" });
  }
  if (action === "mark-paid" && (po.status === "approved" || po.status === "requested")) {
    const externalRef = (req.body as { externalRef?: string }).externalRef ?? `manual-${Date.now()}`;
    await pool.query(
      "UPDATE qpaynet_payouts SET status='paid', paid_at=NOW(), paid_external_ref=$1, approved_by=$2 WHERE id=$3",
      [externalRef, callerEmail, po.id],
    );
    await pool.query("UPDATE qpaynet_transactions SET status='completed' WHERE id=$1", [po.paid_external_ref]);
    await notify(pool, po.owner_id, "payout_paid", `Выплата отправлена`, externalRef, po.id, BigInt(po.amount));
    return res.json({ ok: true, status: "paid", externalRef });
  }
  if (action === "reject" && po.status === "requested") {
    const reason = (req.body as { reason?: string }).reason ?? "Without reason";
    // Reverse the debit: credit wallet back, mark tx reversed.
    const tiin = BigInt(po.amount);
    const feeBack = feeFor(tiin);
    await pool.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin + feeBack, po.wallet_id]);
    await pool.query("UPDATE qpaynet_transactions SET status='reversed', description = description || ' [reversed]' WHERE id=$1", [po.paid_external_ref]);
    await pool.query("UPDATE qpaynet_payouts SET status='rejected', rejected_reason=$1, approved_by=$2 WHERE id=$3", [reason.slice(0, 200), callerEmail, po.id]);
    await notify(pool, po.owner_id, "payout_rejected", `Payout отклонён: ${reason.slice(0, 100)}`, undefined, po.id, BigInt(po.amount));
    return res.json({ ok: true, status: "rejected" });
  }
  return res.status(400).json({ error: "invalid_state_transition", currentStatus: po.status });
});

// ── In-app notifications ─────────────────────────────────────────────────────

// GET /api/qpaynet/notifications
qpaynetRouter.get("/notifications", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const onlyUnread = req.query.unread === "1";
  const where = onlyUnread ? "owner_id=$1 AND read_at IS NULL" : "owner_id=$1";
  const r = await pool.query(
    `SELECT id, kind, title, body, ref_id, amount, read_at, created_at FROM qpaynet_notifications
     WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
    [ownerId, limit],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json({ notifications: r.rows.map((x: any) => ({ ...x, amount: x.amount ? fromTiin(BigInt(x.amount)) : null })) });
});

// GET /api/qpaynet/notifications/unread-count
qpaynetRouter.get("/notifications/unread-count", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "SELECT COUNT(*) AS n FROM qpaynet_notifications WHERE owner_id=$1 AND read_at IS NULL",
    [auth.sub ?? auth.email ?? "anon"],
  );
  res.json({ unread: Number(r.rows[0]?.n ?? 0) });
});

// POST /api/qpaynet/notifications/:id/read
qpaynetRouter.post("/notifications/:id/read", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_notifications SET read_at=NOW() WHERE id=$1 AND owner_id=$2 AND read_at IS NULL RETURNING id",
    [req.params.id, auth.sub ?? auth.email ?? "anon"],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_already_read" });
  res.json({ ok: true });
});

// POST /api/qpaynet/notifications/read-all
qpaynetRouter.post("/notifications/read-all", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  await pool.query(
    "UPDATE qpaynet_notifications SET read_at=NOW() WHERE owner_id=$1 AND read_at IS NULL",
    [auth.sub ?? auth.email ?? "anon"],
  );
  res.json({ ok: true });
});

// POST /api/qpaynet/webhooks/test — merchant smoke-tests their endpoint before going live.
// No DB persistence; returns the actual delivery result + payload that was sent.
qpaynetRouter.post("/webhooks/test", async (req, res) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { url, secret } = req.body as { url?: string; secret?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "url_must_be_http_or_https" });
  }
  if (!secret || secret.length < 16) {
    return res.status(400).json({ error: "secret_must_be_at_least_16_chars" });
  }

  const payload = {
    event: "payment_request.paid",
    requestId: "test-" + randomUUID().slice(0, 8),
    token: "test-token",
    amount: 100,
    fee: 0.1,
    currency: "KZT",
    description: "AEVION QPayNet webhook test",
    paidBy: "test-wallet",
    paidTxId: "test-tx-" + randomUUID().slice(0, 8),
    paidAt: new Date().toISOString(),
    test: true,
  };

  const result = await fireRequestWebhook(url, secret, payload);
  res.json({
    ok: result.ok,
    deliveryStatus: result.status,
    error: result.error,
    payloadSent: payload,
    hint: result.ok
      ? "Receiver responded 2xx — verification working."
      : `Delivery failed (${result.error}). Check URL reachability, HMAC verification, and response code (must be 2xx).`,
  });
});

// GET /api/qpaynet/health — lightweight liveness check for hub monitor
qpaynetRouter.get("/health", async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query("SELECT COUNT(*) AS n FROM qpaynet_wallets");
    res.json({ status: "ok", service: "qpaynet", wallets: Number(r.rows[0]?.n ?? 0) });
  } catch (err) {
    res.status(503).json({ status: "error", service: "qpaynet", error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Background webhook retry worker ──────────────────────────────────────────
// Runs every 30s. Picks up to 20 due deliveries per tick to avoid hammering DB.
// Idempotent: marks notified_at on success, advances notify_next_retry_at on
// failure with exponential backoff. After MAX_NOTIFY_ATTEMPTS, leaves
// notify_next_retry_at = NULL → row stops being polled (status=exhausted).

const RETRY_INTERVAL_MS = 30_000;
const RETRY_BATCH = 20;
let retryWorkerStarted = false;

async function runRetryTick(): Promise<void> {
  try {
    await ensureTables();
    await ensureRequestsTable();
    const pool = getPool();
    const due = await pool.query(
      `SELECT id, token, amount, description, notify_url, notify_secret,
              notify_attempts, paid_by, paid_tx_id, paid_at
       FROM qpaynet_payment_requests
       WHERE notify_url IS NOT NULL
         AND notified_at IS NULL
         AND notify_next_retry_at IS NOT NULL
         AND notify_next_retry_at <= NOW()
         AND notify_attempts < $1
       ORDER BY notify_next_retry_at ASC
       LIMIT $2`,
      [MAX_NOTIFY_ATTEMPTS, RETRY_BATCH],
    );
    for (const row of due.rows) {
      const payload = await buildPaidPayload(pool, {
        id: row.id, token: row.token, amount: BigInt(row.amount),
        description: row.description, paid_by: row.paid_by,
        paid_tx_id: row.paid_tx_id, paid_at: row.paid_at,
      });
      const result = await fireRequestWebhook(row.notify_url, row.notify_secret, payload);
      const attempts = (row.notify_attempts ?? 0) + 1;
      if (result.ok) {
        await pool.query(
          "UPDATE qpaynet_payment_requests SET notified_at=NOW(), notify_attempts=$1, notify_next_retry_at=NULL, notify_last_error=NULL WHERE id=$2",
          [attempts, row.id],
        );
      } else {
        const next = nextRetryAt(attempts);
        await pool.query(
          "UPDATE qpaynet_payment_requests SET notify_attempts=$1, notify_last_error=$2, notify_next_retry_at=$3 WHERE id=$4",
          [attempts, result.error?.slice(0, 500) ?? "unknown", next, row.id],
        );
      }
    }
  } catch (err) {
    console.warn("[qpaynet retry] tick failed:", err instanceof Error ? err.message : err);
  }
}

export function startQpaynetRetryWorker(): void {
  if (retryWorkerStarted) return;
  retryWorkerStarted = true;
  // Skip in test env unless explicitly enabled.
  if (process.env.NODE_ENV === "test" && process.env.QPAYNET_RETRY_IN_TEST !== "1") return;
  setInterval(() => { void runRetryTick(); }, RETRY_INTERVAL_MS).unref();
  console.log(`[qpaynet] retry worker started (interval ${RETRY_INTERVAL_MS}ms, batch ${RETRY_BATCH})`);
}

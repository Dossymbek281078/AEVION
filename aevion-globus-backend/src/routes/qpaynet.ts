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

import { Router } from "express";
import { randomUUID, createHash, createHmac, randomBytes } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";

export const qpaynetRouter = Router();

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
  `).catch(() => {});
}

// Fire-and-forget HMAC-SHA256 signed webhook for payment_request events.
// Matches AEVION convention: X-Aevion-Signature = sha256(timestamp + "." + JSON), X-Aevion-Timestamp.
async function fireRequestWebhook(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    await fetch(url, {
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
  } catch (err) {
    console.warn("[qpaynet] webhook fire failed:", err instanceof Error ? err.message : err);
  }
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

  // Fire-and-forget HMAC-signed webhook to merchant if notify_url was set.
  if (pr.notify_url && pr.notify_secret) {
    fireRequestWebhook(pr.notify_url, pr.notify_secret, {
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
    }).then(() => pool.query("UPDATE qpaynet_payment_requests SET notified_at=NOW() WHERE id=$1", [pr.id]))
      .catch(() => {});
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

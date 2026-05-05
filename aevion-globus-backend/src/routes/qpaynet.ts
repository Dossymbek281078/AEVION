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
import Stripe from "stripe";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateLimit = require("express-rate-limit") as typeof import("express-rate-limit").default;
import { getPool, getPoolStats } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { captureException } from "../lib/sentry";
import { validateOr400 } from "../lib/qpaynetValidate";
import { encryptSecret, decryptSecret, isEncryptionEnabled, needsEncryption } from "../lib/qpaynetCrypto";

export const qpaynetRouter = Router();

// Rate limits — protect against abuse / DoS. Keyed by IP+auth.sub when present.
const moneyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,                // 30 money-movement calls/min per key
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = verifyBearerOptional(req);
    const id = auth?.sub ?? auth?.email ?? req.ip ?? "anon";
    return `qpn:money:${id}`;
  },
  message: { error: "rate_limit_exceeded" },
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,               // 120 reads/min
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = verifyBearerOptional(req);
    const id = auth?.sub ?? auth?.email ?? req.ip ?? "anon";
    return `qpn:auth:${id}`;
  },
  message: { error: "rate_limit_exceeded" },
});

const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,                // 60 public reads/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded" },
});

// CSV export is heavy (up to 5000 rows); tight per-user limit prevents both
// accidental spam from buggy frontends and intentional DoS by serving a
// large response on every request.
const csvLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,                 // 5 CSV exports/min per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = verifyBearerOptional(req);
    const id = auth?.sub ?? auth?.email ?? req.ip ?? "anon";
    return `qpn:csv:${id}`;
  },
  message: { error: "rate_limit_exceeded", hint: "csv export limited to 5/min" },
});

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

      CREATE TABLE IF NOT EXISTS qpaynet_notif_prefs (
        owner_id              TEXT PRIMARY KEY,
        email_enabled         BOOLEAN NOT NULL DEFAULT true,
        in_app_enabled        BOOLEAN NOT NULL DEFAULT true,
        muted_kinds           TEXT NOT NULL DEFAULT '',  -- comma-sep e.g. "deposit_received,payout_approved"
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    notificationsTableReady = true;
  } catch (err) {
    console.warn("[qpaynet notif] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Returns prefs (with defaults if no row).
async function getNotifPrefs(
  pool: ReturnType<typeof getPool>,
  ownerId: string,
): Promise<{ emailEnabled: boolean; inAppEnabled: boolean; mutedKinds: string[] }> {
  await ensureNotificationsTable();
  const r = await pool.query(
    "SELECT email_enabled, in_app_enabled, muted_kinds FROM qpaynet_notif_prefs WHERE owner_id=$1",
    [ownerId],
  );
  if (!r.rows[0]) return { emailEnabled: true, inAppEnabled: true, mutedKinds: [] };
  return {
    emailEnabled: !!r.rows[0].email_enabled,
    inAppEnabled: !!r.rows[0].in_app_enabled,
    mutedKinds: (r.rows[0].muted_kinds ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
  };
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

// Insert a notification row + fire SMTP email when configured. Fire-and-forget.
// Honors per-user prefs: skips in-app if in_app_enabled=false; skips email if
// email_enabled=false; skips both if kind in muted_kinds.
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
    const prefs = await getNotifPrefs(pool, ownerId);
    if (prefs.mutedKinds.includes(kind)) return; // user muted this event entirely

    if (prefs.inAppEnabled) {
      await pool.query(
        "INSERT INTO qpaynet_notifications (id, owner_id, kind, title, body, ref_id, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [randomUUID(), ownerId, kind, title.slice(0, 200), body?.slice(0, 1000) ?? null, refId ?? null, amountTiin ?? null],
      );
    }
    if (prefs.emailEnabled) {
      void sendNotifEmail(pool, ownerId, kind, title, body ?? "", refId);
    }
  } catch (err) {
    console.warn("[qpaynet notify] failed:", err instanceof Error ? err.message : err);
    captureException(err, { source: "qpaynet/notify", ownerId, kind });
  }
}

// Per-event email subject/CTA — keeps inbox tidy and helps users scan.
const EMAIL_TEMPLATES: Record<string, { subjectPrefix: string; ctaText: string; ctaPath: string }> = {
  payment_received:  { subjectPrefix: "💸 Получен платёж",      ctaText: "Открыть кошелёк",      ctaPath: "/qpaynet" },
  deposit_received:  { subjectPrefix: "💳 Кошелёк пополнен",    ctaText: "Открыть кошелёк",      ctaPath: "/qpaynet" },
  payout_approved:   { subjectPrefix: "✅ Выплата одобрена",     ctaText: "Посмотреть выплаты",   ctaPath: "/qpaynet/payouts" },
  payout_paid:       { subjectPrefix: "🏦 Выплата отправлена",  ctaText: "Посмотреть выплаты",   ctaPath: "/qpaynet/payouts" },
  payout_rejected:   { subjectPrefix: "✗ Выплата отклонена",     ctaText: "Посмотреть выплаты",   ctaPath: "/qpaynet/payouts" },
  kyc_verified:      { subjectPrefix: "🛡 KYC верифицирован",    ctaText: "Открыть QPayNet",     ctaPath: "/qpaynet" },
};

async function sendNotifEmail(
  pool: ReturnType<typeof getPool>,
  ownerId: string,
  kind: string,
  title: string,
  body: string,
  refId?: string,
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return;
  try {
    // ownerId may be a UUID (sub) or an email — handle both.
    let toEmail: string | null = null;
    if (ownerId.includes("@")) {
      toEmail = ownerId;
    } else {
      const u = await pool.query(
        `SELECT "email" FROM "AEVIONUser" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1`,
        [ownerId],
      ).catch(() => null);
      toEmail = u?.rows[0]?.email ?? null;
    }
    if (!toEmail) return;

    // Lazy-load nodemailer to avoid hard dep at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as typeof import("nodemailer");
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user, pass },
    });
    const from = process.env.SMTP_FROM || "AEVION QPayNet <noreply@aevion.io>";
    const tpl = EMAIL_TEMPLATES[kind] ?? { subjectPrefix: "AEVION QPayNet", ctaText: "Открыть QPayNet", ctaPath: "/qpaynet" };
    const subject = `${tpl.subjectPrefix} — ${title}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:13px;font-weight:800;color:#a78bfa;letter-spacing:0.05em;margin-bottom:24px;">AEVION · QPayNet</div>
          <h2 style="margin:0 0 12px;font-size:22px;color:#f8fafc;">${escapeHtml(title)}</h2>
          ${body ? `<p style="margin:0 0 16px;line-height:1.6;color:#cbd5e1;font-size:14px;">${escapeHtml(body)}</p>` : ""}
          <a href="${FRONTEND}${tpl.ctaPath}${refId ? `?ref=${encodeURIComponent(refId)}` : ""}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px;">${tpl.ctaText} →</a>
          <p style="font-size:11px;color:#475569;margin-top:32px;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
            Получаете лишние письма? <a href="${FRONTEND}/qpaynet/notifications/preferences" style="color:#7c3aed;">Настроить уведомления</a>
          </p>
        </div>
      </div>`;
    await transport.sendMail({ from, to: toEmail, subject, html });
  } catch (err) {
    console.warn("[qpaynet email] failed:", err instanceof Error ? err.message : err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
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

// Run fn inside a DB transaction with a dedicated client. Throws on failure;
// caller catches and converts to HTTP error. Caller MUST NOT use `pool` inside
// fn — only the client param — otherwise the work runs outside the transaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withTx<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Append immutable audit row for compliance/forensics. Fire-and-forget, never throws.
async function auditLog(
  pool: ReturnType<typeof getPool>,
  ownerId: string | null,
  action: string,
  details: Record<string, unknown>,
  req?: import("express").Request,
): Promise<void> {
  try {
    await ensureAuditTable();
    const ip = req
      ? (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null
      : null;
    const ua = req ? (req.headers["user-agent"] as string ?? null) : null;
    await pool.query(
      `INSERT INTO qpaynet_audit_log (id, owner_id, action, details, ip, user_agent)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [randomUUID(), ownerId, action, JSON.stringify(details), ip, ua],
    );
  } catch (err) {
    console.warn("[qpaynet audit] failed:", err instanceof Error ? err.message : err);
  }
}

let auditTableReady = false;
async function ensureAuditTable(): Promise<void> {
  if (auditTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_audit_log (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT,
        action      TEXT NOT NULL,
        details     JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip          TEXT,
        user_agent  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpa_owner ON qpaynet_audit_log (owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_qpa_action ON qpaynet_audit_log (action, created_at DESC);
    `);
    auditTableReady = true;
  } catch (err) {
    console.warn("[qpaynet audit] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Idempotency: cache response for 24h keyed by (owner_id, idempotency_key).
// Replays with same key + same body return cached response unchanged.
let idempotencyTableReady = false;
async function ensureIdempotencyTable(): Promise<void> {
  if (idempotencyTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_idempotency (
        owner_id    TEXT NOT NULL,
        key         TEXT NOT NULL,
        body_hash   TEXT NOT NULL,
        status      INTEGER NOT NULL,
        response    JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (owner_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_qpi_created ON qpaynet_idempotency (created_at DESC);
    `);
    idempotencyTableReady = true;
  } catch (err) {
    console.warn("[qpaynet idempotency] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Returns cached response if a same-key+same-body replay; null otherwise.
async function checkIdempotency(
  ownerId: string,
  key: string | undefined,
  body: unknown,
): Promise<{ status: number; response: Record<string, unknown> } | { conflict: true } | null> {
  if (!key) return null;
  await ensureIdempotencyTable();
  const pool = getPool();
  const bodyHash = createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
  const r = await pool.query(
    "SELECT body_hash, status, response FROM qpaynet_idempotency WHERE owner_id=$1 AND key=$2",
    [ownerId, key],
  );
  if (!r.rows[0]) return null;
  if (r.rows[0].body_hash !== bodyHash) return { conflict: true };
  return { status: r.rows[0].status, response: r.rows[0].response };
}

async function saveIdempotency(
  ownerId: string,
  key: string | undefined,
  body: unknown,
  status: number,
  response: Record<string, unknown>,
): Promise<void> {
  if (!key) return;
  await ensureIdempotencyTable();
  const pool = getPool();
  const bodyHash = createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
  await pool.query(
    `INSERT INTO qpaynet_idempotency (owner_id, key, body_hash, status, response)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (owner_id, key) DO NOTHING`,
    [ownerId, key, bodyHash, status, JSON.stringify(response)],
  ).catch(() => {});
}

// Periodic GC of idempotency keys older than 24h (keeps table small).
let idempotencyGcStarted = false;
function startIdempotencyGc(): void {
  if (idempotencyGcStarted) return;
  idempotencyGcStarted = true;
  if (process.env.NODE_ENV === "test") return;
  setInterval(async () => {
    try {
      await ensureIdempotencyTable();
      const pool = getPool();
      await pool.query("DELETE FROM qpaynet_idempotency WHERE created_at < NOW() - INTERVAL '24 hours'");
    } catch { /* ignore */ }
  }, 3_600_000).unref(); // hourly
}

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
qpaynetRouter.get("/wallets/:id/public", publicLimiter, async (req, res) => {
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

qpaynetRouter.post("/deposit", moneyLimiter, async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const parsed = validateOr400(req, res, {
    walletId: "uuid",
    amount: { kind: "money", min: 1, max: DAILY_DEPOSIT_CAP_KZT },
    description: { kind: "string", optional: true, max: 200 },
  });
  if (!parsed) return;
  const walletId = parsed.walletId as string;
  const amount = parsed.amount as number;
  const description = parsed.description as string | undefined;

  const ownerId = auth.sub ?? auth.email ?? "anon";
  const idemKey = req.headers["idempotency-key"] as string | undefined;
  const cached = await checkIdempotency(ownerId, idemKey, req.body);
  if (cached && "conflict" in cached) return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  if (cached) return res.status(cached.status).json(cached.response);

  const pool = getPool();
  try {
    const result = await withTx(async (c) => {
      const w = await c.query(
        "SELECT id, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [walletId, ownerId],
      );
      if (!w.rows[0]) throw new HttpError(404, "wallet_not_found");
      if (w.rows[0].status !== "active") throw new HttpError(400, "wallet_inactive");

      const tiin = toTiin(amount);
      const cap = toTiin(DAILY_DEPOSIT_CAP_KZT);
      const todayR = await c.query(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM qpaynet_transactions
         WHERE wallet_id=$1 AND type='deposit' AND created_at >= NOW() - INTERVAL '24 hours'`,
        [walletId],
      );
      const already = BigInt(todayR.rows[0]?.s ?? 0);
      if (already + tiin > cap) {
        throw new HttpError(400, "daily_deposit_cap_exceeded");
      }
      const txId = randomUUID();
      await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, walletId]);
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description) VALUES ($1,$2,$3,'deposit',$4,$5)",
        [txId, walletId, ownerId, tiin, description ?? "Пополнение"],
      );
      const updated = await c.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [walletId]);
      return { txId, newBalance: fromTiin(BigInt(updated.rows[0].balance)) };
    });
    void auditLog(pool, ownerId, "deposit", { walletId, amount, txId: result.txId }, req);
    const body = { txId: result.txId, amount, newBalance: result.newBalance };
    await saveIdempotency(ownerId, idemKey, req.body, 200, body);
    res.json(body);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/deposit", ownerId, walletId });
    console.error("[qpaynet/deposit] unhandled:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Withdraw ─────────────────────────────────────────────────────────────────

qpaynetRouter.post("/withdraw", moneyLimiter, async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const parsed = validateOr400(req, res, {
    walletId: "uuid",
    amount: { kind: "money", min: 1 },
    description: { kind: "string", optional: true, max: 200 },
  });
  if (!parsed) return;
  const walletId = parsed.walletId as string;
  const amount = parsed.amount as number;
  const description = parsed.description as string | undefined;

  const ownerId = auth.sub ?? auth.email ?? "anon";
  const idemKey = req.headers["idempotency-key"] as string | undefined;
  const cached = await checkIdempotency(ownerId, idemKey, req.body);
  if (cached && "conflict" in cached) return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  if (cached) return res.status(cached.status).json(cached.response);

  const pool = getPool();
  try {
    const result = await withTx(async (c) => {
      const w = await c.query(
        "SELECT id, balance, status FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [walletId, ownerId],
      );
      if (!w.rows[0]) throw new HttpError(404, "wallet_not_found");
      if (w.rows[0].status !== "active") throw new HttpError(400, "wallet_inactive");

      const tiin = toTiin(amount);
      const fee = feeFor(tiin);
      const total = tiin + fee;
      if (BigInt(w.rows[0].balance) < total) throw new HttpError(400, "insufficient_balance");

      const txId = randomUUID();
      await c.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, walletId]);
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description) VALUES ($1,$2,$3,'withdraw',$4,$5,$6)",
        [txId, walletId, ownerId, tiin, fee, description ?? "Вывод"],
      );
      const updated = await c.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [walletId]);
      return { txId, fee: fromTiin(fee), newBalance: fromTiin(BigInt(updated.rows[0].balance)) };
    });
    void auditLog(pool, ownerId, "withdraw", { walletId, amount, txId: result.txId }, req);
    const body = { txId: result.txId, amount, fee: result.fee, newBalance: result.newBalance };
    await saveIdempotency(ownerId, idemKey, req.body, 200, body);
    res.json(body);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/withdraw", ownerId, walletId });
    console.error("[qpaynet/withdraw] unhandled:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Transfer ──────────────────────────────────────────────────────────────────

qpaynetRouter.post("/transfer", moneyLimiter, async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const parsed = validateOr400(req, res, {
    fromWalletId: "uuid",
    toWalletId: "uuid",
    amount: { kind: "money", min: 1, max: MAX_TRANSFER_KZT },
    description: { kind: "string", optional: true, max: 200 },
  });
  if (!parsed) return;
  const fromWalletId = parsed.fromWalletId as string;
  const toWalletId = parsed.toWalletId as string;
  const amount = parsed.amount as number;
  const description = parsed.description as string | undefined;
  if (fromWalletId === toWalletId) {
    return res.status(400).json({ error: "cannot_transfer_to_same_wallet" });
  }

  const ownerId = auth.sub ?? auth.email ?? "anon";

  // Idempotency replay protection.
  const idemKey = req.headers["idempotency-key"] as string | undefined;
  const cached = await checkIdempotency(ownerId, idemKey, req.body);
  if (cached && "conflict" in cached) return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  if (cached) return res.status(cached.status).json(cached.response);

  const pool = getPool();

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

  try {
    const result = await withTx(async (c) => {
      // Lock both wallets in deterministic order to avoid deadlock.
      const [a, b] = [fromWalletId, toWalletId].sort();
      const locked = await c.query(
        "SELECT id, owner_id, balance, status FROM qpaynet_wallets WHERE id=ANY($1) ORDER BY id FOR UPDATE",
        [[a, b]],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = locked.rows.find((r: any) => r.id === fromWalletId && r.owner_id === ownerId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const to = locked.rows.find((r: any) => r.id === toWalletId);
      if (!from) throw new HttpError(404, "from_wallet_not_found");
      if (from.status !== "active") throw new HttpError(400, "from_wallet_inactive");
      if (!to) throw new HttpError(404, "to_wallet_not_found");

      const tiin = toTiin(amount);
      const fee = feeFor(tiin);
      const total = tiin + fee;
      if (BigInt(from.balance) < total) throw new HttpError(400, "insufficient_balance");

      const txOutId = randomUUID();
      const txInId  = randomUUID();
      const desc = description ?? `Перевод → ${toWalletId.slice(0, 8)}`;

      await c.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, fromWalletId]);
      await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, toWalletId]);
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6,$7)",
        [txOutId, fromWalletId, ownerId, tiin, fee, desc, txInId],
      );
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
        [txInId, toWalletId, to.owner_id, tiin, desc, txOutId],
      );

      const updated = await c.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [fromWalletId]);
      return {
        txOutId, txInId, amount,
        fee: fromTiin(fee),
        newBalance: fromTiin(BigInt(updated.rows[0].balance)),
        toOwnerId: to.owner_id,
      };
    });
    void auditLog(pool, ownerId, "transfer", { fromWalletId, toWalletId, amount, txOutId: result.txOutId }, req);
    void notify(pool, result.toOwnerId, "payment_received", `Получено ${amount.toLocaleString("ru-RU")} ₸`, description, result.txInId, toTiin(amount));
    const responseBody = { txOutId: result.txOutId, txInId: result.txInId, amount, fee: result.fee, newBalance: result.newBalance };
    await saveIdempotency(ownerId, idemKey, req.body, 200, responseBody);
    res.json(responseBody);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/transfer", ownerId, fromWalletId, toWalletId });
    console.error("[qpaynet/transfer] unhandled:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "internal_error" });
  }
});

// Tiny error class so withTx callbacks can signal HTTP status.
class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

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

// GET /api/qpaynet/transactions.csv — CSV export (rate-limited 5/min/user)
qpaynetRouter.get("/transactions.csv", csvLimiter, async (req, res) => {
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

  const parsed = validateOr400(req, res, {
    walletId: "uuid",
    name: { kind: "string", optional: true, max: 80 },
  });
  if (!parsed) return;
  const walletId = parsed.walletId as string;
  const name = (parsed.name as string | undefined) ?? "API Key";

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query("SELECT id FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2", [walletId, ownerId]);
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });

  const { raw, hash, prefix } = makeMerchantKey();
  const id = randomUUID();
  await pool.query(
    "INSERT INTO qpaynet_merchant_keys (id, owner_id, name, key_hash, key_prefix, wallet_id) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, ownerId, name, hash, prefix, walletId],
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
qpaynetRouter.post("/merchant/charge", moneyLimiter, async (req, res) => {
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

  const parsed = validateOr400(req, res, {
    customerWalletId: "uuid",
    amount: { kind: "money", min: 1, max: MAX_TRANSFER_KZT },
    description: { kind: "string", optional: true, max: 200 },
  });
  if (!parsed) return;
  const customerWalletId = parsed.customerWalletId as string;
  const amount = parsed.amount as number;
  const description = parsed.description as string | undefined;

  const merchantWalletId = mk.rows[0].wallet_id;
  if (merchantWalletId === customerWalletId) return res.status(400).json({ error: "cannot_charge_own_wallet" });

  const idemKey = req.headers["idempotency-key"] as string | undefined;
  // Idempotency keyed by merchant key id (not user, since this endpoint is key-auth).
  const cached = await checkIdempotency(`mk:${mk.rows[0].id}`, idemKey, req.body);
  if (cached && "conflict" in cached) return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  if (cached) return res.status(cached.status).json(cached.response);

  try {
    const result = await withTx(async (c) => {
      const [a, b] = [customerWalletId, merchantWalletId].sort();
      const locked = await c.query(
        "SELECT id, balance, status FROM qpaynet_wallets WHERE id=ANY($1) ORDER BY id FOR UPDATE",
        [[a, b]],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = locked.rows.find((r: any) => r.id === customerWalletId);
      if (!from) throw new HttpError(404, "customer_wallet_not_found");
      if (from.status !== "active") throw new HttpError(400, "customer_wallet_inactive");

      const tiin = toTiin(amount);
      const fee = feeFor(tiin);
      const total = tiin + fee;
      if (BigInt(from.balance) < total) throw new HttpError(400, "insufficient_balance");

      const txOutId = randomUUID();
      const txInId  = randomUUID();
      const desc = description ?? "Merchant charge";

      await c.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, customerWalletId]);
      await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, merchantWalletId]);
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, merchant_id) VALUES ($1,$2,$3,'merchant_charge',$4,$5,$6,$7)",
        [txOutId, customerWalletId, mk.rows[0].owner_id, tiin, fee, desc, mk.rows[0].id],
      );
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, merchant_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
        [txInId, merchantWalletId, mk.rows[0].owner_id, tiin, desc, mk.rows[0].id],
      );
      return { txOutId, fee: fromTiin(fee) };
    });
    void auditLog(pool, mk.rows[0].owner_id, "merchant_charge", { merchantKeyId: mk.rows[0].id, customerWalletId, amount, txId: result.txOutId }, req);
    const body = { ok: true, txId: result.txOutId, amount, fee: result.fee };
    await saveIdempotency(`mk:${mk.rows[0].id}`, idemKey, req.body, 200, body);
    res.json(body);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/merchant/charge", merchantKeyId: mk.rows[0]?.id });
    console.error("[qpaynet/merchant/charge] unhandled:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "internal_error" });
  }
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

  const parsed = validateOr400(req, res, {
    fullName: { kind: "string", min: 5, max: 200 },
    iin: { kind: "string", pattern: /^\d{12}$/ },
    address: { kind: "string", optional: true, max: 500 },
  });
  if (!parsed) return;
  const fullName = (parsed.fullName as string).trim();
  const iin = parsed.iin as string;
  const address = (parsed.address as string | undefined)?.trim() ?? null;

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
    [ownerId, status, fullName, iin, address, KYC_AUTO_VERIFY ? new Date() : null],
  );
  if (status === "verified") {
    void notify(pool, ownerId, "kyc_verified", "KYC верифицирован", "Месячный лимит снят. Все суммы доступны.");
  }
  res.json({ ok: true, status, autoVerified: KYC_AUTO_VERIFY });
});

// POST /api/qpaynet/admin/kyc/:ownerId/verify — admin manually verifies KYC
qpaynetRouter.post("/admin/kyc/:ownerId/verify", async (req, res) => {
  await ensureKycTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_kyc SET status='verified', verified_at=NOW(), rejected_at=NULL, rejected_reason=NULL WHERE owner_id=$1 AND status='pending' RETURNING owner_id",
    [req.params.ownerId],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_not_pending" });
  void notify(pool, req.params.ownerId, "kyc_verified", "KYC верифицирован", "Месячный лимит снят. Все суммы доступны.");
  res.json({ ok: true });
});

// POST /api/qpaynet/admin/kyc/:ownerId/reject — admin rejects KYC
qpaynetRouter.post("/admin/kyc/:ownerId/reject", async (req, res) => {
  await ensureKycTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const reason = (req.body as { reason?: string }).reason ?? "";
  if (!reason.trim()) return res.status(400).json({ error: "reason_required" });

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_kyc SET status='rejected', rejected_at=NOW(), rejected_reason=$1 WHERE owner_id=$2 AND status='pending' RETURNING owner_id",
    [reason.trim().slice(0, 500), req.params.ownerId],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_not_pending" });
  res.json({ ok: true });
});

// GET /api/qpaynet/admin/kyc — admin lists pending KYC submissions
qpaynetRouter.get("/admin/kyc", async (req, res) => {
  await ensureKycTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  const status = req.query.status as string | undefined;
  const params: unknown[] = [];
  let where = "1=1";
  if (status) { params.push(status); where = `status=$${params.length}`; }
  const r = await pool.query(
    `SELECT owner_id, status, full_name, iin, address, submitted_at, verified_at, rejected_at, rejected_reason
     FROM qpaynet_kyc WHERE ${where}
     ORDER BY (status='pending') DESC, submitted_at DESC LIMIT 200`,
    params,
  );
  res.json({ submissions: r.rows });
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

  const parsed = validateOr400(req, res, {
    url: "url",
    events: { kind: "string", optional: true, max: 500 },
  });
  if (!parsed) return;
  const url = parsed.url as string;
  const events = (parsed.events as string | undefined) ?? "payment_request.paid";

  const pool = getPool();
  const id = randomUUID();
  const secret = randomBytes(24).toString("base64url");
  const ownerId = auth.sub ?? auth.email ?? "anon";

  await pool.query(
    "INSERT INTO qpaynet_merchant_webhooks (id, owner_id, url, secret, events) VALUES ($1,$2,$3,$4,$5)",
    [id, ownerId, url, encryptSecret(secret), events.slice(0, 200)],
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

// Durable delivery queue for merchant_webhooks fan-out.
// Without this, fanOutToOwner was Promise.all'ing fire-and-forget and any
// failed delivery was silently lost — a real prod bug for partners that
// rely on event consistency.
let deliveriesTableReady = false;
async function ensureDeliveriesTable(): Promise<void> {
  if (deliveriesTableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qpaynet_webhook_deliveries (
        id              TEXT PRIMARY KEY,
        sub_id          TEXT NOT NULL,
        owner_id        TEXT NOT NULL,
        event           TEXT NOT NULL,
        payload         JSONB NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        next_retry_at   TIMESTAMPTZ,
        delivered_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qpwd_due ON qpaynet_webhook_deliveries (next_retry_at)
        WHERE delivered_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_qpwd_owner ON qpaynet_webhook_deliveries (owner_id, created_at DESC);
    `);
    deliveriesTableReady = true;
  } catch (err) {
    console.warn("[qpaynet deliveries] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// Fan out an event to all active merchant webhooks for an owner.
//
// Strategy: persist one row per matching sub, fire the first attempt inline
// for low latency, then on failure leave the row for the retry tick to pick
// up. This is the same pattern as payment_request notifications — a single
// retry worker drains both queues.
async function fanOutToOwner(
  pool: ReturnType<typeof getPool>,
  ownerId: string,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureMerchantWebhooksTable();
    await ensureDeliveriesTable();
    const r = await pool.query(
      "SELECT id, url, secret, events FROM qpaynet_merchant_webhooks WHERE owner_id=$1 AND revoked_at IS NULL",
      [ownerId],
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subs = r.rows.filter((s: any) => (s.events as string).split(",").map(e => e.trim()).includes(eventName));
    if (subs.length === 0) return;

    const payloadJson = JSON.stringify(payload);
    await Promise.all(subs.map(async (s: { id: string; url: string; secret: string }) => {
      const deliveryId = randomUUID();
      // Insert as pending. If the inline attempt succeeds we'll flip
      // delivered_at; on failure the retry tick takes over.
      await pool.query(
        `INSERT INTO qpaynet_webhook_deliveries
           (id, sub_id, owner_id, event, payload, attempts, next_retry_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,0,NOW())`,
        [deliveryId, s.id, ownerId, eventName, payloadJson],
      );
      const decryptedSecret = decryptSecret(s.secret) ?? "";
      if (needsEncryption(s.secret)) {
        pool.query(
          "UPDATE qpaynet_merchant_webhooks SET secret=$1 WHERE id=$2",
          [encryptSecret(decryptedSecret), s.id],
        ).catch(() => { /* best-effort */ });
      }
      const result = await fireRequestWebhook(s.url, decryptedSecret, payload);
      if (result.ok) {
        await pool.query(
          "UPDATE qpaynet_webhook_deliveries SET attempts=1, delivered_at=NOW(), next_retry_at=NULL WHERE id=$1",
          [deliveryId],
        );
      } else {
        const next = nextRetryAt(1);
        await pool.query(
          "UPDATE qpaynet_webhook_deliveries SET attempts=1, last_error=$1, next_retry_at=$2 WHERE id=$3",
          [result.error?.slice(0, 500) ?? "unknown", next, deliveryId],
        );
      }
    }));
  } catch (err) {
    console.warn("[qpaynet fanout] failed:", err instanceof Error ? err.message : err);
    captureException(err, { source: "qpaynet/fanout", ownerId, eventName });
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
    -- Encrypted-at-rest: notify_secret stays as the actual signing key (we MUST
    -- have it at fire time to compute HMAC). For storage hardening, prefer
    -- column-level encryption via pgcrypto when available; fallback unchanged.
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

  const parsed = validateOr400(req, res, {
    toWalletId: "uuid",
    amount: { kind: "money", min: 1, max: MAX_TRANSFER_KZT },
    description: { kind: "string", min: 1, max: 200 },
    note: { kind: "string", optional: true, max: 500 },
    expiresAt: { kind: "string", optional: true, max: 40 },
    notifyUrl: { kind: "url", optional: true },
  });
  if (!parsed) return;
  const toWalletId = parsed.toWalletId as string;
  const amount = parsed.amount as number;
  const description = (parsed.description as string).trim();
  const note = parsed.note as string | undefined;
  const expiresAt = parsed.expiresAt as string | undefined;
  const notifyUrl = parsed.notifyUrl as string | undefined;

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const w = await pool.query("SELECT id FROM qpaynet_wallets WHERE id=$1 AND owner_id=$2", [toWalletId, ownerId]);
  if (!w.rows[0]) return res.status(404).json({ error: "wallet_not_found" });

  const id = randomUUID();
  const token = randomBytes(16).toString("base64url");
  const tiin = toTiin(amount);
  // Auto-mint a per-request webhook secret so partners can verify HMAC.
  // We RETURN it to the merchant once (plaintext); we STORE it encrypted
  // when QPAYNET_ENCRYPTION_KEY is set. fireRequestWebhook decrypts at
  // signing time. If env-key is unset, encryptSecret is a no-op (back-compat).
  const notifySecret = notifyUrl ? randomBytes(24).toString("base64url") : null;
  const notifySecretStored = encryptSecret(notifySecret);

  await pool.query(
    `INSERT INTO qpaynet_payment_requests
       (id, owner_id, to_wallet_id, token, amount, description, note, expires_at, notify_url, notify_secret)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, ownerId, toWalletId, token, tiin, description, note?.trim() ?? null, expiresAt ?? null, notifyUrl ?? null, notifySecretStored],
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
qpaynetRouter.get("/requests/:token", publicLimiter, async (req, res) => {
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
qpaynetRouter.post("/requests/:token/pay", moneyLimiter, async (req, res) => {
  await ensureTables();
  await ensureRequestsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const parsed = validateOr400(req, res, { fromWalletId: "uuid" });
  if (!parsed) return;
  const fromWalletId = parsed.fromWalletId as string;

  const ownerId = auth.sub ?? auth.email ?? "anon";
  const idemKey = req.headers["idempotency-key"] as string | undefined;
  const cached = await checkIdempotency(ownerId, idemKey, req.body);
  if (cached && "conflict" in cached) return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  if (cached) return res.status(cached.status).json(cached.response);

  const pool = getPool();

  let txOutId: string;
  let txInId: string;
  let tiin: bigint;
  let fee: bigint;
  let pr: { id: string; description: string; notify_url: string | null; notify_secret: string | null; to_wallet_id: string; recipientOwnerId: string };
  let newBalance: number;

  try {
    const result = await withTx(async (c) => {
      // Lock the payment-request row to prevent double-pay race.
      const reqRow = await c.query(
        "SELECT id, to_wallet_id, amount, description, status, expires_at, notify_url, notify_secret FROM qpaynet_payment_requests WHERE token=$1 FOR UPDATE",
        [req.params.token],
      );
      const r = reqRow.rows[0];
      if (!r) throw new HttpError(404, "request_not_found");
      if (r.status !== "pending") throw new HttpError(400, `request_${r.status}`);
      if (r.expires_at && new Date(r.expires_at) < new Date()) throw new HttpError(400, "request_expired");
      if (r.to_wallet_id === fromWalletId) throw new HttpError(400, "cannot_pay_own_request");

      // Lock both wallets in deterministic order.
      const [a, b] = [fromWalletId, r.to_wallet_id].sort();
      const locked = await c.query(
        "SELECT id, owner_id, balance, status FROM qpaynet_wallets WHERE id=ANY($1) ORDER BY id FOR UPDATE",
        [[a, b]],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = locked.rows.find((x: any) => x.id === fromWalletId && x.owner_id === ownerId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const to = locked.rows.find((x: any) => x.id === r.to_wallet_id);
      if (!from) throw new HttpError(404, "from_wallet_not_found");
      if (from.status !== "active") throw new HttpError(400, "wallet_inactive");
      if (!to) throw new HttpError(404, "to_wallet_not_found");

      const tiinL = BigInt(r.amount);
      const feeL = feeFor(tiinL);
      const total = tiinL + feeL;
      if (BigInt(from.balance) < total) throw new HttpError(400, "insufficient_balance");

      const txOut = randomUUID();
      const txIn  = randomUUID();
      const desc = `Оплата запроса: ${r.description}`;

      await c.query("UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2", [total, fromWalletId]);
      await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiinL, r.to_wallet_id]);
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, fee, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_out',$4,$5,$6,$7)",
        [txOut, fromWalletId, ownerId, tiinL, feeL, desc, txIn],
      );
      await c.query(
        "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, ref_tx_id) VALUES ($1,$2,$3,'transfer_in',$4,$5,$6)",
        [txIn, r.to_wallet_id, to.owner_id, tiinL, desc, txOut],
      );
      await c.query(
        "UPDATE qpaynet_payment_requests SET status='paid', paid_by=$1, paid_tx_id=$2, paid_at=NOW() WHERE id=$3",
        [fromWalletId, txOut, r.id],
      );
      const upd = await c.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [fromWalletId]);
      return {
        txOutId: txOut, txInId: txIn,
        tiin: tiinL, fee: feeL,
        pr: { id: r.id, description: r.description, notify_url: r.notify_url, notify_secret: r.notify_secret, to_wallet_id: r.to_wallet_id, recipientOwnerId: to.owner_id },
        newBalance: fromTiin(BigInt(upd.rows[0].balance)),
      };
    });
    ({ txOutId, txInId, tiin, fee, pr, newBalance } = result);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/requests/pay", ownerId, token: req.params.token });
    console.error("[qpaynet/requests/pay] unhandled:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_error" });
  }

  void auditLog(pool, ownerId, "request_pay", { requestId: pr.id, fromWalletId, toWalletId: pr.to_wallet_id, txOutId }, req);

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
  if (pr.recipientOwnerId) {
    void fanOutToOwner(pool, pr.recipientOwnerId, "payment_request.paid", payload);
    void notify(
      pool, pr.recipientOwnerId, "payment_received",
      `Получено ${fromTiin(tiin).toLocaleString("ru-RU")} ₸`,
      pr.description, pr.id, tiin,
    );
  }
  if (pr.notify_url && pr.notify_secret) {
    const decryptedSecret = decryptSecret(pr.notify_secret) ?? "";
    // Lazy at-rest migration: if env-key was just enabled and this row is
    // still plaintext, encrypt it now. Best-effort; failure doesn't block delivery.
    if (needsEncryption(pr.notify_secret)) {
      pool.query(
        "UPDATE qpaynet_payment_requests SET notify_secret=$1 WHERE id=$2",
        [encryptSecret(decryptedSecret), pr.id],
      ).catch(() => { /* migration is fire-and-forget */ });
    }
    fireRequestWebhook(pr.notify_url, decryptedSecret, payload).then(async (result) => {
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

  const responseBody = { ok: true, txId: txOutId, txInId, amount: fromTiin(tiin), fee: fromTiin(fee), newBalance };
  await saveIdempotency(ownerId, idemKey, req.body, 200, responseBody);
  res.json(responseBody);
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

  const parsed = validateOr400(req, res, {
    walletId: "uuid",
    amount: { kind: "money", min: 100, max: DAILY_DEPOSIT_CAP_KZT },
  });
  if (!parsed) return;
  const walletId = parsed.walletId as string;
  const amount = parsed.amount as number;

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

  const parsed = validateOr400(req, res, { id: "uuid" });
  if (!parsed) return;
  const id = parsed.id as string;

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

// POST /api/qpaynet/deposit/webhook — Stripe webhook (raw body via verify hook)
qpaynetRouter.post("/deposit/webhook", async (req, res) => {
  if (!stripe || !STRIPE_WH) return res.status(503).json({ error: "stripe_or_webhook_secret_missing" });
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) return res.status(400).json({ error: "missing_signature" });
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) return res.status(500).json({ error: "raw_body_unavailable" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: { object: any }; [k: string]: unknown };
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WH) as typeof event;
  } catch (err) {
    // Sentry: signature failure = either misconfiguration OR active spoof attempt.
    // Either way we want to know about it.
    captureException(err, { source: "qpaynet/stripe-webhook", phase: "verifySignature" });
    return res.status(400).json({ error: "signature_verification_failed", detail: err instanceof Error ? err.message : String(err) });
  }

  if (event.type === "checkout.session.completed") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = event.data.object as any;
    const checkoutId = session.metadata?.qpaynet_checkout_id ?? session.client_reference_id;
    if (checkoutId) {
      await ensureDepositCheckoutsTable();
      const pool = getPool();
      // Atomic: lock the row, check status — protects against Stripe retry +
      // any other concurrent webhook delivery from double-crediting.
      try {
        await withTx(async (c) => {
          const r = await c.query(
            "SELECT id, owner_id, wallet_id, amount, status FROM qpaynet_deposit_checkouts WHERE id=$1 FOR UPDATE",
            [checkoutId],
          );
          if (!r.rows[0] || r.rows[0].status !== "open") return; // already credited or not found
          const txId = randomUUID();
          await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [BigInt(r.rows[0].amount), r.rows[0].wallet_id]);
          await c.query(
            "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description) VALUES ($1,$2,$3,'deposit',$4,$5)",
            [txId, r.rows[0].wallet_id, r.rows[0].owner_id, BigInt(r.rows[0].amount), "Пополнение карты (Stripe)"],
          );
          await c.query(
            "UPDATE qpaynet_deposit_checkouts SET status='paid', tx_id=$1, completed_at=NOW() WHERE id=$2",
            [txId, r.rows[0].id],
          );
          // notify outside the txn (best-effort)
          void notify(pool, r.rows[0].owner_id, "deposit_received", `Пополнено ${fromTiin(BigInt(r.rows[0].amount)).toLocaleString("ru-RU")} ₸`, "Stripe", txId, BigInt(r.rows[0].amount));
          void auditLog(pool, r.rows[0].owner_id, "stripe_deposit_credited", { checkoutId, txId, eventId: event.id });
        });
      } catch (err) {
        console.error("[qpaynet stripe webhook]", err instanceof Error ? err.message : err);
        captureException(err, { source: "qpaynet/stripe-webhook", phase: "credit", checkoutId, eventId: event.id });
      }
    }
  }
  res.json({ received: true });
});

// Atomic credit: locks deposit_checkout row, checks status, updates wallet+tx
// in single transaction. Idempotent: if status already paid, does nothing.
async function creditDeposit(
  pool: ReturnType<typeof getPool>,
  checkoutId: string,
  walletId: string,
  ownerId: string,
  tiin: bigint,
  description: string,
): Promise<void> {
  let txId: string | null = null;
  await withTx(async (c) => {
    const r = await c.query(
      "SELECT status FROM qpaynet_deposit_checkouts WHERE id=$1 FOR UPDATE",
      [checkoutId],
    );
    if (!r.rows[0] || r.rows[0].status !== "open") return; // dedupe
    const newTxId = randomUUID();
    await c.query("UPDATE qpaynet_wallets SET balance = balance + $1 WHERE id=$2", [tiin, walletId]);
    await c.query(
      "INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description) VALUES ($1,$2,$3,'deposit',$4,$5)",
      [newTxId, walletId, ownerId, tiin, description],
    );
    await c.query(
      "UPDATE qpaynet_deposit_checkouts SET status='paid', tx_id=$1, completed_at=NOW() WHERE id=$2",
      [newTxId, checkoutId],
    );
    txId = newTxId;
  });
  if (txId) {
    void notify(pool, ownerId, "deposit_received", `Пополнено ${fromTiin(tiin).toLocaleString("ru-RU")} ₸`, description, txId, tiin);
    void auditLog(pool, ownerId, "deposit_credited", { checkoutId, txId, source: description });
  }
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
qpaynetRouter.post("/payouts", moneyLimiter, async (req, res) => {
  await ensureTables();
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const parsed = validateOr400(req, res, {
    walletId: "uuid",
    amount: { kind: "money", min: 1, max: MAX_TRANSFER_KZT },
    method: { kind: "enum", values: ["card", "bank_transfer", "kaspi"] as const },
    destination: { kind: "string", min: 4, max: 200 },
  });
  if (!parsed) return;
  const walletId = parsed.walletId as string;
  const amount = parsed.amount as number;
  const method = parsed.method as string;
  const destination = parsed.destination as string;

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

function isAdmin(email: string | undefined): boolean {
  const adminEmails = (process.env.QPAYNET_ADMIN_EMAILS ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length === 0) return true; // open in dev when env unset
  return adminEmails.includes((email ?? "").toLowerCase());
}

// GET /api/qpaynet/admin/payouts — admin lists all payouts
qpaynetRouter.get("/admin/payouts", async (req, res) => {
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  const status = req.query.status as string | undefined;
  const params: unknown[] = [];
  let where = "1=1";
  if (status) { params.push(status); where = `status=$${params.length}`; }
  const r = await pool.query(
    `SELECT id, owner_id, wallet_id, amount, currency, method, destination, status,
            rejected_reason, approved_by, paid_external_ref,
            created_at, approved_at, paid_at
     FROM qpaynet_payouts WHERE ${where}
     ORDER BY (status='requested') DESC, created_at DESC LIMIT 200`,
    params,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json({ payouts: r.rows.map((x: any) => ({ ...x, amount: fromTiin(BigInt(x.amount)) })) });
});

// GET /api/qpaynet/admin/reconcile — money-supply reconciliation.
// Sums all wallet balances and compares against the immutable transaction
// ledger. ANY drift = bug or hand-written SQL = page on it. Wire as cron
// (every 15min). Returns 200 always; consumer reads `drift_tiin` field.
//
// expected = sum(deposits) - sum(withdraw + withdraw_fee) - sum(transfer_out_fees)
//          - sum(merchant_charge_fees) - sum(refunds)
qpaynetRouter.get("/admin/reconcile", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(balance)::bigint, 0) FROM qpaynet_wallets) AS actual,
        (SELECT COALESCE(SUM(amount)::bigint, 0) FROM qpaynet_transactions WHERE type='deposit') AS deposits,
        (SELECT COALESCE(SUM(amount + COALESCE(fee,0))::bigint, 0) FROM qpaynet_transactions WHERE type='withdraw') AS withdraw_total,
        (SELECT COALESCE(SUM(fee)::bigint, 0) FROM qpaynet_transactions WHERE type='transfer_out') AS transfer_fees,
        (SELECT COALESCE(SUM(fee)::bigint, 0) FROM qpaynet_transactions WHERE type='merchant_charge') AS merchant_fees,
        (SELECT COALESCE(SUM(amount)::bigint, 0) FROM qpaynet_transactions WHERE type='refund') AS refunds,
        (SELECT COUNT(*)::int FROM qpaynet_wallets WHERE balance < 0) AS negative_wallets
    `);
    const row = r.rows[0];
    const actual = BigInt(row.actual);
    const expected = BigInt(row.deposits)
      - BigInt(row.withdraw_total)
      - BigInt(row.transfer_fees)
      - BigInt(row.merchant_fees)
      - BigInt(row.refunds);
    const drift = actual - expected;
    res.json({
      ok: drift === 0n && row.negative_wallets === 0,
      checked_at: new Date().toISOString(),
      actual_tiin: actual.toString(),
      expected_tiin: expected.toString(),
      drift_tiin: drift.toString(),
      drift_kzt: Number(drift) / 100,
      negative_wallet_count: row.negative_wallets,
      breakdown: {
        deposits_tiin: row.deposits,
        withdraw_total_tiin: row.withdraw_total,
        transfer_fees_tiin: row.transfer_fees,
        merchant_fees_tiin: row.merchant_fees,
        refunds_tiin: row.refunds,
      },
    });
    if (drift !== 0n || row.negative_wallets > 0) {
      // Always log + Sentry on drift — operations should see this without
      // having to poll the endpoint.
      console.error(`[qpaynet/reconcile] DRIFT detected: ${drift} tiin, ${row.negative_wallets} negative wallets`);
      captureException(new Error(`qpaynet reconcile drift=${drift}t neg=${row.negative_wallets}`), {
        source: "qpaynet/reconcile", drift: drift.toString(), neg: row.negative_wallets,
      });
    }
  } catch (err) {
    captureException(err, { source: "qpaynet/reconcile", phase: "query" });
    res.status(500).json({ error: "reconcile_failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ── Wallet freeze / unfreeze (admin) ─────────────────────────────────────────
// Admin freeze flips wallet.status='frozen'. Existing checks
// `if (status !== 'active')` in deposit/withdraw/transfer/checkout/payouts
// block all money movement on a frozen wallet without further code changes.
//
// Use cases: fraud investigation, chargeback reversal pending, KYC dispute,
// court order, user-requested security hold.

qpaynetRouter.post("/admin/wallets/:id/freeze", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const parsed = validateOr400(req, res, {
    reason: { kind: "string", min: 5, max: 500 },
  });
  if (!parsed) return;
  const reason = parsed.reason as string;

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_wallets SET status='frozen' WHERE id=$1 AND status='active' RETURNING id, owner_id",
    [req.params.id],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "wallet_not_found_or_not_active" });
  void auditLog(pool, r.rows[0].owner_id, "wallet_frozen",
    { walletId: r.rows[0].id, by: auth.email, reason }, req);
  void notify(pool, r.rows[0].owner_id, "wallet_frozen",
    "Кошелёк заморожен", `Причина: ${reason}. Свяжитесь с поддержкой.`, r.rows[0].id);
  res.json({ ok: true, walletId: r.rows[0].id, status: "frozen" });
});

qpaynetRouter.post("/admin/wallets/:id/unfreeze", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const parsed = validateOr400(req, res, {
    reason: { kind: "string", min: 5, max: 500 },
  });
  if (!parsed) return;
  const reason = parsed.reason as string;

  const pool = getPool();
  const r = await pool.query(
    "UPDATE qpaynet_wallets SET status='active' WHERE id=$1 AND status='frozen' RETURNING id, owner_id",
    [req.params.id],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "wallet_not_found_or_not_frozen" });
  void auditLog(pool, r.rows[0].owner_id, "wallet_unfrozen",
    { walletId: r.rows[0].id, by: auth.email, reason }, req);
  void notify(pool, r.rows[0].owner_id, "wallet_unfrozen",
    "Кошелёк разморожен", "Все операции снова доступны.", r.rows[0].id);
  res.json({ ok: true, walletId: r.rows[0].id, status: "active" });
});

// ── Refund (admin) ───────────────────────────────────────────────────────────
// Reverse a deposit / transfer_in / merchant_charge that was credited in
// error / chargeback / fraud. Always creates a NEW transaction (type='refund')
// — never deletes the original — so the audit trail stays intact and
// reconciliation accounts for it.
//
// Idempotent: a refund references the original via ref_tx_id; double-call
// returns 409 tx_already_refunded.

qpaynetRouter.post("/admin/refund", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const parsed = validateOr400(req, res, {
    txId: "uuid",
    reason: { kind: "string", min: 5, max: 500 },
    amount: { kind: "money", optional: true, min: 1 },
  });
  if (!parsed) return;
  const txId = parsed.txId as string;
  const reason = parsed.reason as string;
  const requestedAmount = parsed.amount as number | undefined;

  // Idempotency-Key support: keyed by `refund:<adminEmail>` namespace so two
  // different admins can't collide. Replay with same body returns cached
  // 200; replay with different body returns 409 idempotency_key_body_mismatch.
  // (The stricter ref_tx_id check below still prevents double-refunds even
  // without idempotency keys; this layer just lets retrying frontends not
  // surprise admins with a 409.)
  const adminScope = `refund:${auth.email ?? auth.sub ?? "anon"}`;
  const idemKey = req.headers["idempotency-key"] as string | undefined;
  const cached = await checkIdempotency(adminScope, idemKey, req.body);
  if (cached && "conflict" in cached) {
    return res.status(409).json({ error: "idempotency_key_body_mismatch" });
  }
  if (cached) return res.status(cached.status).json(cached.response);

  const pool = getPool();
  try {
    const result = await withTx(async (c) => {
      const tx = await c.query(
        "SELECT id, wallet_id, owner_id, type, amount FROM qpaynet_transactions WHERE id=$1 FOR UPDATE",
        [txId],
      );
      if (!tx.rows[0]) throw new HttpError(404, "tx_not_found");
      const orig = tx.rows[0];
      if (!["deposit", "transfer_in", "merchant_charge"].includes(orig.type)) {
        throw new HttpError(400, "tx_type_not_refundable");
      }
      const existing = await c.query(
        "SELECT id FROM qpaynet_transactions WHERE ref_tx_id=$1 AND type='refund'",
        [txId],
      );
      if (existing.rows[0]) throw new HttpError(409, "tx_already_refunded");

      const origAmount = BigInt(orig.amount);
      const refundTiin = requestedAmount ? toTiin(requestedAmount) : origAmount;
      if (refundTiin <= 0n) throw new HttpError(400, "refund_amount_must_be_positive");
      if (refundTiin > origAmount) throw new HttpError(400, "refund_exceeds_original");

      const w = await c.query(
        "SELECT id, balance FROM qpaynet_wallets WHERE id=$1 FOR UPDATE",
        [orig.wallet_id],
      );
      if (!w.rows[0]) throw new HttpError(404, "wallet_not_found");
      // Refund may push wallet negative on chargeback — we allow it (legal claim
      // sits on the user, not the platform). reconcile.negative_wallet_count
      // surfaces this in monitoring.

      const refundId = randomUUID();
      await c.query(
        "UPDATE qpaynet_wallets SET balance = balance - $1 WHERE id=$2",
        [refundTiin, orig.wallet_id],
      );
      await c.query(
        `INSERT INTO qpaynet_transactions (id, wallet_id, owner_id, type, amount, description, ref_tx_id)
         VALUES ($1,$2,$3,'refund',$4,$5,$6)`,
        [refundId, orig.wallet_id, orig.owner_id, refundTiin, `Возврат: ${reason}`, txId],
      );
      const updated = await c.query("SELECT balance FROM qpaynet_wallets WHERE id=$1", [orig.wallet_id]);
      return {
        refundId,
        ownerId: orig.owner_id,
        walletId: orig.wallet_id,
        refundedKzt: fromTiin(refundTiin),
        newBalance: fromTiin(BigInt(updated.rows[0].balance)),
      };
    });
    void auditLog(pool, result.ownerId, "refund_issued",
      { refundId: result.refundId, originalTxId: txId, amountKzt: result.refundedKzt, reason, by: auth.email }, req);
    void notify(pool, result.ownerId, "refund_issued",
      `Возврат ${result.refundedKzt.toLocaleString("ru-RU")} ₸`, reason, result.refundId);
    const responseBody = { ok: true as const, ...result };
    await saveIdempotency(adminScope, idemKey, req.body, 200, responseBody);
    res.json(responseBody);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    captureException(err, { route: "qpaynet/admin/refund", txId });
    console.error("[qpaynet/admin/refund] unhandled:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/qpaynet/admin/webhook-deliveries — operational view for ops
// to triage failing or pending merchant webhook deliveries. ?status=stuck
// returns rows that exhausted retries (attempts >= MAX, no delivered_at).
qpaynetRouter.get("/admin/webhook-deliveries", async (req, res) => {
  await ensureDeliveriesTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const status = (req.query.status as string | undefined)?.trim();
  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));

  let where = "1=1";
  if (status === "stuck") where = `delivered_at IS NULL AND attempts >= ${MAX_NOTIFY_ATTEMPTS}`;
  else if (status === "pending") where = "delivered_at IS NULL AND next_retry_at IS NOT NULL";
  else if (status === "delivered") where = "delivered_at IS NOT NULL";

  const pool = getPool();
  const r = await pool.query(
    `SELECT id, sub_id, owner_id, event, attempts, last_error, next_retry_at, delivered_at, created_at
     FROM qpaynet_webhook_deliveries
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  res.json({ items: r.rows });
});

// POST /api/qpaynet/admin/webhook-deliveries/:id/retry — admin force-retry a delivery
// (resets attempts to 0 + schedules immediate). For ops bringing a flaky
// integration back online without writing SQL.
qpaynetRouter.post("/admin/webhook-deliveries/:id/retry", async (req, res) => {
  await ensureDeliveriesTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  const r = await pool.query(
    `UPDATE qpaynet_webhook_deliveries
     SET attempts=0, next_retry_at=NOW(), last_error=NULL, delivered_at=NULL
     WHERE id=$1 RETURNING id, sub_id`,
    [req.params.id],
  );
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "delivery_not_found" });
  void auditLog(pool, null, "webhook_delivery_force_retry",
    { deliveryId: r.rows[0].id, subId: r.rows[0].sub_id, by: auth.email }, req);
  res.json({ ok: true, deliveryId: r.rows[0].id });
});

// GET /api/qpaynet/admin/refunds — paginated refund history for compliance review.
// Cursor-based: pass `before=<created_at-iso>` to page deeper.
qpaynetRouter.get("/admin/refunds", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
  const before = (req.query.before as string | undefined)?.trim();
  const params: unknown[] = [limit];
  let where = "type = 'refund'";
  if (before) {
    params.push(before);
    where += ` AND created_at < $${params.length}`;
  }
  const pool = getPool();
  const r = await pool.query(
    `SELECT t.id, t.wallet_id, t.owner_id, t.amount, t.description, t.ref_tx_id, t.created_at,
            o.amount AS original_amount, o.type AS original_type, o.created_at AS original_created_at
     FROM qpaynet_transactions t
     LEFT JOIN qpaynet_transactions o ON o.id = t.ref_tx_id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT $1`,
    params,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = r.rows.map((row: any) => ({
    refundId: row.id,
    walletId: row.wallet_id,
    ownerId: row.owner_id,
    amountKzt: fromTiin(BigInt(row.amount)),
    description: row.description,
    originalTxId: row.ref_tx_id,
    originalAmountKzt: row.original_amount ? fromTiin(BigInt(row.original_amount)) : null,
    originalType: row.original_type,
    originalCreatedAt: row.original_created_at ? new Date(row.original_created_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;
  res.json({ items, nextCursor });
});

// GET /api/qpaynet/admin/payouts/stats — counts by status (for badges)
qpaynetRouter.get("/admin/payouts/stats", async (req, res) => {
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });
  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });

  const pool = getPool();
  const r = await pool.query(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(amount),0) AS total
     FROM qpaynet_payouts GROUP BY status`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, { count: number; totalKzt: number }> = {};
  for (const row of r.rows) {
    out[row.status] = { count: Number(row.n), totalKzt: fromTiin(BigInt(row.total)) };
  }
  res.json({ stats: out });
});

// POST /api/qpaynet/admin/payouts/:id/approve — admin marks paid
// Soft-admin: gated via env QPAYNET_ADMIN_EMAILS comma-list.
qpaynetRouter.post("/admin/payouts/:id/:action", async (req, res) => {
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  if (!isAdmin(auth.email)) return res.status(403).json({ error: "not_admin" });
  const callerEmail = (auth.email ?? "").toLowerCase();

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

// GET /api/qpaynet/notifications/preferences
qpaynetRouter.get("/notifications/preferences", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const prefs = await getNotifPrefs(pool, ownerId);
  res.json({
    emailEnabled: prefs.emailEnabled,
    inAppEnabled: prefs.inAppEnabled,
    mutedKinds: prefs.mutedKinds,
    availableKinds: Object.keys(EMAIL_TEMPLATES),
  });
});

// PATCH /api/qpaynet/notifications/preferences
qpaynetRouter.patch("/notifications/preferences", async (req, res) => {
  await ensureNotificationsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const { emailEnabled, inAppEnabled, mutedKinds } = req.body as {
    emailEnabled?: boolean; inAppEnabled?: boolean; mutedKinds?: string[];
  };

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const muted = Array.isArray(mutedKinds)
    ? mutedKinds.filter(k => Object.keys(EMAIL_TEMPLATES).includes(k)).join(",")
    : undefined;

  await pool.query(
    `INSERT INTO qpaynet_notif_prefs (owner_id, email_enabled, in_app_enabled, muted_kinds, updated_at)
     VALUES ($1, COALESCE($2, true), COALESCE($3, true), COALESCE($4, ''), NOW())
     ON CONFLICT (owner_id) DO UPDATE SET
       email_enabled  = COALESCE($2, qpaynet_notif_prefs.email_enabled),
       in_app_enabled = COALESCE($3, qpaynet_notif_prefs.in_app_enabled),
       muted_kinds    = COALESCE($4, qpaynet_notif_prefs.muted_kinds),
       updated_at     = NOW()`,
    [ownerId, emailEnabled, inAppEnabled, muted],
  );
  const prefs = await getNotifPrefs(pool, ownerId);
  res.json({ ok: true, ...prefs });
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

  const parsed = validateOr400(req, res, {
    url: "url",
    secret: { kind: "string", min: 16, max: 200 },
  });
  if (!parsed) return;
  const url = parsed.url as string;
  const secret = parsed.secret as string;

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

// GET /api/qpaynet/me/dashboard — owner aggregated analytics
qpaynetRouter.get("/me/dashboard", async (req, res) => {
  await ensureTables();
  await ensureRequestsTable();
  await ensurePayoutsTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";

  const [walletsTotal, monthFlow, daily7, requestsCounts, payoutsCounts, unread] = await Promise.all([
    pool.query("SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS s FROM qpaynet_wallets WHERE owner_id=$1 AND status='active'", [ownerId]),
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type IN ('deposit','transfer_in') THEN amount ELSE 0 END), 0) AS in_amount,
         COALESCE(SUM(CASE WHEN type IN ('withdraw','transfer_out','merchant_charge') THEN amount + fee ELSE 0 END), 0) AS out_amount,
         COUNT(*) AS tx_count
       FROM qpaynet_transactions
       WHERE owner_id=$1 AND created_at >= date_trunc('month', NOW())`,
      [ownerId],
    ),
    pool.query(
      `SELECT date_trunc('day', created_at) AS day,
              COALESCE(SUM(CASE WHEN type IN ('deposit','transfer_in') THEN amount ELSE 0 END), 0) AS in_amount,
              COALESCE(SUM(CASE WHEN type IN ('withdraw','transfer_out','merchant_charge') THEN amount + fee ELSE 0 END), 0) AS out_amount
       FROM qpaynet_transactions
       WHERE owner_id=$1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY 1 ORDER BY 1 ASC`,
      [ownerId],
    ),
    pool.query(
      `SELECT status, COUNT(*) AS n FROM qpaynet_payment_requests WHERE owner_id=$1 GROUP BY status`,
      [ownerId],
    ),
    pool.query(
      `SELECT status, COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM qpaynet_payouts WHERE owner_id=$1 GROUP BY status`,
      [ownerId],
    ),
    pool.query("SELECT COUNT(*) AS n FROM qpaynet_notifications WHERE owner_id=$1 AND read_at IS NULL", [ownerId]).catch(() => ({ rows: [{ n: 0 }] })),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestsByStatus: Record<string, number> = {};
  for (const row of requestsCounts.rows) requestsByStatus[row.status] = Number(row.n);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payoutsByStatus: Record<string, { count: number; totalKzt: number }> = {};
  for (const row of payoutsCounts.rows) payoutsByStatus[row.status] = { count: Number(row.n), totalKzt: fromTiin(BigInt(row.total)) };

  res.json({
    wallets: {
      activeCount: Number(walletsTotal.rows[0]?.n ?? 0),
      totalBalanceKzt: fromTiin(BigInt(walletsTotal.rows[0]?.s ?? 0)),
    },
    thisMonth: {
      inKzt: fromTiin(BigInt(monthFlow.rows[0]?.in_amount ?? 0)),
      outKzt: fromTiin(BigInt(monthFlow.rows[0]?.out_amount ?? 0)),
      netKzt: fromTiin(BigInt(monthFlow.rows[0]?.in_amount ?? 0) - BigInt(monthFlow.rows[0]?.out_amount ?? 0)),
      txCount: Number(monthFlow.rows[0]?.tx_count ?? 0),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last7days: daily7.rows.map((r: any) => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      inKzt: fromTiin(BigInt(r.in_amount)),
      outKzt: fromTiin(BigInt(r.out_amount)),
    })),
    paymentRequests: {
      pending: requestsByStatus.pending ?? 0,
      paid: requestsByStatus.paid ?? 0,
      cancelled: requestsByStatus.cancelled ?? 0,
    },
    payouts: payoutsByStatus,
    unreadNotifications: Number(unread.rows[0]?.n ?? 0),
  });
});

// GET /api/qpaynet/me/audit — owner audit log (immutable trail for compliance)
qpaynetRouter.get("/me/audit", authLimiter, async (req, res) => {
  await ensureAuditTable();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "anon";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const r = await pool.query(
    `SELECT id, action, details, ip, user_agent, created_at FROM qpaynet_audit_log
     WHERE owner_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [ownerId, limit],
  );
  res.json({ events: r.rows });
});

// GET /api/qpaynet/health — lightweight liveness check for hub monitor
qpaynetRouter.get("/health", async (_req, res) => {
  try {
    await ensureTables();
    await ensureDeliveriesTable();
    const pool = getPool();
    const [walletsR, stuckR] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM qpaynet_wallets"),
      pool.query(
        `SELECT COUNT(*)::int AS n
         FROM qpaynet_webhook_deliveries
         WHERE delivered_at IS NULL AND attempts >= $1`,
        [MAX_NOTIFY_ATTEMPTS],
      ).catch(() => ({ rows: [{ n: 0 }] })),
    ]);
    const stats = getPoolStats();
    const stuckDeliveries = Number(stuckR.rows[0]?.n ?? 0);
    // Pool exhaustion or > 50 stuck webhook deliveries = degraded.
    // /api/aevion/health rolls this up so on-call gets paged before requests
    // start timing out or partners stop getting events.
    const degraded = (!!stats && stats.waiting > 0) || stuckDeliveries > 50;
    res.json({
      status: degraded ? "degraded" : "ok",
      service: "qpaynet",
      wallets: Number(walletsR.rows[0]?.n ?? 0),
      pool: stats,
      encryption: isEncryptionEnabled() ? "enabled" : "disabled",
      stuckWebhookDeliveries: stuckDeliveries,
    });
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
      const decryptedSecret = decryptSecret(row.notify_secret) ?? "";
      if (needsEncryption(row.notify_secret)) {
        pool.query(
          "UPDATE qpaynet_payment_requests SET notify_secret=$1 WHERE id=$2",
          [encryptSecret(decryptedSecret), row.id],
        ).catch(() => { /* migration best-effort */ });
      }
      const result = await fireRequestWebhook(row.notify_url, decryptedSecret, payload);
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

    // Second pass: drain pending merchant_webhooks deliveries.
    await ensureDeliveriesTable();
    const dueDeliveries = await pool.query(
      `SELECT d.id, d.sub_id, d.event, d.payload, d.attempts, m.url, m.secret
       FROM qpaynet_webhook_deliveries d
       JOIN qpaynet_merchant_webhooks m ON m.id = d.sub_id
       WHERE d.delivered_at IS NULL
         AND d.next_retry_at IS NOT NULL
         AND d.next_retry_at <= NOW()
         AND d.attempts < $1
         AND m.revoked_at IS NULL
       ORDER BY d.next_retry_at ASC
       LIMIT $2`,
      [MAX_NOTIFY_ATTEMPTS, RETRY_BATCH],
    );
    for (const row of dueDeliveries.rows) {
      const decryptedSecret = decryptSecret(row.secret) ?? "";
      if (needsEncryption(row.secret)) {
        pool.query(
          "UPDATE qpaynet_merchant_webhooks SET secret=$1 WHERE id=$2",
          [encryptSecret(decryptedSecret), row.sub_id],
        ).catch(() => { /* best-effort */ });
      }
      const result = await fireRequestWebhook(row.url, decryptedSecret, row.payload);
      const attempts = (row.attempts ?? 0) + 1;
      if (result.ok) {
        await pool.query(
          "UPDATE qpaynet_webhook_deliveries SET attempts=$1, delivered_at=NOW(), next_retry_at=NULL, last_error=NULL WHERE id=$2",
          [attempts, row.id],
        );
      } else {
        const next = nextRetryAt(attempts);
        await pool.query(
          "UPDATE qpaynet_webhook_deliveries SET attempts=$1, last_error=$2, next_retry_at=$3 WHERE id=$4",
          [attempts, result.error?.slice(0, 500) ?? "unknown", next, row.id],
        );
      }
    }
  } catch (err) {
    console.warn("[qpaynet retry] tick failed:", err instanceof Error ? err.message : err);
    captureException(err, { source: "qpaynet/retryWorker" });
  }
}

export function startQpaynetRetryWorker(): void {
  if (retryWorkerStarted) return;
  retryWorkerStarted = true;
  startIdempotencyGc();
  // Skip in test env unless explicitly enabled.
  if (process.env.NODE_ENV === "test" && process.env.QPAYNET_RETRY_IN_TEST !== "1") return;
  setInterval(() => { void runRetryTick(); }, RETRY_INTERVAL_MS).unref();
  console.log(`[qpaynet] retry worker + idempotency GC started`);
}

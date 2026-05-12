/**
 * QMaskCard — protected virtual banking and payment infrastructure.
 *
 * Per AEVION fintech manifest: consumer + enterprise payment interaction layer
 * providing virtual payment masking, disposable identities, and AI fraud
 * protection. Sits between user-facing modules (QPayNet, Bureau, Build) and
 * the actual Stripe rails — letting merchants accept payments without ever
 * touching real PAN/CVV.
 *
 * Architecture:
 *  - Identity:  shared AEVION JWT, masks bound to userId.
 *  - Wallet:    each mask carries a spend limit + remaining balance, decremented
 *               atomically on settled charges.
 *  - Security:  raw PAN is never stored. Each mask has a unique virtual-PAN
 *               sentinel (aev-mask-<32hex>) — the merchant sees only that.
 *  - Audit:     every charge appended to QMaskCardCharge; never mutated.
 *  - AI hook:   per-charge risk score computed (geo + velocity + amount) and
 *               stored alongside the charge, so the fraud-monitor service
 *               can flag downstream.
 *
 * Endpoints:
 *   GET  /api/qmaskcard/health
 *   POST /api/qmaskcard/masks                       — issue a new virtual card
 *   GET  /api/qmaskcard/masks                       — list user's masks
 *   POST /api/qmaskcard/masks/:id/revoke            — soft-revoke
 *   POST /api/qmaskcard/charges                     — authorize a charge against mask
 *   GET  /api/qmaskcard/charges?maskId=             — list charges
 *   GET  /api/qmaskcard/stats                       — system roll-up
 *
 * NOT a card issuer in the regulatory sense. This is a meta-tokenization
 * layer — actual settlement happens through Stripe/QPayNet with this mask
 * as a routing tag.
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { emitVeilNetXEntry } from "../lib/ecosystemEvents";
import rateLimit from "express-rate-limit";

export const qmaskcardRouter = Router();

const writeLimit = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
const chargeLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const readLimit = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false });

const MASK_KINDS = new Set(["single-use", "recurring", "merchant-locked", "category-locked"]);

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QMaskCardMask" (
      "id"                 TEXT PRIMARY KEY,
      "userId"             TEXT NOT NULL,
      "label"              TEXT NOT NULL,
      "virtualPan"         TEXT NOT NULL UNIQUE,
      "kind"               TEXT NOT NULL DEFAULT 'single-use',
      "lockedToMerchant"   TEXT,
      "lockedToCategory"   TEXT,
      "currency"           TEXT NOT NULL DEFAULT 'USD',
      "spendLimitCents"    BIGINT NOT NULL,
      "remainingCents"     BIGINT NOT NULL,
      "expiresAt"          TIMESTAMPTZ,
      "revokedAt"          TIMESTAMPTZ,
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QMaskCardMask_user_idx" ON "QMaskCardMask" ("userId", "revokedAt");`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QMaskCardCharge" (
      "id"               TEXT PRIMARY KEY,
      "maskId"           TEXT NOT NULL,
      "userId"           TEXT NOT NULL,
      "amountCents"      BIGINT NOT NULL,
      "currency"         TEXT NOT NULL,
      "merchantName"     TEXT,
      "merchantCategory" TEXT,
      "geoCountry"       TEXT,
      "status"           TEXT NOT NULL DEFAULT 'authorized',
      "declineReason"    TEXT,
      "riskScore"        INT NOT NULL DEFAULT 0,
      "paymentRef"       TEXT,
      "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QMaskCardCharge_mask_idx" ON "QMaskCardCharge" ("maskId", "createdAt");`);
  tablesReady = true;
}

function generateVirtualPan(): string {
  return "aev-mask-" + crypto.randomBytes(16).toString("hex");
}

/** Naive AI-fraud-score stub: 0..100. Higher = more suspicious.
 *  Combines geo mismatch, off-hour, large-amount, velocity (heuristics only).
 */
function computeRiskScore(input: {
  amountCents: number;
  spendLimitCents: number;
  recentChargeCount: number;
  geoCountry?: string;
  expectedCountry?: string;
}): number {
  let s = 0;
  if (input.amountCents > input.spendLimitCents * 0.8) s += 25;
  if (input.recentChargeCount > 5) s += 20;
  if (input.geoCountry && input.expectedCountry && input.geoCountry !== input.expectedCountry) s += 30;
  const hour = new Date().getUTCHours();
  if (hour >= 2 && hour <= 5) s += 10;
  if (input.amountCents > 50_000_00) s += 25; // > $50k
  return Math.min(100, s);
}

qmaskcardRouter.get("/health", async (_req, res) => {
  let db: "ok" | "down" = "ok";
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
  } catch (err) {
    db = "down";
    console.warn("[qmaskcard] /health db probe failed", err instanceof Error ? err.message : err);
  }
  const status = db === "ok" ? "ok" : "degraded";
  res.status(db === "ok" ? 200 : 503).json({ status, service: "qmaskcard", db, timestamp: new Date().toISOString() });
});

// ── POST /masks — issue a new virtual card
qmaskcardRouter.post("/masks", writeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const {
      label,
      kind = "single-use",
      lockedToMerchant,
      lockedToCategory,
      currency = "USD",
      spendLimitCents,
      ttlHours,
    } = req.body || {};
    if (!MASK_KINDS.has(kind)) {
      return res.status(400).json({ error: "invalid_kind", allowed: Array.from(MASK_KINDS) });
    }
    const limit = parseInt(String(spendLimitCents), 10);
    if (!Number.isFinite(limit) || limit < 100 || limit > 100_000_000) {
      return res.status(400).json({ error: "spendLimitCents must be 100..100000000" });
    }
    if (typeof label !== "string" || label.trim().length < 1 || label.length > 80) {
      return res.status(400).json({ error: "label required (max 80)" });
    }
    const ttl = parseInt(String(ttlHours ?? "168"), 10); // default 7 days
    const expiresAt = Number.isFinite(ttl) && ttl > 0 && ttl <= 8760
      ? new Date(Date.now() + ttl * 3600_000)
      : null;
    const id = crypto.randomUUID();
    const virtualPan = generateVirtualPan();
    const pool = getPool();
    await pool.query(
      `INSERT INTO "QMaskCardMask" ("id","userId","label","virtualPan","kind","lockedToMerchant","lockedToCategory","currency","spendLimitCents","remainingCents","expiresAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)`,
      [
        id, auth.sub, label.trim(), virtualPan, kind,
        lockedToMerchant ? String(lockedToMerchant).slice(0, 100) : null,
        lockedToCategory ? String(lockedToCategory).slice(0, 50) : null,
        String(currency).slice(0, 8).toUpperCase(),
        limit,
        expiresAt,
      ],
    );
    res.status(201).json({
      id, virtualPan, kind, label: label.trim(),
      spendLimitCents: limit, remainingCents: limit,
      currency: String(currency).toUpperCase(),
      expiresAt,
      note: "Use virtualPan as the routing tag for charges. Real PAN never issued.",
    });
  } catch (err: unknown) {
    console.error("[qmaskcard] mask_create_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "mask_create_failed" });
  }
});

// ── GET /masks — list user's masks
qmaskcardRouter.get("/masks", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const pool = getPool();
    const includeRevoked = req.query.includeRevoked === "1";
    const sql = `
      SELECT "id","label","virtualPan","kind","lockedToMerchant","lockedToCategory","currency",
             "spendLimitCents","remainingCents","expiresAt","revokedAt","createdAt"
      FROM "QMaskCardMask"
      WHERE "userId" = $1 ${includeRevoked ? "" : "AND \"revokedAt\" IS NULL"}
      ORDER BY "createdAt" DESC LIMIT 50
    `;
    const r = await pool.query(sql, [auth.sub]);
    res.json({ masks: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[qmaskcard] masks_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "masks_list_failed" });
  }
});

// ── POST /masks/:id/revoke
qmaskcardRouter.post("/masks/:id/revoke", writeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const pool = getPool();
    const r = await pool.query(
      `UPDATE "QMaskCardMask" SET "revokedAt" = NOW()
       WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL
       RETURNING "id"`,
      [String(req.params.id || ""), auth.sub],
    );
    if ((r.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "mask_not_found_or_already_revoked" });
    }
    res.json({ ok: true, revokedId: req.params.id });
  } catch (err: unknown) {
    console.error("[qmaskcard] revoke_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "revoke_failed" });
  }
});

// ── POST /charges — authorize a charge against a mask
qmaskcardRouter.post("/charges", chargeLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const { maskId, amountCents, currency = "USD", merchantName, merchantCategory, geoCountry, paymentRef } = req.body || {};
    if (!maskId) return res.status(400).json({ error: "maskId required" });
    const amount = parseInt(String(amountCents), 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100_000_000) {
      return res.status(400).json({ error: "amountCents must be 1..100000000" });
    }
    const pool = getPool();
    const m = await pool.query(
      `SELECT "id","userId","kind","lockedToMerchant","lockedToCategory","currency","spendLimitCents","remainingCents","expiresAt","revokedAt"
       FROM "QMaskCardMask" WHERE "id" = $1 LIMIT 1`,
      [maskId],
    );
    if (m.rowCount === 0) return res.status(404).json({ error: "mask_not_found" });
    const mask = m.rows[0] as {
      userId: string;
      kind: string;
      lockedToMerchant: string | null;
      lockedToCategory: string | null;
      currency: string;
      spendLimitCents: string | number;
      remainingCents: string | number;
      expiresAt: Date | null;
      revokedAt: Date | null;
    };
    if (mask.userId !== auth.sub) return res.status(403).json({ error: "not_mask_owner" });
    if (mask.revokedAt) return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "mask_revoked");
    if (mask.expiresAt && mask.expiresAt < new Date()) return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "mask_expired");
    if (mask.currency !== String(currency).toUpperCase()) return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "currency_mismatch");
    if (mask.lockedToMerchant && mask.lockedToMerchant !== String(merchantName ?? "")) {
      return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "merchant_locked");
    }
    if (mask.lockedToCategory && mask.lockedToCategory !== String(merchantCategory ?? "")) {
      return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "category_locked");
    }
    const remaining = Number(mask.remainingCents);
    if (amount > remaining) {
      return decline(res, maskId, auth.sub, amount, currency, merchantName, merchantCategory, geoCountry, "insufficient_balance");
    }

    // Velocity check — last 60 min charges count.
    const velocityR = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "QMaskCardCharge" WHERE "maskId" = $1 AND "createdAt" > NOW() - INTERVAL '60 minutes'`,
      [maskId],
    );
    const recentChargeCount = Number((velocityR.rows[0] as { n: number }).n);
    const riskScore = computeRiskScore({
      amountCents: amount,
      spendLimitCents: Number(mask.spendLimitCents),
      recentChargeCount,
      geoCountry: geoCountry ? String(geoCountry).slice(0, 4) : undefined,
    });

    // For single-use masks: auto-revoke after first successful authorization.
    const chargeId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "QMaskCardCharge" ("id","maskId","userId","amountCents","currency","merchantName","merchantCategory","geoCountry","status","riskScore","paymentRef")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'authorized',$9,$10)`,
      [
        chargeId, maskId, auth.sub, amount, String(currency).toUpperCase(),
        merchantName ? String(merchantName).slice(0, 100) : null,
        merchantCategory ? String(merchantCategory).slice(0, 50) : null,
        geoCountry ? String(geoCountry).slice(0, 4) : null,
        riskScore,
        paymentRef ? String(paymentRef).slice(0, 100) : null,
      ],
    );
    await pool.query(
      `UPDATE "QMaskCardMask" SET "remainingCents" = "remainingCents" - $1 WHERE "id" = $2`,
      [amount, maskId],
    );
    if (mask.kind === "single-use") {
      await pool.query(`UPDATE "QMaskCardMask" SET "revokedAt" = NOW() WHERE "id" = $1`, [maskId]);
    }

    // Fire-and-forget: record settlement on VeilNetX ledger.
    void emitVeilNetXEntry({
      module: "qmaskcard",
      kind: "settlement",
      fromIdentifier: `qmaskcard:${maskId}`,
      toIdentifier: merchantName ? `merchant:${String(merchantName).slice(0, 80)}` : "merchant:unknown",
      amountCents: amount,
      currency: String(currency).toUpperCase(),
      meta: { chargeId, riskScore, merchantCategory, geoCountry },
    }).catch(() => null);

    res.status(201).json({
      id: chargeId, maskId, status: "authorized",
      amountCents: amount, riskScore, autoRevoked: mask.kind === "single-use",
    });
  } catch (err: unknown) {
    console.error("[qmaskcard] charge_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "charge_failed" });
  }
});

async function decline(
  res: import("express").Response,
  maskId: string, userId: string, amount: number, currency: string,
  merchantName: unknown, merchantCategory: unknown, geoCountry: unknown,
  reason: string,
) {
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "QMaskCardCharge" ("id","maskId","userId","amountCents","currency","merchantName","merchantCategory","geoCountry","status","declineReason","riskScore")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'declined',$9,100)`,
    [
      id, maskId, userId, amount, String(currency).toUpperCase(),
      merchantName ? String(merchantName).slice(0, 100) : null,
      merchantCategory ? String(merchantCategory).slice(0, 50) : null,
      geoCountry ? String(geoCountry).slice(0, 4) : null,
      reason,
    ],
  );
  return res.status(402).json({ id, status: "declined", reason });
}

qmaskcardRouter.get("/charges", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const maskId = String(req.query.maskId ?? "").trim();
    const pool = getPool();
    const params: unknown[] = [auth.sub];
    let sql = `SELECT "id","maskId","amountCents","currency","merchantName","merchantCategory","geoCountry","status","declineReason","riskScore","createdAt"
               FROM "QMaskCardCharge" WHERE "userId" = $1`;
    if (maskId) { params.push(maskId); sql += ` AND "maskId" = $${params.length}`; }
    sql += ` ORDER BY "createdAt" DESC LIMIT 100`;
    const r = await pool.query(sql, params);
    res.json({ charges: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[qmaskcard] charges_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "charges_list_failed" });
  }
});

qmaskcardRouter.get("/stats", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM "QMaskCardMask" WHERE "revokedAt" IS NULL)::int  AS active_masks,
        (SELECT COUNT(*) FROM "QMaskCardMask")::int                            AS total_masks,
        (SELECT COUNT(*) FROM "QMaskCardCharge" WHERE "status"='authorized')::int  AS authorized_charges,
        (SELECT COUNT(*) FROM "QMaskCardCharge" WHERE "status"='declined')::int    AS declined_charges,
        (SELECT COALESCE(SUM("amountCents"),0) FROM "QMaskCardCharge" WHERE "status"='authorized')::bigint AS volume_cents
    `);
    res.json({ ...r.rows[0], service: "qmaskcard" });
  } catch (err: unknown) {
    console.error("[qmaskcard] stats_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "stats_failed" });
  }
});

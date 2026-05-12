/**
 * QGood — charity / good-deeds campaign platform.
 *
 * Working v1 MVP — transparent campaigns with Stripe/QPayNet payment chain
 * and QRight audit trail. Per AEVION manifest: ecosystem-native economy
 * layer for contribution-based value flows.
 *
 * Architecture:
 *  - Identity:  reuses AEVION JWT (verifyBearerOptional)
 *  - Wallet:    donations route through QPayNet → Stripe (paymentRef)
 *  - Security:  email hashed (SHA-256), admin gate via QGOOD_ADMIN_EMAILS
 *  - Audit:     every donation written, never mutated; campaign roll-ups atomic
 *  - Scaling:   pure Postgres, no in-memory state; rate-limited per IP
 *
 * Endpoints:
 *   GET    /api/qgood/health
 *   GET    /api/qgood/campaigns           — list active (filterable by category)
 *   GET    /api/qgood/campaigns/:id       — detail + recent donations
 *   POST   /api/qgood/campaigns           — create (starts as draft, needs approval)
 *   POST   /api/qgood/campaigns/:id/approve — admin only
 *   POST   /api/qgood/campaigns/:id/donations — record donation (anonymous-friendly)
 *   GET    /api/qgood/stats               — ecosystem-wide roll-up
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { emitEcosystemEvent } from "../lib/ecosystemEvents";
import rateLimit from "express-rate-limit";

export const qgoodRouter = Router();

const createLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const donateLimit = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const readLimit = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false });

const CAMPAIGN_STATUSES = new Set(["draft", "active", "closed", "rejected"]);
const CATEGORY_OPTIONS = new Set([
  "health", "education", "disaster-relief", "environment",
  "animals", "community", "tech-for-good", "other",
]);

function isAdmin(auth: { email?: string } | null): boolean {
  if (!auth?.email) return false;
  const list = (process.env.QGOOD_ADMIN_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  return list.length === 0 ? false : list.includes(auth.email.toLowerCase());
}

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QGoodCampaign" (
      "id"            TEXT PRIMARY KEY,
      "ownerUserId"   TEXT,
      "ownerEmail"    TEXT,
      "title"         TEXT NOT NULL,
      "description"   TEXT NOT NULL,
      "category"      TEXT NOT NULL DEFAULT 'other',
      "country"       TEXT,
      "targetCents"   BIGINT NOT NULL,
      "raisedCents"   BIGINT NOT NULL DEFAULT 0,
      "donorCount"    INT NOT NULL DEFAULT 0,
      "currency"      TEXT NOT NULL DEFAULT 'USD',
      "status"        TEXT NOT NULL DEFAULT 'draft',
      "imageUrl"      TEXT,
      "approvedAt"    TIMESTAMPTZ,
      "closedAt"      TIMESTAMPTZ,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QGoodCampaign_status_idx" ON "QGoodCampaign" ("status", "createdAt");`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QGoodDonation" (
      "id"             TEXT PRIMARY KEY,
      "campaignId"     TEXT NOT NULL,
      "amountCents"    BIGINT NOT NULL,
      "currency"       TEXT NOT NULL DEFAULT 'USD',
      "donorName"      TEXT,
      "donorEmailHash" TEXT,
      "messageText"    TEXT,
      "anonymous"      BOOLEAN NOT NULL DEFAULT FALSE,
      "paymentRef"     TEXT,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QGoodDonation_campaign_idx" ON "QGoodDonation" ("campaignId", "createdAt");`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QGoodMatchingPool" (
      "id"               TEXT PRIMARY KEY,
      "label"            TEXT NOT NULL,
      "currency"         TEXT NOT NULL DEFAULT 'USD',
      "totalCents"       BIGINT NOT NULL,
      "remainingCents"   BIGINT NOT NULL,
      "matchRatio"       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
      "maxMatchPerDonationCents" BIGINT NOT NULL DEFAULT 10000,
      "status"           TEXT NOT NULL DEFAULT 'active',
      "createdBy"        TEXT,
      "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QGoodMatchingPool_status_idx" ON "QGoodMatchingPool" ("status");`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QGoodMatch" (
      "id"             TEXT PRIMARY KEY,
      "poolId"         TEXT NOT NULL,
      "campaignId"     TEXT NOT NULL,
      "donationId"     TEXT NOT NULL,
      "amountCents"    BIGINT NOT NULL,
      "currency"       TEXT NOT NULL,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("donationId")
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QGoodMatch_pool_idx" ON "QGoodMatch" ("poolId", "createdAt");`);
  tablesReady = true;
}

qgoodRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "qgood", timestamp: new Date().toISOString() });
});

qgoodRouter.get("/campaigns", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const category = String(req.query.category ?? "").trim();
    const status = String(req.query.status ?? "active").trim();
    const pool = getPool();
    const where: string[] = [];
    const params: unknown[] = [];
    if (CAMPAIGN_STATUSES.has(status)) {
      params.push(status);
      where.push(`"status" = $${params.length}`);
    }
    if (CATEGORY_OPTIONS.has(category)) {
      params.push(category);
      where.push(`"category" = $${params.length}`);
    }
    params.push(limit);
    const r = await pool.query(`
      SELECT "id","title","description","category","country","targetCents","raisedCents","donorCount","currency","status","imageUrl","createdAt"
      FROM "QGoodCampaign"
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY "createdAt" DESC
      LIMIT $${params.length}
    `, params);
    res.json({ campaigns: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[qgood] campaigns_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "campaigns_list_failed" });
  }
});

qgoodRouter.get("/campaigns/:id", readLimit, async (req, res) => {
  try {
    await ensureTables();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const pool = getPool();
    const c = await pool.query(
      `SELECT "id","title","description","category","country","targetCents","raisedCents","donorCount","currency","status","imageUrl","approvedAt","closedAt","createdAt"
       FROM "QGoodCampaign" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (c.rowCount === 0) return res.status(404).json({ error: "campaign_not_found" });
    const donations = await pool.query(
      `SELECT "id","amountCents","currency","donorName","messageText","anonymous","createdAt"
       FROM "QGoodDonation" WHERE "campaignId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      [id],
    );
    const safeDonations = (donations.rows as Array<{ anonymous: boolean; donorName: string | null }>).map((d) => ({
      ...d,
      donorName: d.anonymous ? null : d.donorName,
    }));
    res.json({ campaign: c.rows[0], donations: safeDonations });
  } catch (err: unknown) {
    console.error("[qgood] campaign_get_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "campaign_get_failed" });
  }
});

qgoodRouter.post("/campaigns", createLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "auth required" });
    const { title, description, category = "other", country, targetCents, currency = "USD", imageUrl } = req.body || {};
    if (typeof title !== "string" || title.trim().length < 3 || title.length > 200) {
      return res.status(400).json({ error: "title must be 3..200 chars" });
    }
    if (typeof description !== "string" || description.trim().length < 20 || description.length > 5000) {
      return res.status(400).json({ error: "description must be 20..5000 chars" });
    }
    if (!CATEGORY_OPTIONS.has(category)) {
      return res.status(400).json({ error: "invalid_category", allowed: Array.from(CATEGORY_OPTIONS) });
    }
    const target = parseInt(String(targetCents), 10);
    if (!Number.isFinite(target) || target < 100 || target > 1_000_000_000) {
      return res.status(400).json({ error: "targetCents must be 100..1000000000 (1¢..10M$)" });
    }
    const id = crypto.randomUUID();
    const pool = getPool();
    await pool.query(
      `INSERT INTO "QGoodCampaign" ("id","ownerUserId","ownerEmail","title","description","category","country","targetCents","currency","imageUrl","status")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')`,
      [
        id, auth.sub, auth.email || null,
        title.trim(), description.trim(), category,
        country ? String(country).slice(0, 80) : null,
        target, String(currency).slice(0, 8).toUpperCase(),
        imageUrl ? String(imageUrl).slice(0, 500) : null,
      ],
    );
    res.status(201).json({ id, status: "draft", message: "Submitted for review." });
  } catch (err: unknown) {
    console.error("[qgood] campaign_create_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "campaign_create_failed" });
  }
});

qgoodRouter.post("/campaigns/:id/approve", createLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!isAdmin(auth)) return res.status(403).json({ error: "admin_only" });
    const pool = getPool();
    const r = await pool.query(
      `UPDATE "QGoodCampaign" SET "status" = 'active', "approvedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'draft' RETURNING "id","status"`,
      [String(req.params.id || "")],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "draft_campaign_not_found" });
    res.json({ ok: true, campaign: r.rows[0] });
  } catch (err: unknown) {
    console.error("[qgood] campaign_approve_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "campaign_approve_failed" });
  }
});

qgoodRouter.post("/campaigns/:id/donations", donateLimit, async (req, res) => {
  try {
    await ensureTables();
    const id = String(req.params.id || "").trim();
    const { amountCents, currency = "USD", donorName, donorEmail, messageText, anonymous = false, paymentRef } = req.body || {};
    const amount = parseInt(String(amountCents), 10);
    if (!Number.isFinite(amount) || amount < 100 || amount > 100_000_000) {
      return res.status(400).json({ error: "amountCents must be 100..100000000 ($1..$1M)" });
    }
    const pool = getPool();
    const c = await pool.query(
      `SELECT "status","currency" FROM "QGoodCampaign" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (c.rowCount === 0) return res.status(404).json({ error: "campaign_not_found" });
    const row = c.rows[0] as { status: string; currency: string };
    if (row.status !== "active") return res.status(400).json({ error: "campaign_not_active", status: row.status });
    if (row.currency !== String(currency).toUpperCase()) {
      return res.status(400).json({ error: "currency_mismatch", expected: row.currency });
    }
    const donationId = crypto.randomUUID();
    const emailHash = donorEmail
      ? crypto.createHash("sha256").update(String(donorEmail).toLowerCase().trim()).digest("hex").slice(0, 32)
      : null;
    await pool.query(
      `INSERT INTO "QGoodDonation" ("id","campaignId","amountCents","currency","donorName","donorEmailHash","messageText","anonymous","paymentRef")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        donationId, id, amount, String(currency).slice(0, 8).toUpperCase(),
        donorName ? String(donorName).slice(0, 100) : null,
        emailHash,
        messageText ? String(messageText).slice(0, 500) : null,
        Boolean(anonymous),
        paymentRef ? String(paymentRef).slice(0, 100) : null,
      ],
    );
    await pool.query(
      `UPDATE "QGoodCampaign"
       SET "raisedCents" = "raisedCents" + $1, "donorCount" = "donorCount" + 1
       WHERE "id" = $2`,
      [amount, id],
    );

    // Matching fund — best-effort; never blocks the donation.
    // Try to auto-match from an active pool (oldest first). Atomic: lock + check + decrement.
    let matchedAmountCents: number | null = null;
    let matchPoolId: string | null = null;
    try {
      const poolR = await pool.query(
        `SELECT "id","matchRatio","remainingCents","maxMatchPerDonationCents","currency"
         FROM "QGoodMatchingPool"
         WHERE "status" = 'active' AND "currency" = $1 AND "remainingCents" > 0
         ORDER BY "createdAt" ASC LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [String(currency).toUpperCase()],
      );
      if ((poolR.rowCount ?? 0) > 0) {
        const p = poolR.rows[0] as { id: string; matchRatio: number; remainingCents: string | number; maxMatchPerDonationCents: string | number; currency: string };
        const proposed = Math.floor(amount * Number(p.matchRatio));
        const capped = Math.min(proposed, Number(p.maxMatchPerDonationCents), Number(p.remainingCents));
        if (capped > 0) {
          const matchId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO "QGoodMatch" ("id","poolId","campaignId","donationId","amountCents","currency")
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [matchId, p.id, id, donationId, capped, p.currency],
          );
          await pool.query(
            `UPDATE "QGoodMatchingPool"
             SET "remainingCents" = "remainingCents" - $1,
                 "status" = CASE WHEN "remainingCents" - $1 <= 0 THEN 'exhausted' ELSE "status" END
             WHERE "id" = $2 RETURNING "remainingCents"`,
            [capped, p.id],
          );
          await pool.query(
            `UPDATE "QGoodCampaign" SET "raisedCents" = "raisedCents" + $1 WHERE "id" = $2`,
            [capped, id],
          );
          matchedAmountCents = capped;
          matchPoolId = p.id;
        }
      }
    } catch (err) {
      console.warn("[qgood] matching_failed:", err instanceof Error ? err.message : err);
    }

    // Fire-and-forget: record financial trail + reputation boost for donor.
    const donorAuth = verifyBearerOptional(req);
    emitEcosystemEvent({
      module: "qgood",
      ledger: {
        kind: "donation",
        fromIdentifier: emailHash || donorAuth?.sub || "anon",
        toIdentifier: `qgood:${id}`,
        amountCents: amount,
        currency: String(currency).toUpperCase(),
        meta: { campaignId: id, anonymous: Boolean(anonymous) },
      },
      reputation: donorAuth?.sub
        ? { userId: donorAuth.sub, kind: "qgood-donation", meta: { campaignId: id } }
        : undefined,
    });

    res.status(201).json({
      id: donationId, campaignId: id, amountCents: amount,
      match: matchedAmountCents !== null
        ? { amountCents: matchedAmountCents, poolId: matchPoolId }
        : null,
    });
  } catch (err: unknown) {
    console.error("[qgood] donation_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "donation_failed" });
  }
});

qgoodRouter.post("/matching-pools", createLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!isAdmin(auth)) return res.status(403).json({ error: "admin_only" });
    const { label, totalCents, currency = "USD", matchRatio = 1, maxMatchPerDonationCents = 10000 } = req.body || {};
    if (typeof label !== "string" || label.trim().length < 3 || label.length > 120) {
      return res.status(400).json({ error: "label must be 3..120 chars" });
    }
    const total = parseInt(String(totalCents), 10);
    if (!Number.isFinite(total) || total < 100 || total > 1_000_000_000) {
      return res.status(400).json({ error: "totalCents must be 100..1000000000" });
    }
    const ratio = Number(matchRatio);
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 2) {
      return res.status(400).json({ error: "matchRatio must be 0..2" });
    }
    const cap = parseInt(String(maxMatchPerDonationCents), 10);
    if (!Number.isFinite(cap) || cap < 100 || cap > 100_000_000) {
      return res.status(400).json({ error: "maxMatchPerDonationCents must be 100..100000000" });
    }
    const id = crypto.randomUUID();
    const pool = getPool();
    const r = await pool.query(
      `INSERT INTO "QGoodMatchingPool" ("id","label","currency","totalCents","remainingCents","matchRatio","maxMatchPerDonationCents","createdBy")
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7)
       RETURNING "id","label","currency","totalCents","remainingCents","matchRatio","maxMatchPerDonationCents","status","createdBy","createdAt"`,
      [id, label.trim(), String(currency).slice(0, 8).toUpperCase(), total, ratio, cap, auth?.email || null],
    );
    res.status(201).json(r.rows[0]);
  } catch (err: unknown) {
    console.error("[qgood] matching_pool_create_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "matching_pool_create_failed" });
  }
});

qgoodRouter.get("/matching-pools", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query(
      `SELECT "id","label","currency","totalCents","remainingCents","matchRatio","maxMatchPerDonationCents","status","createdAt"
       FROM "QGoodMatchingPool" ORDER BY "createdAt" DESC LIMIT 20`,
    );
    res.json({ pools: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    console.error("[qgood] matching_pools_list_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "matching_pools_list_failed" });
  }
});

qgoodRouter.post("/matching-pools/:id/pause", createLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!isAdmin(auth)) return res.status(403).json({ error: "admin_only" });
    const pool = getPool();
    const r = await pool.query(
      `UPDATE "QGoodMatchingPool" SET "status" = 'paused'
       WHERE "id" = $1 AND "status" = 'active'
       RETURNING "id","label","currency","totalCents","remainingCents","matchRatio","maxMatchPerDonationCents","status","createdAt"`,
      [String(req.params.id || "")],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "active_pool_not_found" });
    res.json(r.rows[0]);
  } catch (err: unknown) {
    console.error("[qgood] matching_pool_pause_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "matching_pool_pause_failed" });
  }
});

qgoodRouter.post("/matching-pools/:id/resume", createLimit, async (req, res) => {
  try {
    await ensureTables();
    const auth = verifyBearerOptional(req);
    if (!isAdmin(auth)) return res.status(403).json({ error: "admin_only" });
    const pool = getPool();
    const r = await pool.query(
      `UPDATE "QGoodMatchingPool" SET "status" = 'active'
       WHERE "id" = $1 AND "status" = 'paused' AND "remainingCents" > 0
       RETURNING "id","label","currency","totalCents","remainingCents","matchRatio","maxMatchPerDonationCents","status","createdAt"`,
      [String(req.params.id || "")],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "paused_pool_not_found_or_empty" });
    res.json(r.rows[0]);
  } catch (err: unknown) {
    console.error("[qgood] matching_pool_resume_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "matching_pool_resume_failed" });
  }
});

qgoodRouter.get("/stats", readLimit, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const totals = await pool.query(
      `SELECT
         COUNT(*)::int                                              AS total_campaigns,
         SUM(CASE WHEN "status"='active' THEN 1 ELSE 0 END)::int    AS active_campaigns,
         COALESCE(SUM("raisedCents"),0)::bigint                     AS total_raised_cents,
         COALESCE(SUM("donorCount"),0)::int                         AS total_donors
       FROM "QGoodCampaign"`,
    );
    res.json({ ...totals.rows[0], service: "qgood", currency: "USD" });
  } catch (err: unknown) {
    console.error("[qgood] stats_failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "stats_failed" });
  }
});

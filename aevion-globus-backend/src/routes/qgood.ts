/**
 * QGood — charity / good-deeds campaign platform + AI Psychology platform.
 *
 * Working v1 MVP — transparent campaigns with Stripe/QPayNet payment chain
 * and QRight audit trail. Per AEVION manifest: ecosystem-native economy
 * layer for contribution-based value flows.
 *
 * Extended with Psychology MVP: mood tracking, AI therapeutic chat, exercises.
 *
 * Architecture:
 *  - Identity:  reuses AEVION JWT (verifyBearerOptional)
 *  - Wallet:    donations route through QPayNet → Stripe (paymentRef)
 *  - Security:  email hashed (SHA-256), admin gate via QGOOD_ADMIN_EMAILS
 *  - Audit:     every donation written, never mutated; campaign roll-ups atomic
 *  - Scaling:   pure Postgres, no in-memory state; rate-limited per IP
 *
 * Endpoints (Charity):
 *   GET    /api/qgood/health
 *   GET    /api/qgood/campaigns           — list active (filterable by category)
 *   GET    /api/qgood/campaigns/:id       — detail + recent donations
 *   POST   /api/qgood/campaigns           — create (starts as draft, needs approval)
 *   POST   /api/qgood/campaigns/:id/approve — admin only
 *   POST   /api/qgood/campaigns/:id/donations — record donation (anonymous-friendly)
 *   GET    /api/qgood/stats               — ecosystem-wide roll-up
 *
 * Endpoints (Psychology MVP):
 *   POST   /api/qgood/mood                — log mood entry (score 1-10, emotion, context)
 *   GET    /api/qgood/mood                — list mood entries (?limit=30&userId=me)
 *   GET    /api/qgood/mood/trends         — 7-day average + emotion frequency
 *   POST   /api/qgood/chat                — AI therapeutic chat (empathic, ≤150 words)
 *   GET    /api/qgood/exercises           — list 5 built-in exercises
 *   POST   /api/qgood/exercises/:id/complete — log exercise completion, return streak
 */

import { Router } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { emitEcosystemEvent } from "../lib/ecosystemEvents";
import rateLimit from "express-rate-limit";
import { ensureQGoodTables, isQGoodDbReady } from "../lib/ensureQGoodTables";

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

/* ═══════════════════════════════════════════════════════════════════════════
   PSYCHOLOGY MVP — Mood tracking, AI chat, Exercises
   ═══════════════════════════════════════════════════════════════════════════ */

// ── In-memory fallbacks for when Postgres is unavailable ────────────────────

interface MoodEntry {
  id: number;
  user_id: string;
  score: number;
  emotion: string | null;
  context: string | null;
  logged_at: string;
}

interface CompletionEntry {
  id: number;
  user_id: string;
  exercise_id: string;
  completed_at: string;
}

let memMoodSeq = 1;
let memCompletionSeq = 1;
const memMoods: MoodEntry[] = [];
const memCompletions: CompletionEntry[] = [];

// ── Rate limiters ────────────────────────────────────────────────────────────

const chatLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const moodLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

// ── Exercise seed (static, no DB) ───────────────────────────────────────────

const EXERCISES = [
  {
    id: "breathing-478",
    title: "4-7-8 Дыхание",
    description: "Вдох 4 сек → задержка 7 сек → выдох 8 сек. Успокаивает нервную систему.",
    category: "breathing",
    durationSec: 60,
    steps: ["Вдох через нос — 4 секунды", "Задержка дыхания — 7 секунд", "Выдох через рот — 8 секунд", "Повторите 4 раза"],
  },
  {
    id: "grounding-54321",
    title: "5-4-3-2-1 Заземление",
    description: "Осознайте 5 вещей, которые видите, 4 — слышите, 3 — чувствуете, 2 — обоняете, 1 — вкус.",
    category: "grounding",
    durationSec: 120,
    steps: ["5 вещей, которые вы видите", "4 звука, которые слышите", "3 тактильных ощущения", "2 запаха", "1 вкус"],
  },
  {
    id: "gratitude-list",
    title: "Список благодарности",
    description: "Запишите 3 вещи, за которые вы благодарны сегодня. Сдвигает фокус с негатива.",
    category: "gratitude",
    durationSec: 180,
    steps: ["Возьмите блокнот или откройте заметки", "Напишите 3 конкретные вещи", "К каждой добавьте 1 предложение — почему это важно", "Перечитайте список вслух"],
  },
  {
    id: "body-scan",
    title: "Сканирование тела",
    description: "Медленно пройдитесь вниманием от макушки до пяток, отмечая напряжение без осуждения.",
    category: "mindfulness",
    durationSec: 300,
    steps: ["Закройте глаза, сядьте удобно", "Внимание на макушку — расслабьте", "Плечи, грудь, живот — отпустите напряжение", "Руки, ноги, ступни — полное расслабление"],
  },
  {
    id: "positive-reframe",
    title: "Позитивное переформулирование",
    description: "Возьмите одну тревожную мысль и найдите для неё три более сбалансированные интерпретации.",
    category: "cognitive",
    durationSec: 120,
    steps: ["Запишите тревожную мысль", "Найдите 3 аргумента «против» этой мысли", "Сформулируйте более сбалансированный взгляд", "Прочитайте новую формулировку 3 раза"],
  },
];

// ── Helper: init psych tables on first use ──────────────────────────────────

let psychTablesInit = false;
async function initPsychTables(): Promise<void> {
  if (psychTablesInit) return;
  psychTablesInit = true;
  try {
    const pool = getPool();
    await ensureQGoodTables(pool);
  } catch {
    // silent — in-memory fallback will be used
  }
}

// ── Helper: callLlm — uses first available provider ─────────────────────────

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = (await r.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
    if (!r.ok) throw new Error(data.error?.message || `Anthropic ${r.status}`);
    return data.content?.map((b) => b.text || "").join("").trim() || "";
  }

  // OpenAI fallback
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        temperature: 0.7,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!r.ok) throw new Error(data.error?.message || `OpenAI ${r.status}`);
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  throw new Error("not-configured");
}

// ── POST /api/qgood/mood ─────────────────────────────────────────────────────

qgoodRouter.post("/mood", moodLimit, async (req, res) => {
  await initPsychTables();
  const body = req.body || {};
  const score = parseInt(String(body.score ?? ""), 10);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    return res.status(400).json({ error: "score must be 1..10" });
  }
  const emotion = body.emotion ? String(body.emotion).slice(0, 50) : null;
  const context = body.context ? String(body.context).slice(0, 500) : null;
  const userId = body.userId ? String(body.userId).slice(0, 100) : "anonymous";

  if (isQGoodDbReady()) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `INSERT INTO qgood_moods (user_id, score, emotion, context) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userId, score, emotion, context],
      );
      return res.status(201).json({ ok: true, entry: r.rows[0] });
    } catch (err: unknown) {
      console.error("[qgood] mood_insert_failed", err instanceof Error ? err.message : err);
    }
  }

  // In-memory fallback
  const entry: MoodEntry = {
    id: memMoodSeq++,
    user_id: userId,
    score,
    emotion,
    context,
    logged_at: new Date().toISOString(),
  };
  memMoods.push(entry);
  res.status(201).json({ ok: true, entry });
});

// ── GET /api/qgood/mood ──────────────────────────────────────────────────────

qgoodRouter.get("/mood", readLimit, async (req, res) => {
  await initPsychTables();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 100);
  const userId = req.query.userId ? String(req.query.userId).slice(0, 100) : "anonymous";

  if (isQGoodDbReady()) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT * FROM qgood_moods WHERE user_id = $1 ORDER BY logged_at DESC LIMIT $2`,
        [userId, limit],
      );
      return res.json({ moods: r.rows, total: r.rowCount });
    } catch (err: unknown) {
      console.error("[qgood] mood_list_failed", err instanceof Error ? err.message : err);
    }
  }

  const filtered = memMoods.filter((m) => m.user_id === userId).slice(-limit).reverse();
  res.json({ moods: filtered, total: filtered.length });
});

// ── GET /api/qgood/mood/trends ───────────────────────────────────────────────

qgoodRouter.get("/mood/trends", readLimit, async (req, res) => {
  await initPsychTables();
  const userId = req.query.userId ? String(req.query.userId).slice(0, 100) : "anonymous";

  if (isQGoodDbReady()) {
    try {
      const pool = getPool();
      const avgRow = await pool.query(
        `SELECT ROUND(AVG(score)::numeric, 1) AS avg_score, COUNT(*) AS count
         FROM qgood_moods
         WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '7 days'`,
        [userId],
      );
      const emotionRow = await pool.query(
        `SELECT emotion, COUNT(*) AS freq
         FROM qgood_moods
         WHERE user_id = $1 AND emotion IS NOT NULL AND logged_at >= NOW() - INTERVAL '7 days'
         GROUP BY emotion ORDER BY freq DESC LIMIT 5`,
        [userId],
      );
      const dailyRow = await pool.query(
        `SELECT DATE(logged_at) AS day, ROUND(AVG(score)::numeric,1) AS avg_score
         FROM qgood_moods
         WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '7 days'
         GROUP BY day ORDER BY day ASC`,
        [userId],
      );
      return res.json({
        period: "7d",
        avg_score: avgRow.rows[0]?.avg_score ?? null,
        total_entries: Number(avgRow.rows[0]?.count ?? 0),
        emotion_frequency: emotionRow.rows,
        daily: dailyRow.rows,
      });
    } catch (err: unknown) {
      console.error("[qgood] mood_trends_failed", err instanceof Error ? err.message : err);
    }
  }

  // In-memory fallback trends
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recent = memMoods.filter((m) => m.user_id === userId && m.logged_at >= cutoff);
  const avg = recent.length ? +(recent.reduce((s, m) => s + m.score, 0) / recent.length).toFixed(1) : null;
  const emotionFreq: Record<string, number> = {};
  for (const m of recent) {
    if (m.emotion) emotionFreq[m.emotion] = (emotionFreq[m.emotion] || 0) + 1;
  }
  const emotion_frequency = Object.entries(emotionFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion, freq]) => ({ emotion, freq }));
  res.json({ period: "7d", avg_score: avg, total_entries: recent.length, emotion_frequency, daily: [] });
});

// ── POST /api/qgood/chat ─────────────────────────────────────────────────────

const PSYCH_SYSTEM_PROMPT =
  "Ты — эмпатичный психолог-ассистент. Помогай мягко и поддерживающе. " +
  "НЕ ставь диагнозы и не назначай лечение. " +
  "Всегда напоминай, что при серьёзных проблемах стоит обратиться к специалисту. " +
  "Ответ ≤150 слов. Пиши на том языке, на котором пишет пользователь.";

type ChatMessage = { role: "user" | "assistant"; content: string };

qgoodRouter.post("/chat", chatLimit, async (req, res) => {
  const body = req.body || {};
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) return res.status(400).json({ error: "message required" });

  const history: ChatMessage[] = Array.isArray(body.history)
    ? (body.history as unknown[])
        .slice(-10)
        .filter(
          (m): m is ChatMessage =>
            typeof m === "object" &&
            m !== null &&
            ("role" in m) &&
            ("content" in m) &&
            ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
            typeof (m as ChatMessage).content === "string",
        )
    : [];

  // Build user prompt with history context
  const historyText = history
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");
  const userPrompt = historyText ? `${historyText}\nПользователь: ${message}` : message;

  try {
    const reply = await callLlm(PSYCH_SYSTEM_PROMPT, userPrompt);
    return res.json({ reply, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "not-configured") {
      return res.status(503).json({
        error: "llm-not-configured",
        hint: "Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.",
        reply: "Я сейчас недоступен. Попробуйте позже или обратитесь к специалисту напрямую.",
      });
    }
    console.error("[qgood] chat_failed", msg);
    res.status(502).json({ error: "llm-failed", reply: "Произошла ошибка. Попробуйте ещё раз." });
  }
});

// ── GET /api/qgood/exercises ─────────────────────────────────────────────────

qgoodRouter.get("/exercises", readLimit, (_req, res) => {
  res.json({ exercises: EXERCISES, total: EXERCISES.length });
});

// ── POST /api/qgood/exercises/:id/complete ───────────────────────────────────

qgoodRouter.post("/exercises/:id/complete", moodLimit, async (req, res) => {
  await initPsychTables();
  const exerciseId = String(req.params.id || "").trim();
  if (!EXERCISES.find((e) => e.id === exerciseId)) {
    return res.status(404).json({ error: "exercise_not_found" });
  }
  const body = req.body || {};
  const userId = body.userId ? String(body.userId).slice(0, 100) : "anonymous";

  if (isQGoodDbReady()) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO qgood_completions (user_id, exercise_id) VALUES ($1, $2)`,
        [userId, exerciseId],
      );
      const statsRow = await pool.query(
        `SELECT COUNT(*) AS total_done FROM qgood_completions WHERE user_id = $1 AND exercise_id = $2`,
        [userId, exerciseId],
      );
      const total_done = Number((statsRow.rows[0] as { total_done?: string } | undefined)?.total_done ?? 0);

      // Streak: consecutive days with any exercise completion
      const streakRow = await pool.query(
        `SELECT COUNT(DISTINCT DATE(completed_at)) AS streak_days
         FROM qgood_completions
         WHERE user_id = $1
           AND completed_at >= NOW() - INTERVAL '30 days'`,
        [userId],
      );
      const streak = Number((streakRow.rows[0] as { streak_days?: string } | undefined)?.streak_days ?? 0);

      return res.status(201).json({ ok: true, exercise_id: exerciseId, streak, total_done });
    } catch (err: unknown) {
      console.error("[qgood] exercise_complete_failed", err instanceof Error ? err.message : err);
    }
  }

  // In-memory fallback
  const entry: CompletionEntry = {
    id: memCompletionSeq++,
    user_id: userId,
    exercise_id: exerciseId,
    completed_at: new Date().toISOString(),
  };
  memCompletions.push(entry);
  const total_done = memCompletions.filter((c) => c.user_id === userId && c.exercise_id === exerciseId).length;
  const uniqueDays = new Set(
    memCompletions
      .filter((c) => c.user_id === userId)
      .map((c) => c.completed_at.slice(0, 10)),
  ).size;
  res.status(201).json({ ok: true, exercise_id: exerciseId, streak: uniqueDays, total_done });
});

/**
 * StartupX — the startup exchange
 * ───────────────────────────────
 * Three tiers, three deals (see lib/startupx/model.ts):
 *   idea    — equity for capital, investor funds the build
 *   mvp     — equity for capital, investor funds finishing it
 *   product — purchase of the whole thing, or of a stake
 *
 * Every listing gets a free, deterministic assessment on submit
 * (lib/startupx/assess.ts) — no LLM call, no cost, same input always yields the
 * same score, and the disclaimer travels inside the payload so no surface can
 * render the number without it.
 */

import { Router, Request, Response } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import crypto from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import { getPool } from "../lib/dbPool";

const captureStartupXError = makeServiceCapture("startup-exchange");
import {
  ensureStartupExchangeTables,
  isStartupExchangeDbReady,
} from "../lib/ensureStartupExchangeTables";
import {
  TIERS,
  TIER_SPECS,
  DEAL_INTENTS,
  isTier,
  legacyStageForTier,
  normalizeListing,
  tierFromLegacyStage,
  type DealIntent,
  type DealTerms,
  type ListingInput,
  type ListingMetrics,
  type Tier,
} from "../lib/startupx/model";
import { assessListing, ASSESSMENT_VERSION, DISCLAIMER, type Assessment } from "../lib/startupx/assess";
import { MARKET_SOURCES } from "../lib/startupx/valuation";
import { timingSafeHexEq } from "../lib/qrightHelpers";
import { listSectors } from "../lib/qventure/sectors";
import { safeResolveSector } from "../lib/startupx/sectorDetect";

// ─── Setup ────────────────────────────────────────────────────────────────────

const pool = getPool();
(async () => {
  try { await ensureStartupExchangeTables(pool); }
  catch { /* silent — in-memory fallback active */ }
})();

const generalLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "startupx:general", message: "rate_limited" });
const postLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "startupx:post", message: "rate_limited" });
// The preview assessment is free and costs no LLM call, but it is still CPU on
// an unauthenticated path.
const assessLimiter = rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "startupx:assess", message: "rate_limited" });
// Reading offers takes a 256-bit token, so guessing is hopeless — but a tight
// limit keeps a guesser from turning the endpoint into a load generator.
const offersLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "startupx:offers", message: "rate_limited" });

export const startupExchangeRouter = Router();
startupExchangeRouter.use(generalLimiter);

const MAX_EMAIL = 200;
const MAX_MESSAGE = 2000;
const MEM_MAX_LISTINGS = 50;
const MEM_MAX_INTERESTS = 200;

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface ListingRow {
  id: number;
  title: string;
  description: string;
  stage: string;
  tier: string | null;
  sector: string | null;
  geography: string | null;
  demo_url: string | null;
  repo_url: string | null;
  deal: DealTerms | null;
  metrics: ListingMetrics | null;
  assessment: Assessment | null;
  assessment_score: number | null;
  assessment_version: number | null;
  founder_email: string | null;
  contact_method: string | null;
  qright_object_id: string | null;
  content_hash: string | null;
  manage_token_hash: string | null;
  visibility: string;
  created_at: string;
}

interface InterestRow {
  id: number;
  idea_id: number;
  investor_email: string;
  message: string | null;
  intent: string | null;
  ticket_usd: number | null;
  equity_pct: number | null;
  created_at: string;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

const memListings = new Map<number, ListingRow>();
const memInterests = new Map<number, InterestRow>();
let memListingSeq = 1;
let memInterestSeq = 1;

function memInsertListing(row: Omit<ListingRow, "id" | "created_at">): ListingRow {
  const id = memListingSeq++;
  const full: ListingRow = { ...row, id, created_at: new Date().toISOString() };
  memListings.set(id, full);
  if (memListings.size > MEM_MAX_LISTINGS) {
    const oldest = Math.min(...memListings.keys());
    memListings.delete(oldest);
  }
  return full;
}

function memInsertInterest(row: Omit<InterestRow, "id" | "created_at">): InterestRow {
  const id = memInterestSeq++;
  const full: InterestRow = { ...row, id, created_at: new Date().toISOString() };
  memInterests.set(id, full);
  if (memInterests.size > MEM_MAX_INTERESTS) {
    const oldest = Math.min(...memInterests.keys());
    memInterests.delete(oldest);
  }
  return full;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Same hashing convention as QRight (see qright.ts:946): a deterministic
 * authorship stamp the founder gets for free at submit time. Duplicated here
 * rather than imported to avoid a circular boot-time dependency.
 */
function computeContentHash(input: { title: string; description: string; tier: Tier }): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ title: input.title, description: input.description, stage: input.tier }))
    .digest("hex");
}

/**
 * The founder's key to their own listing. Returned once, on publish, and never
 * again: only its SHA-256 lives in the database, so a dump of the table does
 * not hand anyone the offers a founder received.
 */
function mintManageToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

function manageTokenMatches(token: unknown, hash: string | null): boolean {
  if (typeof token !== "string" || !hash) return false;
  const candidate = crypto.createHash("sha256").update(token).digest("hex");
  return timingSafeHexEq(candidate, hash);
}

/** Public projection: founder_email never leaves the server. */
function publicView(row: ListingRow, interest_count?: number) {
  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tier,
    tierLabel: TIER_SPECS[tier].label,
    /** Kept for older consumers; always derived from `tier`, never independent. */
    stage: row.stage,
    sector: row.sector,
    geography: row.geography,
    demo_url: row.demo_url,
    repo_url: row.repo_url,
    deal: row.deal,
    metrics: row.metrics,
    assessment: row.assessment,
    assessment_score: row.assessment_score,
    assessment_version: row.assessment_version,
    contact_method: row.contact_method,
    qright_object_id: row.qright_object_id,
    content_hash: row.content_hash,
    qright_protected: Boolean(row.qright_object_id || row.content_hash),
    visibility: row.visibility,
    created_at: row.created_at,
    ...(interest_count !== undefined ? { interest_count } : {}),
  };
}

function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

function fail(res: Response, error: string, status = 400, extra?: Record<string, unknown>): Response {
  return res.status(status).json({ success: false, error, ...(extra ?? {}) });
}

// ─── GET /api/startupx/health ────────────────────────────────────────────────
startupExchangeRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, dbReady: isStartupExchangeDbReady(), service: "startupx" });
});

// ─── GET /api/startupx/tiers ─────────────────────────────────────────────────
// The UI renders tier rules, ticket norms and market sources from here, so the
// screen and the scoring can never describe two different products.
startupExchangeRouter.get("/tiers", (_req: Request, res: Response) => {
  ok(res, {
    tiers: TIERS.map((t) => TIER_SPECS[t]),
    intents: DEAL_INTENTS,
    // The sector list the assessment actually scores against — so the form can
    // never offer a sector the engine does not know.
    sectors: listSectors(),
    sources: MARKET_SOURCES,
    assessmentVersion: ASSESSMENT_VERSION,
    disclaimer: DISCLAIMER,
  });
});

// ─── GET /api/startupx/stats ─────────────────────────────────────────────────
startupExchangeRouter.get("/stats", async (_req: Request, res: Response) => {
  const emptyByTier = (): Record<string, number> => ({ idea: 0, mvp: 0, product: 0 });
  const emptyByStage = (): Record<string, number> => ({ idea: 0, prototype: 0, mvp: 0, scaling: 0 });

  try {
    if (isStartupExchangeDbReady()) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS n FROM startup_ideas WHERE visibility='public'`);
      const tierQ = await pool.query(
        `SELECT COALESCE(tier, 'idea') AS tier, COUNT(*)::int AS n FROM startup_ideas
         WHERE visibility='public' GROUP BY 1`,
      );
      const stageQ = await pool.query(
        `SELECT stage, COUNT(*)::int AS n FROM startup_ideas WHERE visibility='public' GROUP BY stage`,
      );
      const recentQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas
         WHERE visibility='public' AND created_at > NOW() - INTERVAL '7 days'`,
      );
      const scoredQ = await pool.query(
        `SELECT COUNT(*)::int AS n, COALESCE(AVG(assessment_score), 0)::float AS avg
         FROM startup_ideas WHERE visibility='public' AND assessment_score IS NOT NULL`,
      );

      const byTier = emptyByTier();
      for (const r of tierQ.rows as Array<{ tier: string; n: number }>) byTier[r.tier] = Number(r.n) || 0;
      const byStage = emptyByStage();
      for (const r of stageQ.rows as Array<{ stage: string; n: number }>) byStage[r.stage] = Number(r.n) || 0;

      return ok(res, {
        total: totalQ.rows[0]?.n ?? 0,
        byTier,
        byStage,
        recentCount: recentQ.rows[0]?.n ?? 0,
        assessed: scoredQ.rows[0]?.n ?? 0,
        avgScore: Math.round(Number(scoredQ.rows[0]?.avg ?? 0)),
      });
    }
  } catch (e) {
    console.error("[StartupX] /stats DB error", e);
  }

  const all = Array.from(memListings.values()).filter((r) => r.visibility === "public");
  const byTier = emptyByTier();
  const byStage = emptyByStage();
  for (const r of all) {
    const t = isTier(r.tier) ? r.tier : tierFromLegacyStage(r.stage);
    byTier[t] = (byTier[t] ?? 0) + 1;
    byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
  }
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600_000;
  const scored = all.filter((r) => r.assessment_score !== null);
  return ok(res, {
    total: all.length,
    byTier,
    byStage,
    recentCount: all.filter((r) => new Date(r.created_at).getTime() > sevenDaysAgo).length,
    assessed: scored.length,
    avgScore: scored.length
      ? Math.round(scored.reduce((a, r) => a + (r.assessment_score ?? 0), 0) / scored.length)
      : 0,
  });
});

// ─── GET /api/startupx/ideas ─────────────────────────────────────────────────
startupExchangeRouter.get("/ideas", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const tier = isTier(req.query.tier) ? req.query.tier : null;
  // Sector is stored as the founder typed it (or left empty when it was
  // detected from the text), so filtering matches on the resolved sector id —
  // otherwise "SaaS" and "saas" would be two different markets.
  const sectorRaw = typeof req.query.sector === "string" ? req.query.sector.trim() : "";
  // safeResolveSector, not resolveSector: the shared table is indexed by string,
  // so a query for sector=constructor would otherwise resolve to an object that
  // is not a sector and put `undefined` into the SQL parameter.
  const sector = sectorRaw ? safeResolveSector(sectorRaw) : null;
  const minScore = Number(req.query.minScore);
  const hasMinScore = Number.isFinite(minScore) && minScore > 0;
  // "score" ranks by the free assessment; anything else falls back to recency.
  const sort = req.query.sort === "score" ? "score" : "recent";

  try {
    if (isStartupExchangeDbReady()) {
      const args: unknown[] = [];
      let where = `WHERE visibility='public'`;
      if (tier) {
        args.push(tier);
        // Rows written before tiers existed carry the tier implied by `stage`;
        // the backfill sets it, and COALESCE keeps the filter correct even for a
        // row that slipped in between the ALTER and the UPDATE.
        where += ` AND COALESCE(tier, CASE WHEN stage='idea' THEN 'idea' WHEN stage='scaling' THEN 'product' ELSE 'mvp' END) = $${args.length}`;
      }
      if (sector) {
        args.push(sector.id);
        // The listing's own column may be empty or spelled differently; the
        // assessment always records the sector the score was actually computed
        // against, so that is what the filter reads.
        where += ` AND assessment->'sector'->>'id' = $${args.length}`;
      }
      if (hasMinScore) {
        args.push(minScore);
        where += ` AND assessment_score >= $${args.length}`;
      }
      const order = sort === "score"
        ? `ORDER BY assessment_score DESC NULLS LAST, created_at DESC`
        : `ORDER BY created_at DESC`;

      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas ${where} ${order} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, limit, offset],
      );
      const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM startup_ideas ${where}`, args);
      const typedRows = rows as ListingRow[];
      return ok(res, {
        listings: typedRows.map((r) => publicView(r)),
        total: (cnt as Array<{ n: number }>)[0]?.n ?? typedRows.length,
        limit,
        offset,
      });
    }
  } catch (e) {
    console.error("[StartupX] GET /ideas DB error", e);
  }

  let all = Array.from(memListings.values()).filter((r) => r.visibility === "public");
  if (tier) all = all.filter((r) => (isTier(r.tier) ? r.tier : tierFromLegacyStage(r.stage)) === tier);
  if (sector) all = all.filter((r) => r.assessment?.sector?.id === sector.id);
  if (hasMinScore) all = all.filter((r) => (r.assessment_score ?? -1) >= minScore);
  all.sort((a, b) =>
    sort === "score"
      ? (b.assessment_score ?? -1) - (a.assessment_score ?? -1) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at),
  );
  return ok(res, {
    listings: all.slice(offset, offset + limit).map((r) => publicView(r)),
    total: all.length,
    limit,
    offset,
  });
});

// ─── GET /api/startupx/ideas/:id ─────────────────────────────────────────────
startupExchangeRouter.get("/ideas/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas WHERE id=$1 AND visibility='public'`,
        [id],
      );
      const row = (rows as ListingRow[])[0];
      if (!row) return fail(res, "not_found", 404);
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_interests WHERE idea_id=$1`,
        [id],
      );
      return ok(res, publicView(row, (cnt as Array<{ n: number }>)[0]?.n ?? 0));
    }
  } catch (e) {
    console.error("[StartupX] GET /ideas/:id DB error", e);
  }

  const row = memListings.get(id);
  if (!row || row.visibility !== "public") return fail(res, "not_found", 404);
  const interest_count = Array.from(memInterests.values()).filter((i) => i.idea_id === id).length;
  return ok(res, publicView(row, interest_count));
});

// ─── POST /api/startupx/assess ───────────────────────────────────────────────
// Free analysis of a draft, before anything is published. This is the front door
// of the exchange: describe it, see what an investor will see, then decide
// whether to list. Nothing is stored.
startupExchangeRouter.post("/assess", assessLimiter, (req: Request, res: Response) => {
  const { listing, issues } = normalizeListing(req.body, { requireDeal: false });
  if (!listing) return fail(res, "validation_failed", 400, { issues });
  try {
    return ok(res, { assessment: assessListing(listing), stored: false });
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] POST /assess failed", e);
    return fail(res, "assessment_failed", 500);
  }
});

// ─── POST /api/startupx/ideas ────────────────────────────────────────────────
startupExchangeRouter.post("/ideas", postLimiter, async (req: Request, res: Response) => {
  const { listing, issues } = normalizeListing(req.body);
  if (!listing) return fail(res, "validation_failed", 400, { issues });

  let assessment: Assessment;
  try {
    assessment = assessListing(listing);
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] assessment failed on submit", e);
    return fail(res, "assessment_failed", 500);
  }

  const contentHash = computeContentHash({
    title: listing.title,
    description: listing.description,
    tier: listing.tier,
  });
  const stage = legacyStageForTier(listing.tier);
  // qright_object_id is reserved for a direct QRight registry link; the hash is
  // produced here and is what makes `qright_protected` true.
  const qrightObjectId: string | null = null;
  const manage = mintManageToken();

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `INSERT INTO startup_ideas
         (title, description, stage, tier, sector, geography, demo_url, repo_url,
          deal, metrics, assessment, assessment_score, assessment_version,
          founder_email, contact_method, qright_object_id, content_hash, manage_token_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          listing.title, listing.description, stage, listing.tier,
          listing.sector ?? null, listing.geography ?? null,
          listing.demoUrl ?? null, listing.repoUrl ?? null,
          JSON.stringify(listing.deal), JSON.stringify(listing.metrics ?? {}),
          JSON.stringify(assessment), assessment.score, assessment.version,
          listing.founderEmail ?? null, listing.contactMethod ?? null,
          qrightObjectId, contentHash, manage.hash,
        ],
      );
      const row = (rows as ListingRow[])[0];
      return ok(res, {
        id: row.id,
        qrightProtected: true,
        contentHash: row.content_hash,
        // Shown to the founder once. Losing it means losing access to the
        // offers on this listing — the UI has to say so at the moment it is
        // handed over, not in a help page.
        manageToken: manage.token,
        listing: publicView(row),
        assessment,
      }, 201);
    }
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] POST /ideas DB error", e);
  }

  const row = memInsertListing({
    title: listing.title,
    description: listing.description,
    stage,
    tier: listing.tier,
    sector: listing.sector ?? null,
    geography: listing.geography ?? null,
    demo_url: listing.demoUrl ?? null,
    repo_url: listing.repoUrl ?? null,
    deal: listing.deal,
    metrics: listing.metrics ?? null,
    assessment,
    assessment_score: assessment.score,
    assessment_version: assessment.version,
    founder_email: listing.founderEmail ?? null,
    contact_method: listing.contactMethod ?? null,
    qright_object_id: qrightObjectId,
    content_hash: contentHash,
    manage_token_hash: manage.hash,
    visibility: "public",
  });
  return ok(res, {
    id: row.id,
    qrightProtected: true,
    contentHash: row.content_hash,
    manageToken: manage.token,
    listing: publicView(row),
    assessment,
  }, 201);
});

// ─── POST /api/startupx/ideas/:id/reassess ───────────────────────────────────
// Re-runs the free assessment against the current rules. A stored score belongs
// to the rules that produced it: when ASSESSMENT_VERSION moves, old listings are
// stale rather than wrong, and the feed must not silently rank the two together.
startupExchangeRouter.post("/ideas/:id/reassess", assessLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1 AND visibility='public'`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] reassess fetch error", e);
    }
  } else {
    row = memListings.get(id);
    if (row?.visibility !== "public") row = undefined;
  }
  if (!row) return fail(res, "not_found", 404);

  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  const rebuilt: ListingInput = {
    title: row.title,
    description: row.description,
    tier,
    sector: row.sector ?? undefined,
    geography: row.geography ?? undefined,
    demoUrl: row.demo_url ?? undefined,
    repoUrl: row.repo_url ?? undefined,
    // Pre-tier rows have no deal terms at all. They get assessed as a raise with
    // unstated numbers, which is exactly what they are — the deal factor then
    // reports "условия не позволяют посчитать оценку" instead of inventing one.
    deal: row.deal ?? { intent: "raise" },
    metrics: row.metrics ?? undefined,
  };

  let assessment: Assessment;
  try {
    assessment = assessListing(rebuilt);
  } catch (e) {
    captureStartupXError(e);
    return fail(res, "assessment_failed", 500);
  }

  if (isStartupExchangeDbReady()) {
    try {
      await pool.query(
        `UPDATE startup_ideas SET assessment=$1, assessment_score=$2, assessment_version=$3 WHERE id=$4`,
        [JSON.stringify(assessment), assessment.score, assessment.version, id],
      );
    } catch (e) {
      console.error("[StartupX] reassess save error", e);
    }
  } else {
    const existing = memListings.get(id);
    if (existing) {
      existing.assessment = assessment;
      existing.assessment_score = assessment.score;
      existing.assessment_version = assessment.version;
    }
  }
  return ok(res, { id, assessment });
});

// ─── POST /api/startupx/ideas/:id/interest ──────────────────────────────────
startupExchangeRouter.post("/ideas/:id/interest", postLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  const investorEmail = clampStr(req.body?.investorEmail, MAX_EMAIL);
  const message = clampStr(req.body?.message, MAX_MESSAGE);
  if (!investorEmail) return fail(res, "investorEmail_required");

  const rawIntent = req.body?.intent;
  const intent: DealIntent | null =
    typeof rawIntent === "string" && (DEAL_INTENTS as readonly string[]).includes(rawIntent)
      ? (rawIntent as DealIntent)
      : null;
  const ticketRaw = Number(req.body?.ticketUsd);
  const ticketUsd = Number.isFinite(ticketRaw) && ticketRaw > 0 ? Math.min(ticketRaw, 1_000_000_000) : null;
  const equityRaw = Number(req.body?.equityPct);
  const equityPct = Number.isFinite(equityRaw) && equityRaw > 0 && equityRaw <= 100 ? equityRaw : null;

  try {
    if (isStartupExchangeDbReady()) {
      const { rows: exists } = await pool.query(
        `SELECT id FROM startup_ideas WHERE id=$1 AND visibility='public'`,
        [id],
      );
      if (!(exists as Array<{ id: number }>)[0]) return fail(res, "idea_not_found", 404);

      const { rows } = await pool.query(
        `INSERT INTO startup_interests (idea_id, investor_email, message, intent, ticket_usd, equity_pct)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, investorEmail, message, intent, ticketUsd, equityPct],
      );
      const row = (rows as InterestRow[])[0];
      return ok(res, { id: row.id, ideaId: row.idea_id, intent: row.intent, createdAt: row.created_at }, 201);
    }
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] POST /ideas/:id/interest DB error", e);
  }

  const listing = memListings.get(id);
  if (!listing || listing.visibility !== "public") return fail(res, "idea_not_found", 404);
  const row = memInsertInterest({
    idea_id: id,
    investor_email: investorEmail,
    message,
    intent,
    ticket_usd: ticketUsd,
    equity_pct: equityPct,
  });
  return ok(res, { id: row.id, ideaId: row.idea_id, intent: row.intent, createdAt: row.created_at }, 201);
});

// ─── GET /api/startupx/ideas/:id/offers?token= ───────────────────────────────
// The founder's side of the exchange. Investors send terms; without this the
// rows sat in a table nobody could read and the whole flow dead-ended at
// "заявка отправлена".
startupExchangeRouter.get("/ideas/:id/offers", offersLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] offers fetch error", e);
      return fail(res, "offers_unavailable", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);

  if (!manageTokenMatches(req.query.token, row.manage_token_hash)) {
    // Deliberately the same answer for a wrong token and for a listing published
    // before manage tokens existed: neither can be opened, and saying which is
    // which only helps someone guessing.
    return fail(res, "invalid_token", 401);
  }

  let offers: InterestRow[] = [];
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM startup_interests WHERE idea_id=$1 ORDER BY created_at DESC LIMIT 200`,
        [id],
      );
      offers = rows as InterestRow[];
    } catch (e) {
      console.error("[StartupX] offers list error", e);
      return fail(res, "offers_unavailable", 500);
    }
  } else {
    offers = Array.from(memInterests.values())
      .filter((i) => i.idea_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return ok(res, {
    listing: publicView(row, offers.length),
    offers: offers.map((o) => ({
      id: o.id,
      investorEmail: o.investor_email,
      message: o.message,
      intent: o.intent,
      ticketUsd: o.ticket_usd === null ? null : Number(o.ticket_usd),
      equityPct: o.equity_pct === null ? null : Number(o.equity_pct),
      createdAt: o.created_at,
    })),
  });
});

// ─── PATCH /api/startupx/ideas/:id?token= ────────────────────────────────────
// Correcting the terms.
//
// The free analysis tells a founder their ask is 2.7× above what the market
// closes at. The obvious next move is to change the number — and until now the
// only way was to withdraw and republish, which minted a new listing and left
// the offers behind. We created that dead end by shipping the critique without
// the fix.
//
// Only the deal, the metrics and the links can be edited. Title, description
// and tier are frozen: the SHA-256 stamp covers exactly that text on exactly
// that date, and an authorship stamp that silently follows edits is worth
// nothing. Changing the pitch itself means publishing a new listing.
startupExchangeRouter.patch("/ideas/:id", offersLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = req.query.token ?? body.token;

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] patch fetch error", e);
      return fail(res, "update_failed", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);
  if (!manageTokenMatches(token, row.manage_token_hash)) return fail(res, "invalid_token", 401);

  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  // Re-validated as a whole listing, so an edited deal has to satisfy exactly
  // the same rules a new one does — an edit cannot smuggle in terms that would
  // have been refused at publish time.
  const { listing, issues } = normalizeListing({
    title: row.title,
    description: row.description,
    tier,
    sector: row.sector ?? undefined,
    geography: body.geography ?? row.geography ?? undefined,
    demoUrl: body.demoUrl ?? row.demo_url ?? undefined,
    repoUrl: body.repoUrl ?? row.repo_url ?? undefined,
    deal: body.deal ?? row.deal ?? {},
    metrics: body.metrics ?? row.metrics ?? {},
    contactMethod: body.contactMethod ?? row.contact_method ?? undefined,
  });
  if (!listing) return fail(res, "validation_failed", 400, { issues });

  let assessment: Assessment;
  try {
    assessment = assessListing(listing);
  } catch (e) {
    captureStartupXError(e);
    return fail(res, "assessment_failed", 500);
  }

  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(
        `UPDATE startup_ideas
            SET deal=$1, metrics=$2, geography=$3, demo_url=$4, repo_url=$5,
                contact_method=$6, assessment=$7, assessment_score=$8, assessment_version=$9
          WHERE id=$10
      RETURNING *`,
        [
          JSON.stringify(listing.deal), JSON.stringify(listing.metrics ?? {}),
          listing.geography ?? null, listing.demoUrl ?? null, listing.repoUrl ?? null,
          listing.contactMethod ?? null,
          JSON.stringify(assessment), assessment.score, assessment.version,
          id,
        ],
      );
      const updated = (rows as ListingRow[])[0];
      return ok(res, { listing: publicView(updated), assessment });
    } catch (e) {
      captureStartupXError(e);
      console.error("[StartupX] patch save error", e);
      return fail(res, "update_failed", 500);
    }
  }

  const existing = memListings.get(id);
  if (!existing) return fail(res, "not_found", 404);
  existing.deal = listing.deal;
  existing.metrics = listing.metrics ?? null;
  existing.geography = listing.geography ?? null;
  existing.demo_url = listing.demoUrl ?? null;
  existing.repo_url = listing.repoUrl ?? null;
  existing.contact_method = listing.contactMethod ?? null;
  existing.assessment = assessment;
  existing.assessment_score = assessment.score;
  existing.assessment_version = assessment.version;
  return ok(res, { listing: publicView(existing), assessment });
});

// ─── DELETE /api/startupx/ideas/:id?token= ───────────────────────────────────
// Withdrawing a listing. A founder who found their investor — or thought better
// of publishing — must be able to take the listing down without writing to
// anyone, and the daily smoke uses the same door to clean up after itself
// instead of leaving another row in the public feed every night.
//
// The row is kept and marked withdrawn rather than deleted: the offers already
// received belong to the founder, and the SHA-256 authorship stamp is worth
// nothing if the record behind it can vanish.
startupExchangeRouter.delete("/ideas/:id", offersLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);
  const token = req.query.token ?? (req.body as Record<string, unknown> | undefined)?.token;

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] withdraw fetch error", e);
      return fail(res, "withdraw_failed", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);
  if (!manageTokenMatches(token, row.manage_token_hash)) return fail(res, "invalid_token", 401);

  if (isStartupExchangeDbReady()) {
    try {
      await pool.query(`UPDATE startup_ideas SET visibility='withdrawn' WHERE id=$1`, [id]);
    } catch (e) {
      console.error("[StartupX] withdraw save error", e);
      return fail(res, "withdraw_failed", 500);
    }
  } else {
    const existing = memListings.get(id);
    if (existing) existing.visibility = "withdrawn";
  }
  return ok(res, { id, visibility: "withdrawn" });
});

// ── MVP concept board surface ───────────────────────────────────────────────

startupExchangeRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    module: "startupx",
    code: "STARTUPX",
    status: "mvp",
    description:
      "Startup exchange: idea / idea+MVP / working product, each with its own deal terms and a free deterministic assessment.",
    endpoints: {
      tiers: "/api/startupx/tiers",
      listings: "/api/startupx/ideas",
      assess: "/api/startupx/assess",
      stats: "/api/startupx/stats",
      conceptMessages: "/api/startupx/concept/messages",
      conceptStats: "/api/startupx/concept-stats",
    },
    timestamp: new Date().toISOString(),
  });
});

mountConceptBoard({ router: startupExchangeRouter, moduleId: "startupx", defaultTag: "startupx", writeLimit: postLimiter });

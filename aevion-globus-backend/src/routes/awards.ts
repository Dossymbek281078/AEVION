import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { refererHost } from "../lib/qrightHelpers";
import { applyOgEtag, applyEtag } from "../lib/ogEtag";

export const awardsRouter = Router();

const pool = getPool();

// Public surfaces (results / leaderboard / badge / embed) hit by third
// parties; cap aggressively per IP but with headroom.
const awardsEmbedRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "awards:embed",
});

// Award types map 1:1 to Planet productKey prefixes.
// Adding a type? Add its prefix here and the rest of the surface lights up.
const AWARD_TYPE_TO_PRODUCT_PREFIX: Record<string, string> = {
  music: "awards.music",
  film: "awards.film",
  code: "awards.code",
  design: "awards.design",
  science: "awards.science",
};
const AWARD_TYPES = new Set(Object.keys(AWARD_TYPE_TO_PRODUCT_PREFIX));
const AWARD_SEASON_STATUSES = new Set([
  "draft",
  "open",       // accepting entries
  "voting",     // voting window open
  "closed",     // voting closed, awaiting finalize
  "finalized",  // medals awarded
]);
const AWARD_ENTRY_STATUSES = new Set([
  "pending",       // submitted, not yet reviewed
  "qualified",     // admin approved for the leaderboard
  "disqualified",  // admin removed
]);

// ─────────────────────────────────────────────────────────────────────────
// Schema bootstrap
// ─────────────────────────────────────────────────────────────────────────

let ensuredAwardsTables = false;
async function ensureAwardsTables(): Promise<void> {
  if (ensuredAwardsTables) return;

  // A "season" — one cycle of an award (e.g. AEVION Music Awards 2026 Q2).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AwardSeason" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "startsAt" TIMESTAMPTZ,
      "endsAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdBy" TEXT
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardSeason_type_status_idx" ON "AwardSeason" ("type", "status");`
  );

  // An entry binds a Planet artifact (productKey + artifactVersionId) to a
  // season. Status flips from pending → qualified/disqualified by admin.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AwardEntry" (
      "id" TEXT PRIMARY KEY,
      "seasonId" TEXT NOT NULL,
      "artifactVersionId" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "qualifiedAt" TIMESTAMPTZ,
      "qualifiedBy" TEXT,
      "disqualifyReason" TEXT,
      "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "embedFetches" BIGINT NOT NULL DEFAULT 0,
      UNIQUE ("seasonId", "artifactVersionId")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardEntry_season_status_idx" ON "AwardEntry" ("seasonId", "status");`
  );

  // Medal — frozen at finalize time. We snapshot the score so the display
  // stays stable even if more votes trickle in afterward.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AwardMedal" (
      "id" TEXT PRIMARY KEY,
      "seasonId" TEXT NOT NULL,
      "place" INT NOT NULL,
      "entryId" TEXT NOT NULL,
      "artifactVersionId" TEXT NOT NULL,
      "voteCount" INT NOT NULL DEFAULT 0,
      "voteAverage" NUMERIC(5,2),
      "score" NUMERIC(10,4),
      "awardedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("seasonId", "place")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardMedal_season_idx" ON "AwardMedal" ("seasonId", "place");`
  );

  // Per-Referer fetch buckets for embed/badge (privacy: hostname only).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AwardEntryFetchSource" (
      "entryId" TEXT NOT NULL,
      "sourceHost" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("entryId", "sourceHost", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardEntryFetchSource_entry_day_idx" ON "AwardEntryFetchSource" ("entryId", "day");`
  );

  // Append-only audit of admin actions (qualify, disqualify, finalize, season CRUD).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AwardAuditLog" (
      "id" TEXT PRIMARY KEY,
      "actor" TEXT,
      "action" TEXT NOT NULL,
      "targetId" TEXT,
      "payload" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardAuditLog_at_idx" ON "AwardAuditLog" ("at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AwardAuditLog_action_idx" ON "AwardAuditLog" ("action");`
  );

  ensuredAwardsTables = true;
}

// ─────────────────────────────────────────────────────────────────────────
// Auth + helpers
// ─────────────────────────────────────────────────────────────────────────

function verifyBearerOptional(req: any): { sub: string; email?: string; role?: string } | null {
  const header = req.headers?.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
    return jwt.verify(token, secret) as any;
  } catch {
    return null;
  }
}

function getAwardsAdminAllowlist(): Set<string> {
  const raw = (process.env.AWARDS_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set<string>();
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

function isAwardsAdmin(auth: { role?: string; email?: string } | null): boolean {
  if (!auth) return false;
  if (auth.role === "admin" || auth.role === "ADMIN") return true;
  if (!auth.email) return false;
  return getAwardsAdminAllowlist().has(auth.email.toLowerCase());
}

function recordAwardsAudit(
  actor: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown> | null
): void {
  pool
    .query(
      `INSERT INTO "AwardAuditLog" ("id", "actor", "action", "targetId", "payload")
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), actor, action, targetId, payload ? JSON.stringify(payload) : null]
    )
    .catch((err: Error) => {
      console.warn(`[awards] audit insert failed action=${action}:`, err.message);
    });
}

function bumpEntryFetchCounter(
  req: { headers: Record<string, string | string[] | undefined> },
  entryId: string
): void {
  pool
    .query(`UPDATE "AwardEntry" SET "embedFetches" = "embedFetches" + 1 WHERE "id" = $1`, [entryId])
    .catch(() => {});
  const host = refererHost(req);
  pool
    .query(
      `INSERT INTO "AwardEntryFetchSource" ("entryId", "sourceHost", "day", "fetches")
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT ("entryId", "sourceHost", "day")
       DO UPDATE SET "fetches" = "AwardEntryFetchSource"."fetches" + 1`,
      [entryId, host]
    )
    .catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────
// Public surfaces
// ─────────────────────────────────────────────────────────────────────────

// 🔹 GET /seasons — list, filter by type/status.
awardsRouter.get("/seasons", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const type = String(req.query.type || "").trim();
    const status = String(req.query.status || "").trim();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (type) {
      params.push(type);
      conds.push(`"type" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conds.push(`"status" = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const r = await pool.query(
      `SELECT "id","code","type","title","status","startsAt","endsAt","createdAt"
       FROM "AwardSeason"
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT 200`,
      params
    );
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        ...row,
        startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
        endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt,
        createdAt:
          row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "seasons failed", details: err.message });
  }
});

// 🔹 GET /seasons/current/:type — newest non-finalized season for a type.
//    Used by the AwardPortal landing to know "where to send new entries".
awardsRouter.get("/seasons/current/:type", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const type = String(req.params.type);
    if (!AWARD_TYPES.has(type)) {
      return res.status(400).json({ error: "unknown award type", allowed: Array.from(AWARD_TYPES) });
    }
    const r = await pool.query(
      `SELECT "id","code","type","title","status","startsAt","endsAt"
       FROM "AwardSeason"
       WHERE "type" = $1 AND "status" <> 'finalized'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [type]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: "no active season", type });
    }
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const row = r.rows[0] as any;
    res.json({
      ...row,
      startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
      endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt,
      productKeyPrefix: AWARD_TYPE_TO_PRODUCT_PREFIX[type],
    });
  } catch (err: any) {
    res.status(500).json({ error: "current failed", details: err.message });
  }
});

// 🔹 GET /:type/leaderboard — current-season qualified entries scored by votes.
//    Pulls vote stats live from PlanetVote + qualified-entry list from AwardEntry.
awardsRouter.get("/:type/leaderboard", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const type = String(req.params.type);
    if (!AWARD_TYPES.has(type)) {
      return res.status(400).json({ error: "unknown award type" });
    }
    const limitRaw = parseInt(String(req.query.limit || "25"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;

    const seasonR = await pool.query(
      `SELECT "id","code","title","status"
       FROM "AwardSeason"
       WHERE "type" = $1 AND "status" <> 'finalized'
       ORDER BY "createdAt" DESC LIMIT 1`,
      [type]
    );
    if (seasonR.rowCount === 0) {
      return res.json({ season: null, items: [] });
    }
    const season = seasonR.rows[0];

    // Score = vote count weighted by avg score (Bayesian-ish — heavy
    // simplification, but stable enough for a leaderboard MVP).
    const r = await pool.query(
      `SELECT e."id" AS "entryId", e."artifactVersionId",
              s."title" AS "submissionTitle", v."artifactType",
              COALESCE(stats."voteCount", 0)::int AS "voteCount",
              stats."voteAvg"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       LEFT JOIN (
         SELECT "artifactVersionId",
                COUNT(*) AS "voteCount",
                AVG("score")::numeric(5,2) AS "voteAvg"
         FROM "PlanetVote"
         GROUP BY "artifactVersionId"
       ) stats ON stats."artifactVersionId" = e."artifactVersionId"
       WHERE e."seasonId" = $1 AND e."status" = 'qualified'
       ORDER BY COALESCE(stats."voteCount", 0) DESC, stats."voteAvg" DESC NULLS LAST
       LIMIT $2`,
      [season.id, limit]
    );

    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      season: {
        id: season.id,
        code: season.code,
        title: season.title,
        status: season.status,
      },
      items: r.rows.map((row: any, i: number) => ({
        rank: i + 1,
        entryId: row.entryId,
        artifactVersionId: row.artifactVersionId,
        submissionTitle: row.submissionTitle,
        artifactType: row.artifactType,
        voteCount: Number(row.voteCount) || 0,
        voteAverage: row.voteAvg !== null ? Number(row.voteAvg) : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "leaderboard failed", details: err.message });
  }
});

// 🔹 GET /:seasonId/results — frozen medal list for a finalized season.
awardsRouter.get("/seasons/:seasonId/results", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const seasonId = String(req.params.seasonId);
    const seasonR = await pool.query(
      `SELECT "id","code","title","type","status" FROM "AwardSeason" WHERE "id"=$1 LIMIT 1`,
      [seasonId]
    );
    if (seasonR.rowCount === 0) return res.status(404).json({ error: "season not found" });
    const season = seasonR.rows[0];

    const medals = await pool.query(
      `SELECT m."place", m."entryId", m."artifactVersionId", m."voteCount", m."voteAverage", m."score", m."awardedAt",
              s."title" AS "submissionTitle", v."artifactType"
       FROM "AwardMedal" m
       JOIN "PlanetArtifactVersion" v ON v."id" = m."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       WHERE m."seasonId" = $1
       ORDER BY m."place" ASC`,
      [seasonId]
    );

    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      season,
      medals: medals.rows.map((row: any) => ({
        place: row.place,
        entryId: row.entryId,
        artifactVersionId: row.artifactVersionId,
        submissionTitle: row.submissionTitle,
        artifactType: row.artifactType,
        voteCount: Number(row.voteCount) || 0,
        voteAverage: row.voteAverage !== null ? Number(row.voteAverage) : null,
        score: row.score !== null ? Number(row.score) : null,
        awardedAt:
          row.awardedAt instanceof Date ? row.awardedAt.toISOString() : row.awardedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "results failed", details: err.message });
  }
});

// 🔹 GET /entries/:entryId/embed — sanitized entry JSON for third-party embeds.
awardsRouter.get("/entries/:entryId/embed", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const entryId = String(req.params.entryId);
    const r = await pool.query(
      `SELECT e."id", e."seasonId", e."artifactVersionId", e."status", e."submittedAt",
              e."qualifiedAt", e."embedFetches",
              s."title" AS "submissionTitle", v."artifactType",
              ses."code" AS "seasonCode", ses."title" AS "seasonTitle", ses."status" AS "seasonStatus",
              m."place" AS "medalPlace"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       JOIN "AwardSeason" ses ON ses."id" = e."seasonId"
       LEFT JOIN "AwardMedal" m ON m."entryId" = e."id"
       WHERE e."id" = $1
       LIMIT 1`,
      [entryId]
    );
    if (r.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id: entryId, status: "not_found" });
    }
    const row = r.rows[0] as any;
    const submittedMs =
      row.submittedAt instanceof Date
        ? row.submittedAt.getTime()
        : new Date(row.submittedAt).getTime();
    const etag = `W/"awards-embed-${entryId}-${submittedMs}-${row.medalPlace || 0}-${row.status}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }
    bumpEntryFetchCounter(req, entryId);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: row.id,
      seasonId: row.seasonId,
      season: {
        code: row.seasonCode,
        title: row.seasonTitle,
        status: row.seasonStatus,
      },
      artifactVersionId: row.artifactVersionId,
      submissionTitle: row.submissionTitle,
      artifactType: row.artifactType,
      status: row.status,
      submittedAt: row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
      qualifiedAt: row.qualifiedAt
        ? row.qualifiedAt instanceof Date
          ? row.qualifiedAt.toISOString()
          : row.qualifiedAt
        : null,
      medalPlace: row.medalPlace,
      verifyUrl: `/planet/artifact/${row.artifactVersionId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "embed failed", details: err.message });
  }
});

// 🔹 GET /entries/:entryId/badge.svg — shields-style badge.
//    If medalPlace = 1/2/3 → gold/silver/bronze; else status-coloured.
awardsRouter.get("/entries/:entryId/badge.svg", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const entryId = String(req.params.entryId);
    const theme = String(req.query.theme || "dark").toLowerCase() === "light" ? "light" : "dark";
    const r = await pool.query(
      `SELECT e."status", e."submittedAt", v."artifactType",
              ses."type" AS "seasonType", ses."code" AS "seasonCode",
              m."place"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "AwardSeason" ses ON ses."id" = e."seasonId"
       LEFT JOIN "AwardMedal" m ON m."entryId" = e."id"
       WHERE e."id" = $1 LIMIT 1`,
      [entryId]
    );

    function svgShell(left: string, right: string, rightFill: string): string {
      const padX = 8;
      const charW = 6.6;
      const lW = Math.max(70, Math.round(left.length * charW + padX * 2));
      const rW = Math.max(80, Math.round(right.length * charW + padX * 2));
      const total = lW + rW;
      const leftFill = theme === "light" ? "#e2e8f0" : "#1e293b";
      const leftText = theme === "light" ? "#0f172a" : "#e2e8f0";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${esc(
        left
      )}: ${esc(right)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".08"/>
  </linearGradient>
  <rect width="${total}" height="22" rx="4" fill="${leftFill}"/>
  <rect x="${lW}" width="${rW}" height="22" rx="4" fill="${rightFill}"/>
  <rect x="${lW - 4}" width="8" height="22" fill="${rightFill}"/>
  <rect width="${total}" height="22" rx="4" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
    <text x="${lW / 2}" y="15" fill="${leftText}">${esc(left)}</text>
    <text x="${lW + rW / 2}" y="15">${esc(right)}</text>
  </g>
</svg>`;
    }
    function esc(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (r.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.send(svgShell("AEVION AWARD", "not found", "#94a3b8"));
    }
    const row = r.rows[0] as any;
    const seasonType = String(row.seasonType || "").toUpperCase();
    const place = row.place as number | null;
    const status = String(row.status);

    let label: string;
    let color: string;
    if (place === 1) {
      label = `🥇 1st · ${seasonType}`;
      color = "#eab308"; // gold
    } else if (place === 2) {
      label = `🥈 2nd · ${seasonType}`;
      color = "#94a3b8"; // silver
    } else if (place === 3) {
      label = `🥉 3rd · ${seasonType}`;
      color = "#b45309"; // bronze
    } else if (status === "qualified") {
      label = `Qualified · ${seasonType}`;
      color = "#0d9488";
    } else if (status === "disqualified") {
      label = `Disqualified · ${seasonType}`;
      color = "#dc2626";
    } else {
      label = `Submitted · ${seasonType}`;
      color = "#475569";
    }
    const etag = `W/"awards-badge-${entryId}-${place || 0}-${status}-${theme}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }
    bumpEntryFetchCounter(req, entryId);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION AWARDS", label, color));
  } catch (err: any) {
    res.status(500).json({ error: "badge failed", details: err.message });
  }
});

// 🔹 GET /transparency — agg stats.
awardsRouter.get("/transparency", awardsEmbedRateLimit, async (_req, res) => {
  try {
    await ensureAwardsTables();
    const seasonsP = pool.query(
      `SELECT "type", COUNT(*) FILTER (WHERE "status" = 'finalized')::int AS "finalized",
              COUNT(*) FILTER (WHERE "status" <> 'finalized')::int AS "active"
       FROM "AwardSeason"
       GROUP BY "type"`
    );
    const entriesP = pool.query(
      `SELECT "status", COUNT(*)::int AS "count"
       FROM "AwardEntry"
       GROUP BY "status"`
    );
    const medalsP = pool.query(`SELECT COUNT(*)::int AS "c" FROM "AwardMedal"`);
    const totalsP = pool.query(`
      SELECT COUNT(*)::int AS "totalSeasons",
             (SELECT COUNT(*)::int FROM "AwardEntry") AS "totalEntries"
      FROM "AwardSeason"
    `);

    const [seasons, entries, medals, totals] = await Promise.all([
      seasonsP,
      entriesP,
      medalsP,
      totalsP,
    ]);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        seasons: (totals.rows[0] as any).totalSeasons || 0,
        entries: (totals.rows[0] as any).totalEntries || 0,
        medalsAwarded: (medals.rows[0] as any).c || 0,
      },
      seasonsByType: seasons.rows,
      entriesByStatus: entries.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "transparency failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Owner submission
// ─────────────────────────────────────────────────────────────────────────

// 🔹 POST /entries — submit a Planet artifact to a season.
//    Bearer required. Idempotent on (seasonId, artifactVersionId).
awardsRouter.post("/entries", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const seasonId = String(req.body?.seasonId || "").trim();
    const artifactVersionId = String(req.body?.artifactVersionId || "").trim();
    if (!seasonId || !artifactVersionId) {
      return res.status(400).json({ error: "seasonId and artifactVersionId required" });
    }

    const sesR = await pool.query(
      `SELECT "id","status","type" FROM "AwardSeason" WHERE "id" = $1 LIMIT 1`,
      [seasonId]
    );
    if (sesR.rowCount === 0) return res.status(404).json({ error: "season not found" });
    const season = sesR.rows[0] as any;
    if (season.status !== "open") {
      return res.status(409).json({ error: `season is ${season.status}, not open for entries` });
    }

    // Verify artifact exists in Planet AND owned by caller (matches owner of artifact).
    const artR = await pool.query(
      `SELECT v."id", v."productKey", s."ownerId"
       FROM "PlanetArtifactVersion" v
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       WHERE v."id" = $1 LIMIT 1`,
      [artifactVersionId]
    );
    if (artR.rowCount === 0) return res.status(404).json({ error: "artifact not found in Planet" });
    const art = artR.rows[0] as any;
    if (art.ownerId !== auth.sub) {
      return res.status(403).json({ error: "you don't own this artifact" });
    }

    const id = crypto.randomUUID();
    try {
      await pool.query(
        `INSERT INTO "AwardEntry" ("id","seasonId","artifactVersionId","productKey","status")
         VALUES ($1,$2,$3,$4,'pending')`,
        [id, seasonId, artifactVersionId, art.productKey]
      );
    } catch (e: any) {
      if (e?.code === "23505") {
        // Already submitted — return the existing row's id.
        const existing = await pool.query(
          `SELECT "id","status" FROM "AwardEntry" WHERE "seasonId" = $1 AND "artifactVersionId" = $2`,
          [seasonId, artifactVersionId]
        );
        return res.status(200).json({
          ok: true,
          duplicate: true,
          ...(existing.rows[0] as any),
        });
      }
      throw e;
    }
    recordAwardsAudit(auth.email || auth.sub || null, "entry.submit", id, {
      seasonId,
      artifactVersionId,
    });
    res.status(201).json({ id, seasonId, artifactVersionId, status: "pending" });
  } catch (err: any) {
    res.status(500).json({ error: "submit failed", details: err.message });
  }
});

// 🔹 GET /me/entries — own submissions.
awardsRouter.get("/me/entries", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });
    const r = await pool.query(
      `SELECT e."id", e."seasonId", e."artifactVersionId", e."status", e."submittedAt", e."qualifiedAt", e."disqualifyReason",
              s."title" AS "submissionTitle", v."artifactType",
              ses."code" AS "seasonCode", ses."title" AS "seasonTitle", ses."type" AS "seasonType"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       JOIN "AwardSeason" ses ON ses."id" = e."seasonId"
       WHERE s."ownerId" = $1
       ORDER BY e."submittedAt" DESC
       LIMIT 100`,
      [auth.sub]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        ...row,
        submittedAt:
          row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
        qualifiedAt: row.qualifiedAt
          ? row.qualifiedAt instanceof Date
            ? row.qualifiedAt.toISOString()
            : row.qualifiedAt
          : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "me/entries failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────

awardsRouter.get("/admin/whoami", (req, res) => {
  const auth = verifyBearerOptional(req);
  res.json({
    isAdmin: isAwardsAdmin(auth),
    email: auth?.email || null,
    role: auth?.role || null,
  });
});

// 🔹 POST /admin/seasons — create a new season.
awardsRouter.post("/admin/seasons", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const { code, type, title, status, startsAt, endsAt } = req.body || {};
    if (!code || !type || !title) {
      return res.status(400).json({ error: "code, type, title required" });
    }
    if (!AWARD_TYPES.has(type)) {
      return res.status(400).json({ error: "unknown type", allowed: Array.from(AWARD_TYPES) });
    }
    const st = String(status || "draft");
    if (!AWARD_SEASON_STATUSES.has(st)) {
      return res.status(400).json({
        error: "unknown status",
        allowed: Array.from(AWARD_SEASON_STATUSES),
      });
    }
    const id = crypto.randomUUID();
    try {
      await pool.query(
        `INSERT INTO "AwardSeason" ("id","code","type","title","status","startsAt","endsAt","createdBy")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, code, type, title, st, startsAt || null, endsAt || null, auth?.email || auth?.sub || null]
      );
    } catch (e: any) {
      if (e?.code === "23505") {
        return res.status(409).json({ error: `code ${code} already exists` });
      }
      throw e;
    }
    recordAwardsAudit(auth?.email || auth?.sub || null, "season.create", id, {
      code,
      type,
      title,
      status: st,
    });
    res.status(201).json({ id, code, type, title, status: st });
  } catch (err: any) {
    res.status(500).json({ error: "create failed", details: err.message });
  }
});

// 🔹 PATCH /admin/seasons/:id — update status / title / dates.
awardsRouter.patch("/admin/seasons/:id", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const id = String(req.params.id);

    const fields: string[] = [];
    const params: unknown[] = [];
    function add(col: string, value: unknown) {
      params.push(value);
      fields.push(`"${col}" = $${params.length}`);
    }
    if (typeof req.body?.title === "string") add("title", req.body.title.slice(0, 200));
    if (typeof req.body?.status === "string") {
      if (!AWARD_SEASON_STATUSES.has(req.body.status)) {
        return res.status(400).json({ error: "unknown status" });
      }
      add("status", req.body.status);
    }
    if (req.body?.startsAt !== undefined) add("startsAt", req.body.startsAt || null);
    if (req.body?.endsAt !== undefined) add("endsAt", req.body.endsAt || null);
    if (fields.length === 0) return res.status(400).json({ error: "nothing to update" });

    params.push(id);
    const r = await pool.query(
      `UPDATE "AwardSeason" SET ${fields.join(", ")}
       WHERE "id" = $${params.length} RETURNING *`,
      params
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not found" });
    recordAwardsAudit(auth?.email || auth?.sub || null, "season.update", id, req.body || {});
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "update failed", details: err.message });
  }
});

// 🔹 POST /admin/entries/:id/qualify — mark as qualified.
awardsRouter.post("/admin/entries/:id/qualify", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const id = String(req.params.id);
    const r = await pool.query(
      `UPDATE "AwardEntry"
         SET "status" = 'qualified',
             "qualifiedAt" = NOW(),
             "qualifiedBy" = $2,
             "disqualifyReason" = NULL
       WHERE "id" = $1
       RETURNING "id","seasonId","artifactVersionId","status"`,
      [id, auth?.email || auth?.sub || null]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "entry not found" });
    recordAwardsAudit(auth?.email || auth?.sub || null, "entry.qualify", id, null);
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "qualify failed", details: err.message });
  }
});

// 🔹 POST /admin/entries/:id/disqualify — mark as disqualified.
awardsRouter.post("/admin/entries/:id/disqualify", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const id = String(req.params.id);
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const r = await pool.query(
      `UPDATE "AwardEntry"
         SET "status" = 'disqualified',
             "disqualifyReason" = $2,
             "qualifiedAt" = NULL,
             "qualifiedBy" = NULL
       WHERE "id" = $1
       RETURNING "id","seasonId","status"`,
      [id, reason]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "entry not found" });
    recordAwardsAudit(auth?.email || auth?.sub || null, "entry.disqualify", id, { reason });
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "disqualify failed", details: err.message });
  }
});

// 🔹 PATCH /admin/entries/bulk — bulk qualify or disqualify up to 100 entries.
//    Body: { items: [{ entryId, action: "qualify"|"disqualify", reason? }, …] }
//    Single transaction; aborts on first invalid row (no partial writes).
//    One AwardAuditLog row per entry. Mirrors Modules / Bureau bulk pattern.
awardsRouter.patch("/admin/entries/bulk", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const itemsRaw = req.body?.items;
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }
    if (itemsRaw.length > 100) {
      return res.status(400).json({ error: "max 100 items per call" });
    }

    type BulkEdit = {
      entryId: string;
      action: "qualify" | "disqualify";
      reason: string | null;
    };
    const edits: BulkEdit[] = [];
    for (const raw of itemsRaw) {
      if (!raw || typeof raw !== "object") {
        return res.status(400).json({ error: "each item must be an object" });
      }
      const entryId = typeof raw.entryId === "string" ? raw.entryId.trim() : "";
      if (!entryId) return res.status(400).json({ error: "entryId required" });
      const action = String(raw.action || "");
      if (action !== "qualify" && action !== "disqualify") {
        return res.status(400).json({ error: "invalid action", entryId, action });
      }
      const reason =
        typeof raw.reason === "string" ? raw.reason.trim().slice(0, 500) || null : null;
      if (action === "disqualify" && !reason) {
        return res.status(400).json({ error: "reason required for disqualify", entryId });
      }
      edits.push({ entryId, action, reason });
    }

    const actor = auth?.email || auth?.sub || null;
    const results: Array<{
      entryId: string;
      ok: boolean;
      action: string;
      seasonId?: string;
      prevStatus?: string;
      error?: string;
    }> = [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const e of edits) {
        const cur = await client.query(
          `SELECT "id","seasonId","status" FROM "AwardEntry" WHERE "id" = $1`,
          [e.entryId]
        );
        if (cur.rowCount === 0) {
          results.push({ entryId: e.entryId, ok: false, action: e.action, error: "entry_not_found" });
          continue;
        }
        const prev = cur.rows[0] as { id: string; seasonId: string; status: string };
        if (e.action === "qualify") {
          await client.query(
            `UPDATE "AwardEntry"
               SET "status" = 'qualified',
                   "qualifiedAt" = NOW(),
                   "qualifiedBy" = $2,
                   "disqualifyReason" = NULL
             WHERE "id" = $1`,
            [e.entryId, actor]
          );
          await client.query(
            `INSERT INTO "AwardAuditLog" ("id","actor","action","targetId","payload")
             VALUES ($1,$2,$3,$4,$5)`,
            [
              crypto.randomUUID(),
              actor,
              "entry.qualify",
              e.entryId,
              JSON.stringify({ seasonId: prev.seasonId, prevStatus: prev.status, bulk: true }),
            ]
          );
        } else {
          await client.query(
            `UPDATE "AwardEntry"
               SET "status" = 'disqualified',
                   "disqualifyReason" = $2,
                   "qualifiedAt" = NULL,
                   "qualifiedBy" = NULL
             WHERE "id" = $1`,
            [e.entryId, e.reason]
          );
          await client.query(
            `INSERT INTO "AwardAuditLog" ("id","actor","action","targetId","payload")
             VALUES ($1,$2,$3,$4,$5)`,
            [
              crypto.randomUUID(),
              actor,
              "entry.disqualify",
              e.entryId,
              JSON.stringify({
                seasonId: prev.seasonId,
                prevStatus: prev.status,
                reason: e.reason,
                bulk: true,
              }),
            ]
          );
        }
        results.push({
          entryId: e.entryId,
          ok: true,
          action: e.action,
          seasonId: prev.seasonId,
          prevStatus: prev.status,
        });
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const okCount = results.filter((r) => r.ok).length;
    res.json({ ok: true, applied: okCount, total: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: "bulk failed", details: err.message });
  }
});

// 🔹 POST /admin/seasons/:id/finalize — compute top-3 medals and freeze.
//    Top-3 = qualified entries sorted by voteCount DESC, voteAvg DESC.
//    Idempotent: deletes existing medals for this season first.
awardsRouter.post("/admin/seasons/:id/finalize", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const seasonId = String(req.params.id);

    const sesR = await pool.query(
      `SELECT "id","status","type" FROM "AwardSeason" WHERE "id"=$1 LIMIT 1`,
      [seasonId]
    );
    if (sesR.rowCount === 0) return res.status(404).json({ error: "season not found" });

    // Score formula: voteCount + (voteAvg/100). Stable, simple, deterministic.
    const top = await pool.query(
      `SELECT e."id" AS "entryId", e."artifactVersionId",
              COALESCE(stats."voteCount", 0)::int AS "voteCount",
              stats."voteAvg",
              (COALESCE(stats."voteCount", 0)::numeric + COALESCE(stats."voteAvg", 0)::numeric/100) AS "score"
       FROM "AwardEntry" e
       LEFT JOIN (
         SELECT "artifactVersionId",
                COUNT(*) AS "voteCount",
                AVG("score")::numeric(5,2) AS "voteAvg"
         FROM "PlanetVote"
         GROUP BY "artifactVersionId"
       ) stats ON stats."artifactVersionId" = e."artifactVersionId"
       WHERE e."seasonId" = $1 AND e."status" = 'qualified'
       ORDER BY (COALESCE(stats."voteCount", 0)::numeric + COALESCE(stats."voteAvg", 0)::numeric/100) DESC
       LIMIT 3`,
      [seasonId]
    );

    await pool.query(`DELETE FROM "AwardMedal" WHERE "seasonId" = $1`, [seasonId]);
    const medals: any[] = [];
    let place = 1;
    for (const row of top.rows as any[]) {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO "AwardMedal" ("id","seasonId","place","entryId","artifactVersionId","voteCount","voteAverage","score")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, seasonId, place, row.entryId, row.artifactVersionId, row.voteCount, row.voteAvg, row.score]
      );
      medals.push({
        id,
        place,
        entryId: row.entryId,
        artifactVersionId: row.artifactVersionId,
        voteCount: row.voteCount,
        voteAverage: row.voteAvg !== null ? Number(row.voteAvg) : null,
        score: Number(row.score),
      });
      place++;
    }

    await pool.query(`UPDATE "AwardSeason" SET "status" = 'finalized' WHERE "id" = $1`, [seasonId]);
    recordAwardsAudit(auth?.email || auth?.sub || null, "season.finalize", seasonId, {
      medals: medals.map((m) => ({ place: m.place, entryId: m.entryId })),
    });
    res.json({ seasonId, status: "finalized", medals });
  } catch (err: any) {
    res.status(500).json({ error: "finalize failed", details: err.message });
  }
});

// 🔹 GET /admin/audit — paginated audit reader.
awardsRouter.get("/admin/audit", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
    const action = String(req.query.action || "").trim();
    const targetId = String(req.query.targetId || "").trim();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (action) {
      params.push(action);
      conds.push(`"action" = $${params.length}`);
    }
    if (targetId) {
      params.push(targetId);
      conds.push(`"targetId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const r = await pool.query(
      `SELECT "id","actor","action","targetId","payload","at"
       FROM "AwardAuditLog" ${where}
       ORDER BY "at" DESC LIMIT $${params.length}`,
      params
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      filter: { action: action || null, targetId: targetId || null, limit },
      items: r.rows.map((row: any) => ({
        ...row,
        at: row.at instanceof Date ? row.at.toISOString() : row.at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "audit failed", details: err.message });
  }
});

// 🔹 GET /admin/entries?seasonId=&status= — admin entry browser.
awardsRouter.get("/admin/entries", async (req, res) => {
  try {
    await ensureAwardsTables();
    const auth = verifyBearerOptional(req);
    if (!isAwardsAdmin(auth)) return res.status(403).json({ error: "Admin role required" });
    const seasonId = String(req.query.seasonId || "").trim();
    const status = String(req.query.status || "").trim();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (seasonId) {
      params.push(seasonId);
      conds.push(`e."seasonId" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conds.push(`e."status" = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const r = await pool.query(
      `SELECT e."id", e."seasonId", e."artifactVersionId", e."status", e."submittedAt", e."qualifiedAt", e."disqualifyReason",
              s."title" AS "submissionTitle", s."ownerId",
              v."artifactType", v."productKey",
              ses."code" AS "seasonCode", ses."title" AS "seasonTitle", ses."type" AS "seasonType"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       JOIN "AwardSeason" ses ON ses."id" = e."seasonId"
       ${where}
       ORDER BY e."submittedAt" DESC
       LIMIT 200`,
      params
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        ...row,
        submittedAt:
          row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
        qualifiedAt: row.qualifiedAt
          ? row.qualifiedAt instanceof Date
            ? row.qualifiedAt.toISOString()
            : row.qualifiedAt
          : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "entries failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 3 amplifier — OG cards, sitemap, per-season RSS
// ─────────────────────────────────────────────────────────────────────────

function awardsEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function awardsWrap(text: string, perLine: number, maxLines: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > perLine) {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length === maxLines) {
    lines[maxLines - 1] = (lines[maxLines - 1] || "").replace(/\s+\S+$/, "") + "…";
  }
  return lines;
}

function awardsMedalTheme(place: number | null, status: string): { color: string; label: string } {
  if (place === 1) return { color: "#eab308", label: "GOLD · 1st" };
  if (place === 2) return { color: "#94a3b8", label: "SILVER · 2nd" };
  if (place === 3) return { color: "#b45309", label: "BRONZE · 3rd" };
  if (status === "qualified") return { color: "#0d9488", label: "QUALIFIED" };
  if (status === "disqualified") return { color: "#dc2626", label: "DISQUALIFIED" };
  return { color: "#475569", label: "SUBMITTED" };
}

// 🔹 GET /entries/:entryId/og.svg — 1200x630 social-share card. Medal place
//    or qualification status drives the accent colour (gold/silver/bronze
//    for top 3, teal for qualified, gray otherwise).
awardsRouter.get("/entries/:entryId/og.svg", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const entryId = String(req.params.entryId);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const r = await pool.query(
      `SELECT e."id", e."status",
              s."title" AS "submissionTitle",
              ses."type" AS "seasonType", ses."title" AS "seasonTitle", ses."code" AS "seasonCode",
              m."place"
       FROM "AwardEntry" e
       JOIN "PlanetArtifactVersion" v ON v."id" = e."artifactVersionId"
       JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       JOIN "AwardSeason" ses ON ses."id" = e."seasonId"
       LEFT JOIN "AwardMedal" m ON m."entryId" = e."id"
       WHERE e."id" = $1 LIMIT 1`,
      [entryId]
    );
    if (r.rowCount === 0) {
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="60" y="320" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="900" fill="#e2e8f0">Award entry not found</text>
  <text x="60" y="380" font-family="ui-monospace, monospace" font-size="24" fill="#64748b">${awardsEsc(entryId)}</text>
</svg>`;
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(fallback);
    }
    const row = r.rows[0] as any;
    const place = (row.place as number | null) ?? null;
    const status = String(row.status);
    if (applyOgEtag(req, res, `awards-entry-${entryId}-${place ?? 0}-${status}`)) return;
    const theme = awardsMedalTheme(place, status);
    const titleLines = awardsWrap(row.submissionTitle || row.seasonTitle || entryId, 24, 2);
    const seasonLine = `${String(row.seasonType || "").toUpperCase()} · ${row.seasonTitle || row.seasonCode || ""}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${theme.color}"/>
      <stop offset="1" stop-color="${theme.color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION AWARDS</text>
    <g transform="translate(60, 170)">
      ${titleLines
        .map(
          (line, i) =>
            `<text y="${i * 92}" font-size="80" font-weight="900" letter-spacing="-2">${awardsEsc(line)}</text>`
        )
        .join("\n      ")}
    </g>
    <g transform="translate(60, ${170 + titleLines.length * 92 + 40})">
      <text font-size="28" font-weight="500" fill="#cbd5e1">${awardsEsc(seasonLine)}</text>
    </g>
    <g transform="translate(60, 540)">
      <rect width="${theme.label.length * 18 + 56}" height="44" rx="22" fill="${theme.color}" fill-opacity="0.18" stroke="${theme.color}" stroke-width="2"/>
      <text x="22" y="30" font-size="22" font-weight="900" fill="${theme.color}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${awardsEsc(theme.label)}</text>
    </g>
    <g transform="translate(${1200 - 60}, 540)" text-anchor="end">
      <text font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">${awardsEsc(entryId.slice(0, 18))}</text>
    </g>
  </g>
</svg>`;

    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: "entry og failed", details: err.message });
  }
});

// 🔹 GET /og.svg — index-page social-share card. Pulls live totals so a
//    paste of /awards reflects current state.
awardsRouter.get("/og.svg", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const totalsRow = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "AwardSeason") AS "seasons",
        (SELECT COUNT(*)::int FROM "AwardSeason" WHERE "status" = 'finalized') AS "finalized",
        (SELECT COUNT(*)::int FROM "AwardEntry") AS "entries",
        (SELECT COUNT(*)::int FROM "AwardMedal") AS "medals"
    `);
    const t = (totalsRow.rows[0] || {}) as any;
    const seasons = t.seasons || 0;
    const finalized = t.finalized || 0;
    const entries = t.entries || 0;
    const medals = t.medals || 0;
    if (applyOgEtag(req, res, `awards-index-${seasons}-${finalized}-${entries}-${medals}`)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#eab308"/>
      <stop offset="0.5" stop-color="#94a3b8"/>
      <stop offset="1" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION AWARDS</text>
    <text x="60" y="200" font-size="96" font-weight="900" letter-spacing="-2">${awardsEsc(String(medals))} medals</text>
    <text x="60" y="252" font-size="32" font-weight="600" fill="#cbd5e1">Music · Film · Code · Design · Science.</text>
    <g transform="translate(60, 380)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <g>
        <rect width="220" height="80" rx="14" fill="#eab308" fill-opacity="0.15" stroke="#eab308" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#eab308">${awardsEsc(String(finalized))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#fde68a">FINALIZED</text>
      </g>
      <g transform="translate(240, 0)">
        <rect width="220" height="80" rx="14" fill="#0d9488" fill-opacity="0.15" stroke="#0d9488" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#0d9488">${awardsEsc(String(seasons))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#5eead4">SEASONS</text>
      </g>
      <g transform="translate(480, 0)">
        <rect width="220" height="80" rx="14" fill="#94a3b8" fill-opacity="0.18" stroke="#94a3b8" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#e2e8f0">${awardsEsc(String(entries))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#cbd5e1">ENTRIES</text>
      </g>
    </g>
    <text x="60" y="585" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.tech / awards</text>
  </g>
</svg>`;

    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: "index og failed", details: err.message });
  }
});

// 🔹 GET /seasons/:seasonId/changelog.rss — RSS 2.0 of admin events on
//    one season (entry qualified/disqualified, season finalized) sourced
//    from AwardAuditLog. Lets press subscribe to a single season.
awardsRouter.get("/seasons/:seasonId/changelog.rss", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const seasonId = String(req.params.seasonId);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const selfUrl = `${proto}://${host}/api/awards/seasons/${encodeURIComponent(seasonId)}/changelog.rss`;
    const siteUrl = `${proto}://${host}/awards/results?seasonId=${encodeURIComponent(seasonId)}`;

    const seasonRow = await pool.query(
      `SELECT "title","code","type" FROM "AwardSeason" WHERE "id" = $1 LIMIT 1`,
      [seasonId]
    );
    const seasonTitle = seasonRow.rows[0]?.title || seasonId;
    const seasonType = String(seasonRow.rows[0]?.type || "").toUpperCase();

    // Audit rows for this season — either targetId === seasonId (season events)
    // or payload->>'seasonId' === seasonId (entry events).
    const r = await pool.query(
      `SELECT "id","actor","action","targetId","payload","at"
       FROM "AwardAuditLog"
       WHERE "targetId" = $1
          OR ("payload" IS NOT NULL AND "payload"->>'seasonId' = $1)
       ORDER BY "at" DESC
       LIMIT $2`,
      [seasonId, limit]
    );

    const latestAt = r.rows[0]?.at;
    const latestMs = latestAt instanceof Date ? latestAt.getTime() : (latestAt ? new Date(latestAt).getTime() : 0);
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `awards-season-${seasonId}-${r.rows.length}-${latestMs}`, { prefix: "rss" })) return;

    function describe(row: any): string {
      const p = row.payload || {};
      switch (row.action) {
        case "season.create":
          return `Season created — ${p.title || row.targetId}`;
        case "season.update":
          return `Season updated — ${p.changedFields ? Object.keys(p.changedFields).join(", ") : "fields changed"}`;
        case "season.finalize":
          return `Season finalized — ${p.medalCount || 0} medals awarded`;
        case "entry.qualify":
          return `Entry qualified${p.entryId ? ` (${p.entryId})` : ""}`;
        case "entry.disqualify":
          return `Entry disqualified${p.reason ? ` — ${p.reason}` : ""}`;
        default:
          return row.action || "Awards event";
      }
    }

    const items = r.rows
      .map((row: any) => {
        const at = row.at instanceof Date ? row.at : new Date(row.at);
        const pubDate = at.toUTCString();
        const summary = describe(row);
        const title = `${seasonTitle} — ${summary}`;
        const guid = `aevion-awards-${row.id}`;
        return `    <item>
      <title>${awardsEsc(title)}</title>
      <link>${awardsEsc(siteUrl)}</link>
      <guid isPermaLink="false">${awardsEsc(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${awardsEsc(summary)}</description>
    </item>`;
      })
      .join("\n");

    const lastBuild = r.rows[0]
      ? (r.rows[0].at instanceof Date ? r.rows[0].at : new Date(r.rows[0].at)).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEVION Awards · ${awardsEsc(seasonTitle)}${seasonType ? ` (${awardsEsc(seasonType)})` : ""}</title>
    <link>${awardsEsc(siteUrl)}</link>
    <atom:link href="${awardsEsc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Admin events for AEVION Awards season ${awardsEsc(seasonId)}.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: "season rss failed", details: err.message });
  }
});

// 🔹 GET /sitemap.xml — sitemap for the awards surface. Covers /awards,
//    every supported award type's leaderboard, and each entry that has
//    earned a medal (top-3 finishers from finalized seasons).
awardsRouter.get("/sitemap.xml", awardsEmbedRateLimit, async (req, res) => {
  try {
    await ensureAwardsTables();
    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const origin = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);

    const medals = await pool.query(
      `SELECT m."entryId", m."awardedAt"
       FROM "AwardMedal" m
       JOIN "AwardSeason" s ON s."id" = m."seasonId"
       WHERE s."status" = 'finalized'
       ORDER BY m."awardedAt" DESC
       LIMIT 5000`
    );

    const medalRows = medals.rows as any[];
    const latestMedalSrc = medalRows[0]?.awardedAt;
    const latestMedalMs = latestMedalSrc instanceof Date ? latestMedalSrc.getTime() : (latestMedalSrc ? new Date(latestMedalSrc).getTime() : 0);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `awards-${medalRows.length}-${latestMedalMs}-${today}`, { prefix: "sitemap", maxAgeSec: 600 })) return;

    const urls: string[] = [];
    urls.push(`  <url>
    <loc>${awardsEsc(origin)}/awards</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
    urls.push(`  <url>
    <loc>${awardsEsc(origin)}/awards/results</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
    for (const t of Array.from(AWARD_TYPES).sort()) {
      urls.push(`  <url>
    <loc>${awardsEsc(origin)}/awards/${awardsEsc(t)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }
    for (const row of medals.rows as any[]) {
      const lastmodSrc = row.awardedAt;
      const lastmod = lastmodSrc
        ? (lastmodSrc instanceof Date ? lastmodSrc.toISOString() : String(lastmodSrc)).slice(0, 10)
        : today;
      urls.push(`  <url>
    <loc>${awardsEsc(origin)}/awards/entry/${awardsEsc(row.entryId)}</loc>
    <lastmod>${awardsEsc(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: "sitemap failed", details: err.message });
  }
});

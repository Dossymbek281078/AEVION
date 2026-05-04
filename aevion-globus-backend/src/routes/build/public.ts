import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { buildPool as pool, ok, fail, safeParseJson } from "../../lib/build";

export const publicRouter = Router();

// 60 requests per minute per API key (or per IP if unauthenticated).
// Generous enough for legitimate scrapers polling on a sane interval.
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const k = (req as Request & { partnerKeyId?: string }).partnerKeyId;
    return k ? `pk:${k}` : `ip:${req.ip ?? "anon"}`;
  },
  message: {
    success: false,
    error: "rate_limit_exceeded",
    retryAfterMs: 60 * 1000,
  },
});

// Validate the X-Build-Key header. Found and unrevoked → attach `partnerKeyId`
// and bump usage counter (fire-and-forget). Missing or invalid → 401.
async function requirePartnerKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-build-key"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || typeof raw !== "string") {
    return fail(res, 401, "missing_x_build_key");
  }
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  try {
    const r = await pool.query(
      `SELECT "id","scopesJson" FROM "BuildPartnerApiKey"
       WHERE "keyHash" = $1 AND "revokedAt" IS NULL LIMIT 1`,
      [keyHash],
    );
    if (r.rowCount === 0) return fail(res, 401, "invalid_or_revoked_key");
    (req as Request & { partnerKeyId?: string }).partnerKeyId = r.rows[0].id;
    void pool
      .query(
        `UPDATE "BuildPartnerApiKey" SET "usageCount" = "usageCount" + 1, "lastUsedAt" = NOW() WHERE "id" = $1`,
        [r.rows[0].id],
      )
      .catch(() => {});
    return next();
  } catch (err: unknown) {
    return fail(res, 500, "key_check_failed", { details: (err as Error).message });
  }
}

// GET /api/build/public/v1/vacancies?limit=20&offset=0&city=...&skill=...
// Read-only feed of OPEN vacancies. Cached briefly so a partner polling
// every 30s doesn't hit the DB on every request.
publicRouter.get("/v1/vacancies", publicRateLimiter, requirePartnerKey, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.round(offsetRaw)) : 0;
    const city = typeof req.query.city === "string" ? req.query.city.trim().slice(0, 100) : "";
    const skill = typeof req.query.skill === "string" ? req.query.skill.trim().slice(0, 60) : "";

    const where: string[] = [`v."status" = 'OPEN'`];
    const params: unknown[] = [];
    if (city) {
      params.push(city);
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (skill) {
      params.push(`%"${skill.toLowerCase()}"%`);
      where.push(`lower(v."skillsJson") LIKE $${params.length}`);
    }
    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT v."id", v."title", v."description", v."salary", v."salaryCurrency",
              v."skillsJson", v."city", v."createdAt", v."expiresAt",
              p."title" AS "projectTitle", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE ${where.join(" AND ")}
       ORDER BY v."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      salary: row.salary,
      salaryCurrency: row.salaryCurrency ?? "USD",
      skills: safeParseJson(row.skillsJson, [] as string[]),
      city: row.city ?? row.projectCity ?? null,
      project: row.projectTitle ?? null,
      url: `https://aevion.tech/build/vacancy/${encodeURIComponent(String(row.id))}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));

    res.setHeader("Cache-Control", "private, max-age=30");
    return ok(res, { items, total: items.length, limit, offset });
  } catch (err: unknown) {
    return fail(res, 500, "public_vacancies_failed", { details: (err as Error).message });
  }
});

// GET /api/build/public/v1/vacancies/:id — single vacancy, same shape.
publicRouter.get("/v1/vacancies/:id", publicRateLimiter, requirePartnerKey, async (req, res) => {
  try {
    const id = String(req.params.id);
    const r = await pool.query(
      `SELECT v."id", v."title", v."description", v."salary", v."salaryCurrency",
              v."skillsJson", v."city", v."status", v."createdAt", v."expiresAt",
              p."title" AS "projectTitle", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (r.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const row = r.rows[0];
    const item = {
      id: row.id,
      title: row.title,
      description: row.description,
      salary: row.salary,
      salaryCurrency: row.salaryCurrency ?? "USD",
      status: row.status,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      city: row.city ?? row.projectCity ?? null,
      project: row.projectTitle ?? null,
      url: `https://aevion.tech/build/vacancy/${encodeURIComponent(String(row.id))}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
    res.setHeader("Cache-Control", "private, max-age=30");
    return ok(res, item);
  } catch (err: unknown) {
    return fail(res, 500, "public_vacancy_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/public/v1/health — sanity check for partners.
publicRouter.get("/v1/health", publicRateLimiter, requirePartnerKey, async (_req, res) => {
  return ok(res, { status: "ok", apiVersion: "v1" });
});

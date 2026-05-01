import { Router } from "express";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

export const availabilityRouter = Router();

// POST /api/build/availability — toggle "Available Now" mode.
// Body: { on: boolean, hours?: number (1-72, default 8) }
// Sets availableNow=true + availableUntil=NOW()+hours on the profile.
// Workers with availableNow=true surface at the top of talent search
// and get a green badge in all listings.
availabilityRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const on = req.body?.on === true || req.body?.on === "true";
    const hours = Math.max(1, Math.min(72, Number(req.body?.hours) || 8));
    const availableUntil = on
      ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
      : null;

    const result = await pool.query(
      `UPDATE "BuildProfile"
         SET "availableNow" = $1, "availableUntil" = $2, "updatedAt" = NOW()
       WHERE "userId" = $3
       RETURNING "userId", "availableNow", "availableUntil"`,
      [on, availableUntil, auth.sub],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "availability_update_failed", { details: (err as Error).message });
  }
});

// GET /api/build/availability/me — current availability status
availabilityRouter.get("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const r = await pool.query(
      `SELECT "availableNow", "availableUntil"
       FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (r.rowCount === 0) return fail(res, 404, "profile_not_found");

    const row = r.rows[0];
    // Auto-expire: if availableUntil is in the past, treat as off
    const expired = row.availableUntil && new Date(row.availableUntil) < new Date();
    if (expired && row.availableNow) {
      await pool.query(
        `UPDATE "BuildProfile" SET "availableNow" = FALSE WHERE "userId" = $1`,
        [auth.sub],
      );
      row.availableNow = false;
    }
    return ok(res, row);
  } catch (err: unknown) {
    return fail(res, 500, "availability_get_failed", { details: (err as Error).message });
  }
});

// GET /api/build/availability/workers — public list of workers available right now.
// Query: ?city=&specialty=&limit=50
availabilityRouter.get("/workers", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : null;
    const specialty = typeof req.query.specialty === "string" ? req.query.specialty.trim() : null;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));

    const params: unknown[] = [];
    const where: string[] = [
      `p."availableNow" = TRUE`,
      `(p."availableUntil" IS NULL OR p."availableUntil" > NOW())`,
    ];

    if (city) {
      params.push(`%${city}%`);
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (specialty) {
      params.push(`%${specialty}%`);
      where.push(`(p."title" ILIKE $${params.length} OR p."skillsJson" ILIKE $${params.length})`);
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT p."userId", p."name", p."city", p."buildRole",
              p."title", p."skillsJson", p."experienceYears",
              p."photoUrl", p."availableNow", p."availableUntil",
              p."salaryMin", p."salaryMax", p."salaryCurrency",
              COALESCE(rv."count", 0)::int AS "reviewCount",
              COALESCE(rv."avg", 0)::float8 AS "avgRating"
       FROM "BuildProfile" p
       LEFT JOIN (
         SELECT "revieweeId", COUNT(*)::int AS "count", AVG("rating")::float8 AS "avg"
           FROM "BuildReview" GROUP BY "revieweeId"
       ) rv ON rv."revieweeId" = p."userId"
       WHERE ${where.join(" AND ")}
       ORDER BY p."updatedAt" DESC
       LIMIT $${params.length}`,
      params,
    );

    return ok(res, { items: result.rows, total: result.rowCount, asOf: new Date().toISOString() });
  } catch (err: unknown) {
    return fail(res, 500, "available_workers_failed", { details: (err as Error).message });
  }
});

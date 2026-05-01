import { Router } from "express";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

export const referralsRouter = Router();

// GET /api/build/referrals/leaderboard — public
referralsRouter.get("/leaderboard", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const r = await pool.query(
      `SELECT
         a."referredByUserId" AS "userId",
         u."name" AS "name",
         COUNT(*)::int AS "totalReferred",
         SUM(CASE WHEN a."status" = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS "acceptedReferred"
       FROM "BuildApplication" a
       LEFT JOIN "AEVIONUser" u ON u."id" = a."referredByUserId"
       WHERE a."referredByUserId" IS NOT NULL
       GROUP BY a."referredByUserId", u."name"
       ORDER BY "acceptedReferred" DESC, "totalReferred" DESC
       LIMIT $1`,
      [limit],
    );
    return ok(res, { items: r.rows, limit });
  } catch (err: unknown) {
    return fail(res, 500, "leaderboard_failed", { details: (err as Error).message });
  }
});

// GET /api/build/referrals/me
referralsRouter.get("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [totals, tail] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS "totalReferred",
           SUM(CASE WHEN "status" = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS "acceptedReferred"
         FROM "BuildApplication"
         WHERE "referredByUserId" = $1`,
        [auth.sub],
      ),
      pool.query(
        `SELECT a."id", a."status", a."createdAt", v."title" AS "vacancyTitle",
                u."name" AS "applicantName"
         FROM "BuildApplication" a
         LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
         WHERE a."referredByUserId" = $1
         ORDER BY a."createdAt" DESC
         LIMIT 25`,
        [auth.sub],
      ),
    ]);
    return ok(res, {
      totalReferred: Number(totals.rows[0]?.totalReferred ?? 0),
      acceptedReferred: Number(totals.rows[0]?.acceptedReferred ?? 0),
      recent: tail.rows,
    });
  } catch (err: unknown) {
    return fail(res, 500, "referrals_me_failed", { details: (err as Error).message });
  }
});

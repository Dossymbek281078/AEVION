import { Router } from "express";
import { buildPool as pool, ok, fail, computeRecruiterTier } from "../../lib/build";

export const statsRouter = Router();

// GET /api/build/stats — public platform-wide stats, no auth.
statsRouter.get("/", async (_req, res) => {
  try {
    const r = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildVacancy" WHERE "status" = 'OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildVacancy"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProfile"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProject"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProject" WHERE "status" = 'OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildApplication"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildApplication" WHERE "status" = 'ACCEPTED'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildTrialTask"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildTrialTask" WHERE "status" = 'APPROVED'`),
      pool.query(`SELECT COALESCE(SUM("cashbackAev"),0)::float8 AS "n" FROM "BuildCashback"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildCashback"`),
    ]);
    return ok(res, {
      vacancies: { open: Number(r[0].rows[0].n), total: Number(r[1].rows[0].n) },
      candidates: Number(r[2].rows[0].n),
      projects: { total: Number(r[3].rows[0].n), open: Number(r[4].rows[0].n) },
      applications: {
        total: Number(r[5].rows[0].n),
        accepted: Number(r[6].rows[0].n),
        acceptRate:
          Number(r[5].rows[0].n) > 0
            ? Math.round((Number(r[6].rows[0].n) / Number(r[5].rows[0].n)) * 1000) / 10
            : 0,
      },
      trials: { total: Number(r[7].rows[0].n), approved: Number(r[8].rows[0].n) },
      cashback: { totalAev: Number(r[9].rows[0].n), entries: Number(r[10].rows[0].n) },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return fail(res, 500, "stats_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/leaderboard?kind=employer|worker — top users.
// Public — used by /build/leaderboard. Tier is computed from hires.
statsRouter.get("/leaderboard", async (req, res) => {
  try {
    const kindRaw = String(req.query.kind || "employer").toLowerCase();
    const kind = kindRaw === "worker" ? "worker" : "employer";
    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 20;

    if (kind === "employer") {
      // Top recruiters by hires (ACCEPTED applications + APPROVED trial tasks).
      const r = await pool.query(
        `SELECT u."id" AS "userId", bp."name", bp."city", bp."photoUrl",
                COUNT(DISTINCT a."id")::int AS "hires",
                (SELECT AVG(rev."rating")::float8 FROM "BuildReview" rev
                  WHERE rev."revieweeId" = u."id") AS "avgRating",
                (SELECT COUNT(*)::int FROM "BuildReview" rev
                  WHERE rev."revieweeId" = u."id") AS "reviewCount"
         FROM "AEVIONUser" u
         LEFT JOIN "BuildProfile" bp ON bp."userId" = u."id"
         LEFT JOIN "BuildProject" p ON p."clientId" = u."id"
         LEFT JOIN "BuildVacancy" v ON v."projectId" = p."id"
         LEFT JOIN "BuildApplication" a ON a."vacancyId" = v."id" AND a."status" = 'ACCEPTED'
         WHERE bp."buildRole" = 'CLIENT' OR bp."buildRole" IS NULL
         GROUP BY u."id", bp."name", bp."city", bp."photoUrl"
         HAVING COUNT(DISTINCT a."id") > 0
         ORDER BY COUNT(DISTINCT a."id") DESC
         LIMIT $1`,
        [limit],
      );
      const items = r.rows.map((row: Record<string, unknown>) => {
        const hires = Number(row.hires) || 0;
        const tier = computeRecruiterTier(hires);
        return {
          userId: row.userId,
          name: row.name || "—",
          city: row.city || null,
          photoUrl: row.photoUrl || null,
          hires,
          tierKey: tier.key,
          tierLabel: tier.label,
          avgRating: row.avgRating == null ? null : Number(row.avgRating),
          reviewCount: Number(row.reviewCount) || 0,
        };
      });
      return ok(res, { items, total: items.length, kind });
    }

    // worker leaderboard — by approved trial tasks + reviews.
    const r = await pool.query(
      `SELECT u."id" AS "userId", bp."name", bp."city", bp."photoUrl",
              bp."title",
              COUNT(DISTINCT t."id")::int AS "trialsApproved",
              (SELECT AVG(rev."rating")::float8 FROM "BuildReview" rev
                WHERE rev."revieweeId" = u."id") AS "avgRating",
              (SELECT COUNT(*)::int FROM "BuildReview" rev
                WHERE rev."revieweeId" = u."id") AS "reviewCount"
       FROM "AEVIONUser" u
       LEFT JOIN "BuildProfile" bp ON bp."userId" = u."id"
       LEFT JOIN "BuildTrialTask" t ON t."candidateId" = u."id" AND t."status" = 'APPROVED'
       WHERE bp."buildRole" IN ('WORKER','CONTRACTOR')
       GROUP BY u."id", bp."name", bp."city", bp."photoUrl", bp."title"
       ORDER BY (SELECT AVG(rev."rating")::float8 FROM "BuildReview" rev WHERE rev."revieweeId" = u."id") DESC NULLS LAST,
                COUNT(DISTINCT t."id") DESC
       LIMIT $1`,
      [limit],
    );
    const items = r.rows.map((row: Record<string, unknown>) => ({
      userId: row.userId,
      name: row.name || "—",
      title: row.title || null,
      city: row.city || null,
      photoUrl: row.photoUrl || null,
      trialsApproved: Number(row.trialsApproved) || 0,
      avgRating: row.avgRating == null ? null : Number(row.avgRating),
      reviewCount: Number(row.reviewCount) || 0,
    }));
    return ok(res, { items, total: items.length, kind });
  } catch (err: unknown) {
    return fail(res, 500, "leaderboard_failed", { details: (err as Error).message });
  }
});

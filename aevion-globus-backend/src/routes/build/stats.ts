import { Router } from "express";
import { buildPool as pool, ok, fail } from "../../lib/build";

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

// GET /api/build/stats/leaderboard — top-rated employers and workers
statsRouter.get("/leaderboard", async (_req, res) => {
  try {
    const [emps, workers] = await Promise.all([
      pool.query(
        `SELECT p."userId", u."name", p."city", p."buildRole", p."verifiedAt",
                ROUND(AVG(r."rating")::numeric, 2)::float8 AS "avgRating",
                COUNT(r."id")::int AS "reviewCount"
         FROM "BuildReview" r
         JOIN "BuildProfile" p ON p."userId" = r."revieweeId"
         JOIN "AEVIONUser" u ON u."id" = p."userId"
         WHERE p."buildRole" IN ('CLIENT','CONTRACTOR')
         GROUP BY p."userId", u."name", p."city", p."buildRole", p."verifiedAt"
         HAVING COUNT(r."id") >= 1
         ORDER BY AVG(r."rating") DESC, COUNT(r."id") DESC LIMIT 20`,
      ),
      pool.query(
        `SELECT p."userId", u."name", p."city", p."buildRole", p."verifiedAt",
                ROUND(AVG(r."rating")::numeric, 2)::float8 AS "avgRating",
                COUNT(r."id")::int AS "reviewCount"
         FROM "BuildReview" r
         JOIN "BuildProfile" p ON p."userId" = r."revieweeId"
         JOIN "AEVIONUser" u ON u."id" = p."userId"
         WHERE p."buildRole" = 'WORKER'
         GROUP BY p."userId", u."name", p."city", p."buildRole", p."verifiedAt"
         HAVING COUNT(r."id") >= 1
         ORDER BY AVG(r."rating") DESC, COUNT(r."id") DESC LIMIT 20`,
      ),
    ]);
    return ok(res, { employers: emps.rows, workers: workers.rows });
  } catch (err: unknown) {
    return fail(res, 500, "leaderboard_failed", { details: (err as Error).message });
  }
});

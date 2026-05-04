import { Router } from "express";
import { buildPool as pool, ok, fail } from "../../lib/build";

export const statsRouter = Router();

// GET /api/build/stats — public platform-wide stats, no auth.
statsRouter.get("/", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
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

// GET /api/build/stats/activity
// Public, anonymous-friendly. Returns the last 20 platform events
// (new vacancy / new application / hire) for a "live" social-proof
// scroller on the home page. Names are anonymised — we share role
// titles + cities, not who applied to what.
statsRouter.get("/activity", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
  try {
    const [vacancies, applications, hires] = await Promise.all([
      pool.query(
        `SELECT v."id", v."title", v."createdAt", p."city" AS "projectCity"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."status" = 'OPEN'
         ORDER BY v."createdAt" DESC LIMIT 10`,
      ),
      pool.query(
        `SELECT a."createdAt", v."title", p."city" AS "projectCity"
         FROM "BuildApplication" a
         LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         ORDER BY a."createdAt" DESC LIMIT 10`,
      ),
      pool.query(
        `SELECT a."updatedAt" AS "at", v."title", p."city" AS "projectCity"
         FROM "BuildApplication" a
         LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE a."status" = 'ACCEPTED'
         ORDER BY a."updatedAt" DESC LIMIT 5`,
      ),
    ]);

    type Event = { kind: string; title: string; city: string | null; at: string };
    const events: Event[] = [];
    for (const v of vacancies.rows as { title: string; createdAt: string; projectCity: string | null }[]) {
      events.push({ kind: "VACANCY", title: v.title, city: v.projectCity, at: new Date(v.createdAt).toISOString() });
    }
    for (const a of applications.rows as { title: string; createdAt: string; projectCity: string | null }[]) {
      if (!a.title) continue;
      events.push({ kind: "APPLICATION", title: a.title, city: a.projectCity, at: new Date(a.createdAt).toISOString() });
    }
    for (const h of hires.rows as { title: string; at: string; projectCity: string | null }[]) {
      if (!h.title) continue;
      events.push({ kind: "HIRE", title: h.title, city: h.projectCity, at: new Date(h.at).toISOString() });
    }
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return ok(res, { items: events.slice(0, 20), total: events.length });
  } catch (err: unknown) {
    return fail(res, 500, "stats_activity_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/timeseries — daily counts for the last 14 days, public.
// Powers the sparkline visualisations on /build/stats so people can see
// growth / liveness without us hand-curating numbers.
statsRouter.get("/timeseries", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
  try {
    const [vacancies, applications, projects] = await Promise.all([
      pool.query(
        `SELECT date_trunc('day', "createdAt") AS "day", COUNT(*)::int AS "n"
         FROM "BuildVacancy"
         WHERE "createdAt" > NOW() - INTERVAL '14 days'
         GROUP BY 1 ORDER BY 1`,
      ),
      pool.query(
        `SELECT date_trunc('day', "createdAt") AS "day", COUNT(*)::int AS "n"
         FROM "BuildApplication"
         WHERE "createdAt" > NOW() - INTERVAL '14 days'
         GROUP BY 1 ORDER BY 1`,
      ),
      pool.query(
        `SELECT date_trunc('day', "createdAt") AS "day", COUNT(*)::int AS "n"
         FROM "BuildProject"
         WHERE "createdAt" > NOW() - INTERVAL '14 days'
         GROUP BY 1 ORDER BY 1`,
      ),
    ]);

    // Densify: emit a value for every one of the last 14 days even if zero.
    function densify(rows: { day: string | Date; n: number }[]) {
      const out: { day: string; n: number }[] = [];
      const map = new Map<string, number>();
      for (const r of rows) {
        const d = new Date(r.day);
        const key = d.toISOString().slice(0, 10);
        map.set(key, Number(r.n));
      }
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        out.push({ day: key, n: map.get(key) ?? 0 });
      }
      return out;
    }

    return ok(res, {
      vacancies: densify(vacancies.rows as { day: string | Date; n: number }[]),
      applications: densify(applications.rows as { day: string | Date; n: number }[]),
      projects: densify(projects.rows as { day: string | Date; n: number }[]),
    });
  } catch (err: unknown) {
    return fail(res, 500, "stats_timeseries_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/salary?skill=AutoCAD — salary market data for a skill
statsRouter.get("/salary", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=7200");
  try {
    const skill = typeof req.query.skill === "string" ? req.query.skill.trim().slice(0, 60) : "";

    let query: string;
    let params: unknown[];
    if (skill) {
      query = `SELECT AVG("salary")::float8 AS "avg", PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "salary") AS "median",
               MIN("salary") AS "min", MAX("salary") AS "max", COUNT(*)::int AS "count"
               FROM "BuildVacancy"
               WHERE "salary" > 0 AND "skillsJson" ILIKE $1`;
      params = [`%${skill}%`];
    } else {
      query = `SELECT AVG("salary")::float8 AS "avg", PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "salary") AS "median",
               MIN("salary") AS "min", MAX("salary") AS "max", COUNT(*)::int AS "count"
               FROM "BuildVacancy" WHERE "salary" > 0`;
      params = [];
    }

    const r = await pool.query(query, params);
    const row = r.rows[0];
    return ok(res, {
      skill: skill || null,
      avg: Math.round(Number(row.avg ?? 0)),
      median: Math.round(Number(row.median ?? 0)),
      min: Number(row.min ?? 0),
      max: Number(row.max ?? 0),
      count: Number(row.count ?? 0),
    });
  } catch (err: unknown) {
    return fail(res, 500, "salary_stats_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/hires — recent accepted hires for success-stories page
statsRouter.get("/hires", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300");
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const r = await pool.query(
      `SELECT v."title" AS "vacancyTitle", p."title" AS "projectTitle", p."city" AS "projectCity",
              rc."name" AS "recruiterName", wk."name" AS "workerName",
              v."salary", v."salaryCurrency",
              a."updatedAt" AS "acceptedAt"
       FROM "BuildApplication" a
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       JOIN "BuildProject" p ON p."id" = v."projectId"
       JOIN "AEVIONUser" rc ON rc."id" = p."clientId"
       JOIN "AEVIONUser" wk ON wk."id" = a."userId"
       WHERE a."status" = 'ACCEPTED'
       ORDER BY a."updatedAt" DESC LIMIT $1`,
      [limit],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "hires_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/leaderboard — top-rated employers and workers
statsRouter.get("/leaderboard", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
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

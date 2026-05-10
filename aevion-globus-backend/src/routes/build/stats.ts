import { Router } from "express";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

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

// GET /api/build/stats/featured-employers — public top-6 employers ranked by
// hire count + review average. Fueled by /build home carousel.
statsRouter.get("/featured-employers", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  try {
    const r = await pool.query(
      `WITH per_employer AS (
         SELECT pj."clientId" AS "userId",
                COUNT(DISTINCT a."id") FILTER (WHERE a."status" = 'ACCEPTED') AS "hires",
                COUNT(DISTINCT v."id") FILTER (WHERE v."status" = 'OPEN') AS "openVacancies"
         FROM "BuildProject" pj
         LEFT JOIN "BuildVacancy" v ON v."projectId" = pj."id"
         LEFT JOIN "BuildApplication" a ON a."vacancyId" = v."id"
         GROUP BY pj."clientId"
       ),
       per_review AS (
         SELECT r."revieweeId" AS "userId",
                AVG(r."rating")::float AS "avgRating",
                COUNT(*)::int AS "reviewCount"
         FROM "BuildReview" r GROUP BY r."revieweeId"
       )
       SELECT pe."userId", u."name", p."title", p."city", p."photoUrl", p."verifiedAt",
              pe."hires", pe."openVacancies",
              COALESCE(pr."avgRating", 0) AS "avgRating",
              COALESCE(pr."reviewCount", 0) AS "reviewCount"
       FROM per_employer pe
       JOIN "AEVIONUser" u ON u."id" = pe."userId"
       LEFT JOIN "BuildProfile" p ON p."userId" = pe."userId"
       LEFT JOIN per_review pr ON pr."userId" = pe."userId"
       WHERE pe."openVacancies" > 0 OR pe."hires" > 0
       ORDER BY pe."hires" DESC, COALESCE(pr."avgRating",0) DESC, pe."openVacancies" DESC
       LIMIT 6`,
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "featured_employers_failed", { details: (err as Error).message });
  }
});

// GET /api/build/employers/:id/overview — public aggregated brand view.
// Combines the employer's profile + their projects + their open vacancies +
// summary metrics so the /build/employer/:id page (and the /build/company/:id
// alias) can render a single hero+listing without making 4 separate
// frontend round trips. No auth — public.
statsRouter.get("/employers/:id/overview", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  try {
    const id = String(req.params.id);

    const [profileQ, projectsQ, vacanciesQ, hiresQ, reviewsQ] = await Promise.all([
      pool.query(
        `SELECT p."userId", u."name", p."title", p."city", p."summary",
                p."buildRole", p."verifiedAt", p."photoUrl"
         FROM "BuildProfile" p
         JOIN "AEVIONUser" u ON u."id" = p."userId"
         WHERE p."userId" = $1 LIMIT 1`,
        [id],
      ),
      pool.query(
        `SELECT pj."id", pj."title", pj."status", pj."city", pj."budget", pj."createdAt",
                (SELECT COUNT(*)::int FROM "BuildVacancy" v WHERE v."projectId" = pj."id" AND v."status" = 'OPEN') AS "openVacancies"
         FROM "BuildProject" pj
         WHERE pj."clientId" = $1
         ORDER BY pj."createdAt" DESC LIMIT 50`,
        [id],
      ),
      pool.query(
        `SELECT v."id", v."title", v."salary", v."salaryCurrency", v."skillsJson",
                v."city", v."createdAt", v."expiresAt",
                pj."title" AS "projectTitle", pj."city" AS "projectCity"
         FROM "BuildVacancy" v
         JOIN "BuildProject" pj ON pj."id" = v."projectId"
         WHERE pj."clientId" = $1 AND v."status" = 'OPEN'
         ORDER BY v."createdAt" DESC LIMIT 30`,
        [id],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS "n"
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" pj ON pj."id" = v."projectId"
         WHERE pj."clientId" = $1 AND a."status" = 'ACCEPTED'`,
        [id],
      ),
      pool.query(
        `SELECT AVG(r."rating")::float AS "avg", COUNT(*)::int AS "n"
         FROM "BuildReview" r WHERE r."revieweeId" = $1`,
        [id],
      ),
    ]);

    if (profileQ.rowCount === 0) return fail(res, 404, "employer_not_found");

    const employer = profileQ.rows[0];
    const vacancies = vacanciesQ.rows.map((row: Record<string, unknown>) => {
      let skills: string[] = [];
      try {
        const j = row.skillsJson;
        if (typeof j === "string") skills = JSON.parse(j) as string[];
      } catch { /* ignore */ }
      return {
        ...row,
        skills,
      };
    });

    return ok(res, {
      employer,
      projects: projectsQ.rows,
      vacancies,
      stats: {
        openVacancies: vacancies.length,
        openProjects: projectsQ.rows.filter((p: { status: string }) => p.status === "OPEN").length,
        totalProjects: projectsQ.rowCount,
        hires: Number(hiresQ.rows[0]?.n ?? 0),
        avgRating: Number(reviewsQ.rows[0]?.avg ?? 0) || 0,
        reviewCount: Number(reviewsQ.rows[0]?.n ?? 0),
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "employer_overview_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/reject-reasons — recruiter-only reject reason breakdown.
// Parses the "reason:bucket|note" prefix encoded by the frontend reject modal
// and rolls up counts. Plain old free-form reasons (no prefix) are bucketed
// as "other".
statsRouter.get("/reject-reasons", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.round(daysRaw))) : 90;

    const r = await pool.query(
      `SELECT a."rejectReason"
       FROM "BuildApplication" a
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1
         AND a."status" = 'REJECTED'
         AND a."updatedAt" > NOW() - ($2 || ' days')::INTERVAL`,
      [auth.sub, String(days)],
    );

    const buckets: Record<string, number> = {
      overqualified: 0,
      "missing-skill": 0,
      "salary-mismatch": 0,
      location: 0,
      timing: 0,
      other: 0,
      unspecified: 0,
    };
    let total = 0;
    for (const row of r.rows as { rejectReason: string | null }[]) {
      total += 1;
      const raw = row.rejectReason ?? "";
      if (!raw) {
        buckets.unspecified += 1;
        continue;
      }
      const m = /^reason:([a-z\-]+)\|/i.exec(raw);
      const key = m ? m[1].toLowerCase() : "other";
      buckets[key] = (buckets[key] ?? 0) + 1;
    }

    return ok(res, { days, total, buckets });
  } catch (err: unknown) {
    return fail(res, 500, "stats_reject_reasons_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/export/all — recruiter-only data export bundle.
// Returns JSON with 4 datasets (projects, vacancies, applications, reviews)
// scoped to the calling recruiter. Frontend turns this into 4 CSV downloads —
// avoids taking a server-side zip dependency.
statsRouter.get("/export/all", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [projects, vacancies, applications, reviews] = await Promise.all([
      pool.query(
        `SELECT pj."id", pj."title", pj."status", pj."city", pj."budget",
                pj."createdAt"
         FROM "BuildProject" pj
         WHERE pj."clientId" = $1
         ORDER BY pj."createdAt" DESC`,
        [auth.sub],
      ),
      pool.query(
        `SELECT v."id", v."projectId", v."title", v."status", v."salary",
                v."salaryCurrency", v."city", v."createdAt", v."expiresAt",
                v."viewCount"
         FROM "BuildVacancy" v
         JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE p."clientId" = $1
         ORDER BY v."createdAt" DESC`,
        [auth.sub],
      ),
      pool.query(
        `SELECT a."id", a."vacancyId", a."status", a."labelKey", a."sourceTag",
                a."matchScore", a."aiScoreOverall", a."rejectReason",
                a."createdAt", a."updatedAt",
                u."name" AS "applicantName", u."email" AS "applicantEmail"
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" p ON p."id" = v."projectId"
         JOIN "AEVIONUser" u ON u."id" = a."userId"
         WHERE p."clientId" = $1
         ORDER BY a."createdAt" DESC`,
        [auth.sub],
      ),
      pool.query(
        `SELECT r."id", r."rating", r."comment", r."revieweeId", r."reviewerId",
                r."createdAt"
         FROM "BuildReview" r
         WHERE r."revieweeId" = $1 OR r."reviewerId" = $1
         ORDER BY r."createdAt" DESC`,
        [auth.sub],
      ),
    ]);

    return ok(res, {
      generatedAt: new Date().toISOString(),
      ownerUserId: auth.sub,
      counts: {
        projects: projects.rowCount,
        vacancies: vacancies.rowCount,
        applications: applications.rowCount,
        reviews: reviews.rowCount,
      },
      datasets: {
        projects: projects.rows,
        vacancies: vacancies.rows,
        applications: applications.rows,
        reviews: reviews.rows,
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "export_all_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stats/sources — recruiter-only attribution breakdown.
// Buckets the caller's incoming applications by sourceTag prefix:
//   organic | utm:* | ref:* | widget | (null -> "organic")
// Returns counts per bucket so the dashboard can render a stacked bar.
statsRouter.get("/sources", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    // Optional ?days=30 window (1-180, default 30).
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(180, Math.round(daysRaw))) : 30;

    // Optional ?vacancyId — narrow to one vacancy. We still scope by ownership
    // so a recruiter can't peek at competitors' sources.
    const vacancyId = typeof req.query.vacancyId === "string" && req.query.vacancyId.trim()
      ? req.query.vacancyId.trim().slice(0, 200) : null;

    const params: unknown[] = [auth.sub, String(days)];
    let extraWhere = "";
    if (vacancyId) {
      params.push(vacancyId);
      extraWhere = ` AND a."vacancyId" = $${params.length}`;
    }

    const r = await pool.query(
      `SELECT COALESCE(a."sourceTag", 'organic') AS "tag",
              COUNT(*)::int AS "n"
       FROM "BuildApplication" a
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1
         AND a."createdAt" > NOW() - ($2 || ' days')::INTERVAL
         ${extraWhere}
       GROUP BY 1
       ORDER BY 2 DESC`,
      params,
    );

    type Bucket = "organic" | "utm" | "ref" | "widget" | "other";
    const buckets: Record<Bucket, { count: number; details: { tag: string; count: number }[] }> = {
      organic: { count: 0, details: [] },
      utm: { count: 0, details: [] },
      ref: { count: 0, details: [] },
      widget: { count: 0, details: [] },
      other: { count: 0, details: [] },
    };
    let total = 0;
    for (const row of r.rows as { tag: string; n: number }[]) {
      const tag = String(row.tag || "organic").toLowerCase();
      const n = Number(row.n);
      total += n;
      let bucket: Bucket = "other";
      if (tag === "organic") bucket = "organic";
      else if (tag.startsWith("utm:")) bucket = "utm";
      else if (tag.startsWith("ref:")) bucket = "ref";
      else if (tag === "widget") bucket = "widget";
      buckets[bucket].count += n;
      buckets[bucket].details.push({ tag, count: n });
    }

    return ok(res, {
      days,
      total,
      buckets,
    });
  } catch (err: unknown) {
    return fail(res, 500, "stats_sources_failed", { details: (err as Error).message });
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

// GET /api/build/stats/weekly — owner-scoped 7-day rollup for the dashboard.
// Returns weekly totals and the same window 7 days earlier for delta arrows.
statsRouter.get("/weekly", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const now = Date.now();
    const wkStart = new Date(now - 7 * 86400_000);
    const prevStart = new Date(now - 14 * 86400_000);

    const [appsThis, appsPrev, vacsThis, vacsPrev, hiresThis, hiresPrev] =
      await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildApplication" a
           JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND a."createdAt" >= $2`,
          [auth.sub, wkStart],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildApplication" a
           JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND a."createdAt" >= $2 AND a."createdAt" < $3`,
          [auth.sub, prevStart, wkStart],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildVacancy" v
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND v."createdAt" >= $2`,
          [auth.sub, wkStart],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildVacancy" v
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND v."createdAt" >= $2 AND v."createdAt" < $3`,
          [auth.sub, prevStart, wkStart],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildApplication" a
           JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND a."status" = 'ACCEPTED' AND a."updatedAt" >= $2`,
          [auth.sub, wkStart],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "BuildApplication" a
           JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND a."status" = 'ACCEPTED' AND a."updatedAt" >= $2 AND a."updatedAt" < $3`,
          [auth.sub, prevStart, wkStart],
        ),
      ]);

    function delta(now: number, prev: number) {
      return { now, prev, change: now - prev };
    }

    return ok(res, {
      windowStart: wkStart.toISOString(),
      windowEnd: new Date(now).toISOString(),
      applications: delta(appsThis.rows[0].n, appsPrev.rows[0].n),
      vacanciesPosted: delta(vacsThis.rows[0].n, vacsPrev.rows[0].n),
      hires: delta(hiresThis.rows[0].n, hiresPrev.rows[0].n),
    });
  } catch (err: unknown) {
    return fail(res, 500, "stats_weekly_failed", { details: (err as Error).message });
  }
});

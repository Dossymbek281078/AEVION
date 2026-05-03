import { Router } from "express";
import { buildPool as pool, ok, fail } from "../../lib/build";

export const salaryStatsRouter = Router();

// GET /api/build/salary-stats — market salary intelligence.
// Public, no auth. Aggregates anonymised salary data from:
//   - BuildProfile.salaryMin/Max (worker expectations)
//   - BuildVacancy.salary (employer offers)
// Query: ?q=specialty&city=&role=WORKER|CLIENT&limit=5 (top cities)
salaryStatsRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : null;
    const city = typeof req.query.city === "string" ? req.query.city.trim() : null;

    const profileParams: unknown[] = [];
    const profileWhere: string[] = [
      `("salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL)`,
    ];
    if (q) {
      profileParams.push(`%${q}%`);
      profileWhere.push(`("title" ILIKE $${profileParams.length} OR "skillsJson" ILIKE $${profileParams.length})`);
    }
    if (city) {
      profileParams.push(`%${city}%`);
      profileWhere.push(`"city" ILIKE $${profileParams.length}`);
    }

    const vacancyParams: unknown[] = [`salary > 0`];
    const vacancyWhere: string[] = [`v."salary" > 0`];
    if (q) {
      vacancyParams.push(`%${q}%`);
      vacancyWhere.push(`(v."title" ILIKE $${vacancyParams.length} OR v."description" ILIKE $${vacancyParams.length})`);
    }
    if (city) {
      vacancyParams.push(`%${city}%`);
      vacancyWhere.push(`p."city" ILIKE $${vacancyParams.length}`);
    }

    const [profileStats, vacancyStats, topCities] = await Promise.all([
      // Worker salary expectations
      pool.query(
        `SELECT
           COUNT(*)::int AS "sampleSize",
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY COALESCE("salaryMin","salaryMax")) AS "p25",
           PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY COALESCE("salaryMin","salaryMax")) AS "p50",
           PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY COALESCE("salaryMin","salaryMax")) AS "p75",
           MIN(COALESCE("salaryMin","salaryMax")) AS "min",
           MAX(COALESCE("salaryMax","salaryMin")) AS "max",
           MODE() WITHIN GROUP (ORDER BY "salaryCurrency") AS "currency"
         FROM "BuildProfile"
         WHERE ${profileWhere.join(" AND ")}`,
        profileParams,
      ),
      // Employer vacancy offers
      pool.query(
        `SELECT
           COUNT(*)::int AS "sampleSize",
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY v."salary") AS "p25",
           PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY v."salary") AS "p50",
           PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY v."salary") AS "p75",
           MIN(v."salary") AS "min",
           MAX(v."salary") AS "max",
           MODE() WITHIN GROUP (ORDER BY v."salaryCurrency") AS "currency"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE ${vacancyWhere.join(" AND ")}`,
        vacancyParams.slice(1), // skip first placeholder (it was a string literal)
      ),
      // Top cities by vacancy count
      pool.query(
        `SELECT p."city", COUNT(*)::int AS "vacancyCount",
                AVG(v."salary")::float8 AS "avgSalary"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."salary" > 0 AND p."city" IS NOT NULL
         GROUP BY p."city"
         ORDER BY "vacancyCount" DESC
         LIMIT 5`,
      ),
    ]).catch(() => [
      { rows: [{}] }, { rows: [{}] }, { rows: [] }
    ]);

    const round = (n: unknown) => n != null ? Math.round(Number(n)) : null;

    return ok(res, {
      workerExpectations: {
        sampleSize: profileStats.rows[0]?.sampleSize ?? 0,
        p25: round(profileStats.rows[0]?.p25),
        p50: round(profileStats.rows[0]?.p50),
        p75: round(profileStats.rows[0]?.p75),
        min: round(profileStats.rows[0]?.min),
        max: round(profileStats.rows[0]?.max),
        currency: profileStats.rows[0]?.currency || "RUB",
      },
      employerOffers: {
        sampleSize: vacancyStats.rows[0]?.sampleSize ?? 0,
        p25: round(vacancyStats.rows[0]?.p25),
        p50: round(vacancyStats.rows[0]?.p50),
        p75: round(vacancyStats.rows[0]?.p75),
        min: round(vacancyStats.rows[0]?.min),
        max: round(vacancyStats.rows[0]?.max),
        currency: vacancyStats.rows[0]?.currency || "RUB",
      },
      topCities: topCities.rows.map((r: Record<string, unknown>) => ({
        city: r.city,
        vacancyCount: r.vacancyCount,
        avgSalary: round(r.avgSalary),
      })),
      query: { q, city },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return fail(res, 500, "salary_stats_failed", { details: (err as Error).message });
  }
});

import { Router } from "express";
import {
  buildPool as pool,
  ok,
  PROJECT_STATUSES,
  VACANCY_STATUSES,
  APPLICATION_STATUSES,
  BUILD_ROLES,
} from "../../lib/build";

// In-memory request counter (resets on restart — Prometheus-style gauge)
let _reqCount = 0;
export function incrementBuildReqCount() { _reqCount++; }

export const healthRouter = Router();

// GET /api/build/health — public, best-effort counters (swallows DB errors).
healthRouter.get("/", async (_req, res) => {
  let vacancies = 0;
  let candidates = 0;
  let projects = 0;
  try {
    const r = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildVacancy" WHERE "status" = 'OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProfile"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProject" WHERE "status" = 'OPEN'`),
    ]);
    vacancies = Number(r[0].rows[0]?.n ?? 0);
    candidates = Number(r[1].rows[0]?.n ?? 0);
    projects = Number(r[2].rows[0]?.n ?? 0);
    _reqCount++;
  } catch {
    // swallow — still return 200
  }
  return ok(res, {
    service: "qbuild",
    status: "ok",
    statuses: {
      project: PROJECT_STATUSES,
      vacancy: VACANCY_STATUSES,
      application: APPLICATION_STATUSES,
      role: BUILD_ROLES,
    },
    vacancies,
    candidates,
    projects,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/build/health/metrics — Prometheus text format (public)
healthRouter.get("/metrics", async (_req, res) => {
  let vacancies = 0, candidates = 0, projects = 0, applications = 0, reviews = 0;
  try {
    const r = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM "BuildVacancy" WHERE "status"='OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "BuildProfile"`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "BuildProject" WHERE "status"='OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "BuildApplication"`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "BuildReview"`),
    ]);
    vacancies = Number(r[0].rows[0]?.n ?? 0);
    candidates = Number(r[1].rows[0]?.n ?? 0);
    projects = Number(r[2].rows[0]?.n ?? 0);
    applications = Number(r[3].rows[0]?.n ?? 0);
    reviews = Number(r[4].rows[0]?.n ?? 0);
  } catch { /* best-effort */ }

  const lines = [
    `# HELP qbuild_vacancies_open Open vacancies`,
    `# TYPE qbuild_vacancies_open gauge`,
    `qbuild_vacancies_open ${vacancies}`,
    `# HELP qbuild_candidates_total Total candidate profiles`,
    `# TYPE qbuild_candidates_total gauge`,
    `qbuild_candidates_total ${candidates}`,
    `# HELP qbuild_projects_open Open projects`,
    `# TYPE qbuild_projects_open gauge`,
    `qbuild_projects_open ${projects}`,
    `# HELP qbuild_applications_total Total applications`,
    `# TYPE qbuild_applications_total gauge`,
    `qbuild_applications_total ${applications}`,
    `# HELP qbuild_reviews_total Total reviews`,
    `# TYPE qbuild_reviews_total gauge`,
    `qbuild_reviews_total ${reviews}`,
    `# HELP qbuild_requests_total Request counter (since startup)`,
    `# TYPE qbuild_requests_total counter`,
    `qbuild_requests_total ${_reqCount}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return res.send(lines + "\n");
});

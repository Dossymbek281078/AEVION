import { Router } from "express";
import {
  buildPool as pool,
  ok,
  PROJECT_STATUSES,
  VACANCY_STATUSES,
  APPLICATION_STATUSES,
  BUILD_ROLES,
} from "../../lib/build";

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

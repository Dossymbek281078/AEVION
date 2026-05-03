import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
  vEnum,
  PROJECT_STATUSES,
} from "../../lib/build";

export const projectsRouter = Router();

// POST /api/build/projects
projectsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);
    const budget = req.body?.budget == null
      ? { ok: true as const, value: 0 }
      : vNumber(req.body.budget, "budget", { min: 0, max: 1e12 });
    if (budget.ok === false) return fail(res, 400, budget.error);
    const city = req.body?.city == null
      ? { ok: true as const, value: null }
      : vString(req.body.city, "city", { max: 100, allowEmpty: true });
    if (city.ok === false) return fail(res, 400, city.error);

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildProject" ("id","title","description","budget","status","city","clientId")
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6) RETURNING *`,
      [id, title.value, description.value, budget.value, city.value || null, auth.sub],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "project_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects
projectsRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;
    const mine = req.query.mine === "1" || req.query.mine === "true";

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status) {
      const e = vEnum(status, "status", PROJECT_STATUSES);
      if (!e.ok) return fail(res, 400, e.error);
      params.push(e.value);
      conds.push(`"status" = $${params.length}`);
    }
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`("title" ILIKE $${params.length} OR "description" ILIKE $${params.length})`);
    }
    if (mine) {
      const auth = requireBuildAuth(req, res);
      if (!auth) return;
      params.push(auth.sub);
      conds.push(`"clientId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM "BuildVacancy" v WHERE v."projectId" = p."id")::int AS "vacancyCount"
       FROM "BuildProject" p
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "projects_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id
projectsRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await pool.query(`SELECT * FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [id]);
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");

    const [vacancies, files, client] = await Promise.all([
      pool.query(`SELECT * FROM "BuildVacancy" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`, [id]),
      pool.query(`SELECT "id","url","name","mimeType","sizeBytes","createdAt" FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`, [id]),
      pool.query(
        `SELECT u."id", u."email", u."name", p."city", p."buildRole"
         FROM "AEVIONUser" u LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    return ok(res, { project: project.rows[0], vacancies: vacancies.rows, files: files.rows, client: client.rows[0] || null });
  } catch (err: unknown) {
    return fail(res, 500, "project_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/public — PII-stripped, cacheable
projectsRouter.get("/:id/public", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await pool.query(
      `SELECT "id","title","description","budget","status","city","clientId","createdAt","updatedAt"
       FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");

    const [vacancies, files, client] = await Promise.all([
      pool.query(
        `SELECT v."id", v."title", v."description", v."salary", v."status", v."createdAt",
                (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount"
         FROM "BuildVacancy" v WHERE v."projectId" = $1 ORDER BY v."createdAt" DESC`,
        [id],
      ),
      pool.query(`SELECT "id","url","name","mimeType","sizeBytes","createdAt" FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`, [id]),
      pool.query(
        `SELECT u."name", p."city", p."buildRole", p."verifiedAt"
         FROM "AEVIONUser" u LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, { project: project.rows[0], vacancies: vacancies.rows, files: files.rows, client: client.rows[0] || null });
  } catch (err: unknown) {
    return fail(res, 500, "project_public_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/projects/:id — owner only
projectsRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const existing = await pool.query(`SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [id]);
    if (existing.rowCount === 0) return fail(res, 404, "project_not_found");
    if (existing.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const sets: string[] = [];
    const params: unknown[] = [];
    if (req.body?.title !== undefined) {
      const v = vString(req.body.title, "title", { min: 3, max: 200 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); sets.push(`"title" = $${params.length}`);
    }
    if (req.body?.description !== undefined) {
      const v = vString(req.body.description, "description", { min: 10, max: 10_000 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); sets.push(`"description" = $${params.length}`);
    }
    if (req.body?.budget !== undefined) {
      const v = vNumber(req.body.budget, "budget", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); sets.push(`"budget" = $${params.length}`);
    }
    if (req.body?.status !== undefined) {
      const v = vEnum(req.body.status, "status", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); sets.push(`"status" = $${params.length}`);
    }
    if (req.body?.city !== undefined) {
      const v = vString(req.body.city, "city", { max: 100, allowEmpty: true });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value || null); sets.push(`"city" = $${params.length}`);
    }
    if (sets.length === 0) return fail(res, 400, "no_fields_to_update");

    sets.push(`"updatedAt" = NOW()`);
    params.push(id);
    const result = await pool.query(
      `UPDATE "BuildProject" SET ${sets.join(", ")} WHERE "id" = $${params.length} RETURNING *`,
      params,
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "project_update_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/analytics — owner-only project summary
projectsRouter.get("/:id/analytics", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const project = await pool.query(`SELECT "clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [id]);
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const [vacStats, appStats, reviewStats] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS "total", SUM("viewCount")::int AS "totalViews",
                SUM(CASE WHEN "status"='OPEN' THEN 1 ELSE 0 END)::int AS "open",
                SUM(CASE WHEN "status"='CLOSED' THEN 1 ELSE 0 END)::int AS "closed"
         FROM "BuildVacancy" WHERE "projectId" = $1`,
        [id],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS "total",
                SUM(CASE WHEN a."status"='ACCEPTED' THEN 1 ELSE 0 END)::int AS "accepted",
                SUM(CASE WHEN a."status"='PENDING' THEN 1 ELSE 0 END)::int AS "pending",
                SUM(CASE WHEN a."status"='REJECTED' THEN 1 ELSE 0 END)::int AS "rejected"
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         WHERE v."projectId" = $1`,
        [id],
      ),
      pool.query(
        `SELECT ROUND(AVG("rating")::numeric,2)::float8 AS "avg", COUNT(*)::int AS "count"
         FROM "BuildReview" WHERE "projectId" = $1`,
        [id],
      ),
    ]);

    const v = vacStats.rows[0];
    const a = appStats.rows[0];
    const r = reviewStats.rows[0];

    return ok(res, {
      vacancies: { total: v.total, open: v.open, closed: v.closed, totalViews: v.totalViews ?? 0 },
      applications: {
        total: a.total, accepted: a.accepted, pending: a.pending, rejected: a.rejected,
        conversionRate: v.totalViews > 0 ? Math.round((a.total / v.totalViews) * 1000) / 10 : 0,
      },
      reviews: { avgRating: r.avg ?? 0, count: r.count },
    });
  } catch (err: unknown) {
    return fail(res, 500, "project_analytics_failed", { details: (err as Error).message });
  }
});

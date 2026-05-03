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

// GET /api/build/projects/:id/certificate — completion certificate (when status=DONE)
projectsRouter.get("/:id/certificate", async (req, res) => {
  try {
    const id = String(req.params.id);
    const proj = await pool.query(
      `SELECT p.*, u."name" AS "clientName", u."email" AS "clientEmail"
       FROM "BuildProject" p
       LEFT JOIN "AEVIONUser" u ON u."id" = p."clientId"
       WHERE p."id" = $1 LIMIT 1`,
      [id],
    );
    if (proj.rowCount === 0) return fail(res, 404, "project_not_found");
    const p = proj.rows[0] as Record<string, unknown>;
    if (p.status !== "DONE") return fail(res, 400, "project_not_done");

    const workers = await pool.query(
      `SELECT DISTINCT u."id", u."name", bp."title" AS "role", bp."city",
              a."updatedAt" AS "hiredAt"
       FROM "BuildApplication" a
       JOIN "AEVIONUser" u ON u."id" = a."userId"
       LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       WHERE v."projectId" = $1 AND a."status" = 'ACCEPTED'`,
      [id],
    );

    const cert = {
      certId: `QBUILD-${id.slice(0, 8).toUpperCase()}`,
      project: {
        id: p.id,
        title: p.title,
        city: p.city,
        budget: p.budget,
        completedAt: p.updatedAt,
      },
      client: { name: p.clientName, email: p.clientEmail },
      workers: workers.rows,
      issuedAt: new Date().toISOString(),
      platform: "AEVION QBuild",
      qsignUrl: `/qsign?payload=${encodeURIComponent(JSON.stringify({ type: "QBUILD_CERT", projectId: id }))}`,
    };

    return ok(res, cert);
  } catch (err: unknown) {
    return fail(res, 500, "certificate_failed", { details: (err as Error).message });
  }
});

// POST /api/build/projects/:id/reference — client leaves reference for a worker
projectsRouter.post("/:id/reference", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const projectId = String(req.params.id);

    const proj = await pool.query(`SELECT "clientId","status" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [projectId]);
    if (proj.rowCount === 0) return fail(res, 404, "project_not_found");
    if (proj.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_client_can_leave_reference");
    if (proj.rows[0].status !== "DONE") return fail(res, 400, "project_must_be_done");

    const workerId = String(req.body?.workerId || "");
    if (!workerId) return fail(res, 400, "workerId required");
    const wouldHireAgain = req.body?.wouldHireAgain === true;
    const quality = typeof req.body?.quality === "number" ? Math.max(1, Math.min(5, Math.round(req.body.quality))) : null;
    const reliability = typeof req.body?.reliability === "number" ? Math.max(1, Math.min(5, Math.round(req.body.reliability))) : null;
    const comment = req.body?.comment == null ? null : String(req.body.comment).trim().slice(0, 1000) || null;

    const id = crypto.randomUUID();
    try {
      const r = await pool.query(
        `INSERT INTO "BuildReference" ("id","projectId","workerId","clientId","wouldHireAgain","quality","reliability","comment")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, projectId, workerId, auth.sub, wouldHireAgain, quality, reliability, comment],
      );
      return ok(res, r.rows[0], 201);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        const existing = await pool.query(
          `SELECT * FROM "BuildReference" WHERE "projectId" = $1 AND "workerId" = $2 LIMIT 1`,
          [projectId, workerId],
        );
        return ok(res, existing.rows[0]);
      }
      throw err;
    }
  } catch (err: unknown) {
    return fail(res, 500, "reference_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/references — list references for a project
projectsRouter.get("/:id/references", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ref.*, u."name" AS "clientName"
       FROM "BuildReference" ref
       LEFT JOIN "AEVIONUser" u ON u."id" = ref."clientId"
       WHERE ref."projectId" = $1`,
      [req.params.id],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "references_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/references/worker/:id — all references for a worker (public)
projectsRouter.get("/worker-references/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ref.*, u."name" AS "clientName", p."title" AS "projectTitle"
       FROM "BuildReference" ref
       LEFT JOIN "AEVIONUser" u ON u."id" = ref."clientId"
       LEFT JOIN "BuildProject" p ON p."id" = ref."projectId"
       WHERE ref."workerId" = $1 ORDER BY ref."createdAt" DESC`,
      [req.params.id],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "worker_references_failed", { details: (err as Error).message });
  }
});

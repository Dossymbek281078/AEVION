import { Router } from "express";
import crypto from "crypto";
import {
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
  vEnum,
  ensureBuildTables,
  buildPool as pool,
  PROJECT_STATUSES,
  VACANCY_STATUSES,
  APPLICATION_STATUSES,
  BUILD_ROLES,
} from "../lib/build";

export const buildRouter = Router();

// Bootstrap tables on first request, then short-circuit on the cached flag.
buildRouter.use(async (_req, res, next) => {
  try {
    await ensureBuildTables();
    next();
  } catch (err: unknown) {
    console.error("[build] ensureBuildTables failed:", err);
    fail(res, 500, "build_init_failed");
  }
});

// ──────────────────────────────────────────────────────────────────────
// Users / Profile
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/users/me — current user + build profile (if any)
buildRouter.get("/users/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const u = await pool.query(
      `SELECT "id", "email", "name", "role", "createdAt"
       FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (u.rowCount === 0) return fail(res, 404, "user_not_found");

    const p = await pool.query(
      `SELECT * FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );

    return ok(res, {
      user: u.rows[0],
      profile: p.rows[0] || null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "users_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/profiles — upsert own build profile
buildRouter.post("/profiles", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const name = vString(req.body?.name, "name", { min: 2, max: 200 });
    if (!name.ok) return fail(res, 400, name.error);

    const phone = req.body?.phone == null
      ? { ok: true as const, value: null }
      : vString(req.body.phone, "phone", { max: 32, allowEmpty: true });
    if (phone.ok === false) return fail(res, 400, phone.error);

    const city = req.body?.city == null
      ? { ok: true as const, value: null }
      : vString(req.body.city, "city", { max: 100, allowEmpty: true });
    if (city.ok === false) return fail(res, 400, city.error);

    const description = req.body?.description == null
      ? { ok: true as const, value: null }
      : vString(req.body.description, "description", { max: 4000, allowEmpty: true });
    if (description.ok === false) return fail(res, 400, description.error);

    const role = req.body?.buildRole == null
      ? { ok: true as const, value: "CLIENT" as const }
      : vEnum(req.body.buildRole, "buildRole", BUILD_ROLES);
    if (role.ok === false) return fail(res, 400, role.error);
    // ADMIN cannot be self-assigned via API.
    if (role.value === "ADMIN" && auth.role !== "ADMIN") {
      return fail(res, 403, "admin_role_not_self_assignable");
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildProfile" ("id","userId","name","phone","city","description","buildRole")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("userId") DO UPDATE SET
         "name" = EXCLUDED."name",
         "phone" = EXCLUDED."phone",
         "city" = EXCLUDED."city",
         "description" = EXCLUDED."description",
         "buildRole" = EXCLUDED."buildRole",
         "updatedAt" = NOW()
       RETURNING *`,
      [
        id,
        auth.sub,
        name.value,
        phone.value || null,
        city.value || null,
        description.value || null,
        role.value,
      ],
    );

    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "profile_upsert_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/:id — public profile by userId
buildRouter.get("/profiles/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT p."id", p."userId", p."name", p."city", p."description", p."buildRole", p."createdAt",
              u."email"
       FROM "BuildProfile" p
       LEFT JOIN "AEVIONUser" u ON u."id" = p."userId"
       WHERE p."userId" = $1
       LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "profile_fetch_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/projects
buildRouter.post("/projects", async (req, res) => {
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
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6)
       RETURNING *`,
      [id, title.value, description.value, budget.value, city.value || null, auth.sub],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "project_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects?status=&q=&limit=&mine=1
buildRouter.get("/projects", async (req, res) => {
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

// GET /api/build/projects/:id — project + vacancies + files
buildRouter.get("/projects/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await pool.query(`SELECT * FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [id]);
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");

    const [vacancies, files, client] = await Promise.all([
      pool.query(
        `SELECT * FROM "BuildVacancy" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT "id","url","name","mimeType","sizeBytes","createdAt"
         FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT u."id", u."email", u."name", p."city", p."buildRole"
         FROM "AEVIONUser" u
         LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    return ok(res, {
      project: project.rows[0],
      vacancies: vacancies.rows,
      files: files.rows,
      client: client.rows[0] || null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "project_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/public — read-only, PII-stripped, cacheable
// Public sharable view for /build/p/[id] SSR. Hides email/phone, keeps name/city.
buildRouter.get("/projects/:id/public", async (req, res) => {
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
         FROM "BuildVacancy" v
         WHERE v."projectId" = $1
         ORDER BY v."createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT "id","url","name","mimeType","sizeBytes","createdAt"
         FROM "BuildFile" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT u."name", p."city", p."buildRole"
         FROM "AEVIONUser" u
         LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
         WHERE u."id" = $1 LIMIT 1`,
        [project.rows[0].clientId],
      ),
    ]);

    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      project: project.rows[0],
      vacancies: vacancies.rows,
      files: files.rows,
      client: client.rows[0] || null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "project_public_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/projects/:id — owner-only
buildRouter.patch("/projects/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const existing = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (existing.rowCount === 0) return fail(res, 404, "project_not_found");
    if (existing.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "not_owner");
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (req.body?.title !== undefined) {
      const v = vString(req.body.title, "title", { min: 3, max: 200 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"title" = $${params.length}`);
    }
    if (req.body?.description !== undefined) {
      const v = vString(req.body.description, "description", { min: 10, max: 10_000 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"description" = $${params.length}`);
    }
    if (req.body?.budget !== undefined) {
      const v = vNumber(req.body.budget, "budget", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"budget" = $${params.length}`);
    }
    if (req.body?.status !== undefined) {
      const v = vEnum(req.body.status, "status", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      sets.push(`"status" = $${params.length}`);
    }
    if (req.body?.city !== undefined) {
      const v = vString(req.body.city, "city", { max: 100, allowEmpty: true });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value || null);
      sets.push(`"city" = $${params.length}`);
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

// ──────────────────────────────────────────────────────────────────────
// Vacancies
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/vacancies — only project owner can create
buildRouter.post("/vacancies", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!projectId.ok) return fail(res, 400, projectId.error);

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);

    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);

    const salary = req.body?.salary == null
      ? { ok: true as const, value: 0 }
      : vNumber(req.body.salary, "salary", { min: 0, max: 1e12 });
    if (salary.ok === false) return fail(res, 400, salary.error);

    const project = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [projectId.value],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_post_vacancies");
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVacancy" ("id","projectId","title","description","salary")
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [id, projectId.value, title.value, description.value, salary.value],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies — cross-project feed with filters
// Query: ?status=OPEN|CLOSED · ?q=text · ?city=Almaty · ?minSalary=N
//        ?projectStatus=OPEN|IN_PROGRESS|DONE · ?limit=1..100 (default 50)
// Public (no auth). Joins project for title/city/status badges.
buildRouter.get("/vacancies", async (req, res) => {
  try {
    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.status === "string") {
      const v = vEnum(req.query.status, "status", VACANCY_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`v."status" = $${params.length}`);
    }
    if (typeof req.query.projectStatus === "string") {
      const v = vEnum(req.query.projectStatus, "projectStatus", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`p."status" = $${params.length}`);
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(`(v."title" ILIKE $${params.length} OR v."description" ILIKE $${params.length})`);
    }
    if (typeof req.query.city === "string" && req.query.city.trim()) {
      params.push(req.query.city.trim());
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (req.query.minSalary !== undefined) {
      const v = vNumber(req.query.minSalary, "minSalary", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value);
      where.push(`v."salary" >= $${params.length}`);
    }

    const limitRaw = req.query.limit !== undefined ? vNumber(req.query.limit, "limit", { min: 1, max: 100 }) : { ok: true as const, value: 50 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const result = await pool.query(
      `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status", v."createdAt",
              p."title" AS "projectTitle", p."status" AS "projectStatus", p."city" AS "projectCity", p."clientId",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY v."createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_feed_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/by-project/:id
buildRouter.get("/vacancies/by-project/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT v.*,
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount"
       FROM "BuildVacancy" v
       WHERE v."projectId" = $1
       ORDER BY v."createdAt" DESC`,
      [id],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id — vacancy detail + project link
buildRouter.get("/vacancies/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT v.*, p."title" AS "projectTitle", p."status" AS "projectStatus", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1
       LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_fetch_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Applications
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/applications — apply to vacancy
buildRouter.post("/applications", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const vacancyId = vString(req.body?.vacancyId, "vacancyId", { min: 1, max: 200 });
    if (!vacancyId.ok) return fail(res, 400, vacancyId.error);

    const message = req.body?.message == null
      ? { ok: true as const, value: null }
      : vString(req.body.message, "message", { max: 4000, allowEmpty: true });
    if (message.ok === false) return fail(res, 400, message.error);

    const vacancy = await pool.query(
      `SELECT v."id", v."status" AS "vacancyStatus", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId.value],
    );
    if (vacancy.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (vacancy.rows[0].vacancyStatus === "CLOSED") return fail(res, 409, "vacancy_closed");
    if (vacancy.rows[0].clientId === auth.sub) {
      return fail(res, 400, "cannot_apply_to_own_vacancy");
    }

    const id = crypto.randomUUID();
    try {
      const result = await pool.query(
        `INSERT INTO "BuildApplication" ("id","vacancyId","userId","message")
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [id, vacancyId.value, auth.sub, message.value || null],
      );
      return ok(res, result.rows[0], 201);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "23505") return fail(res, 409, "already_applied");
      throw err;
    }
  } catch (err: unknown) {
    return fail(res, 500, "application_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/applications/my — my applications across vacancies
buildRouter.get("/applications/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `SELECT a.*, v."title" AS "vacancyTitle", v."salary", p."id" AS "projectId", p."title" AS "projectTitle"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."userId" = $1
       ORDER BY a."createdAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/applications/by-vacancy/:id — owner-only
buildRouter.get("/applications/by-vacancy/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_list");
    }

    const result = await pool.query(
      `SELECT a.*, u."email", u."name" AS "applicantName", bp."city" AS "applicantCity"
       FROM "BuildApplication" a
       LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
       LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
       WHERE a."vacancyId" = $1
       ORDER BY a."createdAt" DESC`,
      [id],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_by_vacancy_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/applications/:id — owner of vacancy can ACCEPT/REJECT
buildRouter.patch("/applications/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", APPLICATION_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT a."id", a."userId", p."clientId"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "application_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_update");
    }

    const result = await pool.query(
      `UPDATE "BuildApplication"
       SET "status" = $1, "updatedAt" = NOW()
       WHERE "id" = $2
       RETURNING *`,
      [status.value, id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_update_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Messaging
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/messages — send DM
buildRouter.post("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const receiverId = vString(req.body?.receiverId, "receiverId", { min: 1, max: 200 });
    if (!receiverId.ok) return fail(res, 400, receiverId.error);
    if (receiverId.value === auth.sub) return fail(res, 400, "cannot_message_self");

    const content = vString(req.body?.content, "content", { min: 1, max: 4000 });
    if (!content.ok) return fail(res, 400, content.error);

    const recv = await pool.query(`SELECT "id" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [receiverId.value]);
    if (recv.rowCount === 0) return fail(res, 404, "receiver_not_found");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildMessage" ("id","senderId","receiverId","content")
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [id, auth.sub, receiverId.value, content.value],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "message_send_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages/:userId — full thread between current user and :userId
buildRouter.get("/messages/:userId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const peerId = String(req.params.userId);
    if (peerId === auth.sub) return fail(res, 400, "cannot_thread_with_self");

    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const result = await pool.query(
      `SELECT * FROM "BuildMessage"
       WHERE ("senderId" = $1 AND "receiverId" = $2)
          OR ("senderId" = $2 AND "receiverId" = $1)
       ORDER BY "createdAt" ASC
       LIMIT $3`,
      [auth.sub, peerId, limit],
    );

    // Best-effort mark-as-read for inbound messages from peer.
    pool
      .query(
        `UPDATE "BuildMessage" SET "readAt" = NOW()
         WHERE "receiverId" = $1 AND "senderId" = $2 AND "readAt" IS NULL`,
        [auth.sub, peerId],
      )
      .catch((err: Error) => {
        console.warn("[build] mark-read failed:", err.message);
      });

    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_thread_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages — inbox summary (latest msg per peer)
buildRouter.get("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `WITH threads AS (
         SELECT
           CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS "peerId",
           MAX("createdAt") AS "lastAt"
         FROM "BuildMessage"
         WHERE "senderId" = $1 OR "receiverId" = $1
         GROUP BY 1
       )
       SELECT
         t."peerId",
         u."name" AS "peerName",
         u."email" AS "peerEmail",
         t."lastAt",
         (SELECT m."content" FROM "BuildMessage" m
          WHERE (m."senderId" = $1 AND m."receiverId" = t."peerId")
             OR (m."senderId" = t."peerId" AND m."receiverId" = $1)
          ORDER BY m."createdAt" DESC LIMIT 1) AS "lastContent",
         (SELECT COUNT(*)::int FROM "BuildMessage" m
          WHERE m."receiverId" = $1 AND m."senderId" = t."peerId" AND m."readAt" IS NULL) AS "unread"
       FROM threads t
       LEFT JOIN "AEVIONUser" u ON u."id" = t."peerId"
       ORDER BY t."lastAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_inbox_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Files (URL-registry; physical upload is left to a CDN/object-store —
// callers POST a pre-uploaded URL. Matches AEVION pattern: backend
// records metadata, third-party storage holds bytes.)
// ──────────────────────────────────────────────────────────────────────

// POST /api/build/files/upload — register an externally-uploaded file
buildRouter.post("/files/upload", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!projectId.ok) return fail(res, 400, projectId.error);

    const url = vString(req.body?.url, "url", { min: 1, max: 2000 });
    if (!url.ok) return fail(res, 400, url.error);
    try {
      const u = new URL(url.value);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return fail(res, 400, "url_must_be_http_or_https");
      }
    } catch {
      return fail(res, 400, "url_invalid");
    }

    const name = req.body?.name == null
      ? { ok: true as const, value: null }
      : vString(req.body.name, "name", { max: 500, allowEmpty: true });
    if (name.ok === false) return fail(res, 400, name.error);

    const mimeType = req.body?.mimeType == null
      ? { ok: true as const, value: null }
      : vString(req.body.mimeType, "mimeType", { max: 200, allowEmpty: true });
    if (mimeType.ok === false) return fail(res, 400, mimeType.error);

    const sizeBytes = req.body?.sizeBytes == null
      ? { ok: true as const, value: null }
      : vNumber(req.body.sizeBytes, "sizeBytes", { min: 0, max: 5e10 });
    if (sizeBytes.ok === false) return fail(res, 400, sizeBytes.error);

    const project = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [projectId.value],
    );
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_upload");
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildFile" ("id","projectId","url","name","mimeType","sizeBytes","uploaderId")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        projectId.value,
        url.value,
        name.value || null,
        mimeType.value || null,
        sizeBytes.value !== null ? Math.round(sizeBytes.value) : null,
        auth.sub,
      ],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "file_upload_failed", { details: (err as Error).message });
  }
});

// Health probe — no auth, no DB roundtrip beyond the bootstrap middleware.
buildRouter.get("/health", (_req, res) => {
  return ok(res, {
    service: "qbuild",
    status: "ok",
    statuses: {
      project: PROJECT_STATUSES,
      vacancy: VACANCY_STATUSES,
      application: APPLICATION_STATUSES,
      role: BUILD_ROLES,
    },
    timestamp: new Date().toISOString(),
  });
});

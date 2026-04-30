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
  PLAN_KEYS,
  safeParseJson,
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

    const rawProfile = p.rows[0] || null;
    const profile = rawProfile
      ? {
          ...rawProfile,
          skills: safeParseJson(rawProfile.skillsJson, [] as string[]),
          languages: safeParseJson(rawProfile.languagesJson, [] as string[]),
        }
      : null;

    return ok(res, {
      user: u.rows[0],
      profile,
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

    // Resume-style fields (all optional).
    const title = req.body?.title == null
      ? null
      : (vString(req.body.title, "title", { max: 200, allowEmpty: true }).ok
          ? String(req.body.title).trim() || null
          : null);
    const summary = req.body?.summary == null
      ? null
      : (vString(req.body.summary, "summary", { max: 4000, allowEmpty: true }).ok
          ? String(req.body.summary).trim() || null
          : null);
    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 60).slice(0, 50)
      : [];
    const languages = Array.isArray(req.body?.languages)
      ? req.body.languages.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 60).slice(0, 20)
      : [];
    const salaryMin = req.body?.salaryMin == null ? null : Number(req.body.salaryMin);
    const salaryMax = req.body?.salaryMax == null ? null : Number(req.body.salaryMax);
    if (salaryMin != null && (!Number.isFinite(salaryMin) || salaryMin < 0)) return fail(res, 400, "salaryMin_invalid");
    if (salaryMax != null && (!Number.isFinite(salaryMax) || salaryMax < 0)) return fail(res, 400, "salaryMax_invalid");
    const salaryCurrency = typeof req.body?.salaryCurrency === "string"
      ? req.body.salaryCurrency.trim().slice(0, 8) || "RUB"
      : "RUB";
    const availability = req.body?.availability == null
      ? null
      : String(req.body.availability).trim().slice(0, 100) || null;
    const experienceYears = req.body?.experienceYears == null
      ? 0
      : Math.max(0, Math.min(80, Math.round(Number(req.body.experienceYears) || 0)));
    const photoUrl = req.body?.photoUrl == null
      ? null
      : String(req.body.photoUrl).trim().slice(0, 2000) || null;
    const openToWork = req.body?.openToWork === true || req.body?.openToWork === "true";

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildProfile"
         ("id","userId","name","phone","city","description","buildRole",
          "title","summary","skillsJson","languagesJson",
          "salaryMin","salaryMax","salaryCurrency","availability",
          "experienceYears","photoUrl","openToWork")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT ("userId") DO UPDATE SET
         "name" = EXCLUDED."name",
         "phone" = EXCLUDED."phone",
         "city" = EXCLUDED."city",
         "description" = EXCLUDED."description",
         "buildRole" = EXCLUDED."buildRole",
         "title" = EXCLUDED."title",
         "summary" = EXCLUDED."summary",
         "skillsJson" = EXCLUDED."skillsJson",
         "languagesJson" = EXCLUDED."languagesJson",
         "salaryMin" = EXCLUDED."salaryMin",
         "salaryMax" = EXCLUDED."salaryMax",
         "salaryCurrency" = EXCLUDED."salaryCurrency",
         "availability" = EXCLUDED."availability",
         "experienceYears" = EXCLUDED."experienceYears",
         "photoUrl" = EXCLUDED."photoUrl",
         "openToWork" = EXCLUDED."openToWork",
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
        title,
        summary,
        JSON.stringify(skills),
        JSON.stringify(languages),
        salaryMin != null ? Math.round(salaryMin) : null,
        salaryMax != null ? Math.round(salaryMax) : null,
        salaryCurrency,
        availability,
        experienceYears,
        photoUrl,
        openToWork,
      ],
    );

    const row = result.rows[0];
    return ok(res, {
      ...row,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      languages: safeParseJson(row.languagesJson, [] as string[]),
    }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "profile_upsert_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/:id — public profile by userId
// Returns full resume bundle: profile + experiences + education.
// Email is included but no phone — phone stays internal until user
// explicitly shares contact via DM.
buildRouter.get("/profiles/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT p."id", p."userId", p."name", p."city", p."description", p."buildRole", p."createdAt",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency", p."availability",
              p."experienceYears", p."photoUrl", p."openToWork",
              u."email"
       FROM "BuildProfile" p
       LEFT JOIN "AEVIONUser" u ON u."id" = p."userId"
       WHERE p."userId" = $1
       LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "profile_not_found");

    const [exp, edu] = await Promise.all([
      pool.query(
        `SELECT * FROM "BuildExperience" WHERE "userId" = $1
         ORDER BY "current" DESC, "sortOrder" ASC, "createdAt" DESC`,
        [id],
      ),
      pool.query(
        `SELECT * FROM "BuildEducation" WHERE "userId" = $1
         ORDER BY COALESCE("toYear",9999) DESC, "createdAt" DESC`,
        [id],
      ),
    ]);

    const row = result.rows[0];
    res.setHeader("Cache-Control", "public, max-age=60");
    return ok(res, {
      ...row,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      languages: safeParseJson(row.languagesJson, [] as string[]),
      experiences: exp.rows,
      education: edu.rows,
    });
  } catch (err: unknown) {
    return fail(res, 500, "profile_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/profiles/search — recruiter-facing talent search
//   Auth gate: any signed-in user can search (plan-based limits enforced
//   later when billing wiring lands). Anonymous gets 401 so we can
//   tighten plan limits without a public escape hatch.
//   Query: ?q= title/summary/description, ?skill= comma-separated AND,
//          ?city=, ?role= CLIENT/CONTRACTOR/WORKER, ?minExp= years,
//          ?openToWork=1 (default = include only openToWork=true if set),
//          ?limit= 1..50 (default 30)
//   Returns sanitized profile rows (no email, no phone).
buildRouter.get("/profiles/search", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(
        `(p."name" ILIKE $${params.length} OR p."title" ILIKE $${params.length} OR p."summary" ILIKE $${params.length} OR p."description" ILIKE $${params.length})`,
      );
    }
    if (typeof req.query.city === "string" && req.query.city.trim()) {
      params.push(`%${req.query.city.trim()}%`);
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (typeof req.query.role === "string") {
      const r = vEnum(req.query.role, "role", BUILD_ROLES);
      if (!r.ok) return fail(res, 400, r.error);
      params.push(r.value);
      where.push(`p."buildRole" = $${params.length}`);
    }
    if (req.query.minExp !== undefined) {
      const v = vNumber(req.query.minExp, "minExp", { min: 0, max: 80 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(Math.round(v.value));
      where.push(`p."experienceYears" >= $${params.length}`);
    }
    if (req.query.openToWork === "1" || req.query.openToWork === "true") {
      where.push(`p."openToWork" = TRUE`);
    }
    // skill= comma-separated → all-required match against skillsJson
    // (case-insensitive substring on the JSON-encoded text — no need
    // for a separate join table at this scale).
    if (typeof req.query.skill === "string" && req.query.skill.trim()) {
      const skills = req.query.skill
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 60)
        .slice(0, 10);
      for (const s of skills) {
        params.push(`%"${s.replace(/"/g, "")}%`);
        where.push(`p."skillsJson" ILIKE $${params.length}`);
      }
    }

    const limitRaw = req.query.limit !== undefined
      ? vNumber(req.query.limit, "limit", { min: 1, max: 50 })
      : { ok: true as const, value: 30 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const result = await pool.query(
      `SELECT p."userId", p."name", p."city", p."buildRole",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency",
              p."availability", p."experienceYears", p."photoUrl",
              p."openToWork", p."updatedAt"
       FROM "BuildProfile" p
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY p."openToWork" DESC, p."updatedAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      skills: safeParseJson(r.skillsJson, [] as string[]),
      languages: safeParseJson(r.languagesJson, [] as string[]),
    }));
    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "profiles_search_failed", { details: (err as Error).message });
  }
});

// ── Experience CRUD ──────────────────────────────────────────────────

// POST /api/build/experiences — add an experience entry
buildRouter.post("/experiences", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 1, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const company = vString(req.body?.company, "company", { min: 1, max: 200 });
    if (!company.ok) return fail(res, 400, company.error);

    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const fromDate = req.body?.fromDate == null ? null : String(req.body.fromDate).trim().slice(0, 32) || null;
    const toDate = req.body?.toDate == null ? null : String(req.body.toDate).trim().slice(0, 32) || null;
    const current = req.body?.current === true || req.body?.current === "true";
    const description = req.body?.description == null
      ? null
      : String(req.body.description).trim().slice(0, 4000) || null;

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildExperience" ("id","userId","title","company","city","fromDate","toDate","current","description")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, auth.sub, title.value, company.value, city, fromDate, current ? null : toDate, current, description],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "experience_create_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/experiences/:id — owner only
buildRouter.delete("/experiences/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildExperience" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "experience_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    await pool.query(`DELETE FROM "BuildExperience" WHERE "id" = $1`, [id]);
    return ok(res, { id, deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "experience_delete_failed", { details: (err as Error).message });
  }
});

// ── Education CRUD ───────────────────────────────────────────────────

// POST /api/build/education — add an education entry
buildRouter.post("/education", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const institution = vString(req.body?.institution, "institution", { min: 1, max: 200 });
    if (!institution.ok) return fail(res, 400, institution.error);

    const degree = req.body?.degree == null ? null : String(req.body.degree).trim().slice(0, 100) || null;
    const field = req.body?.field == null ? null : String(req.body.field).trim().slice(0, 200) || null;
    const fromYear = req.body?.fromYear == null ? null : Math.round(Number(req.body.fromYear));
    const toYear = req.body?.toYear == null ? null : Math.round(Number(req.body.toYear));
    if (fromYear != null && (!Number.isFinite(fromYear) || fromYear < 1900 || fromYear > 2100)) return fail(res, 400, "fromYear_invalid");
    if (toYear != null && (!Number.isFinite(toYear) || toYear < 1900 || toYear > 2100)) return fail(res, 400, "toYear_invalid");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildEducation" ("id","userId","institution","degree","field","fromYear","toYear")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, auth.sub, institution.value, degree, field, fromYear, toYear],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "education_create_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/education/:id — owner only
buildRouter.delete("/education/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildEducation" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "education_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    await pool.query(`DELETE FROM "BuildEducation" WHERE "id" = $1`, [id]);
    return ok(res, { id, deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "education_delete_failed", { details: (err as Error).message });
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

// PATCH /api/build/vacancies/:id — toggle status (project owner or admin)
buildRouter.patch("/vacancies/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", VACANCY_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT v."id", p."clientId"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_project_owner_can_update_vacancy");
    }

    const result = await pool.query(
      `UPDATE "BuildVacancy" SET "status" = $1 WHERE "id" = $2 RETURNING *`,
      [status.value, id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_update_failed", { details: (err as Error).message });
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

// ──────────────────────────────────────────────────────────────────────
// Notifications — small badge counts so the header bell knows what's new.
// One round-trip, three numbers. Frontend polls every ~30s.
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/notifications/summary
//   { unreadMessages, pendingApplications, applicationUpdates }
//   - unreadMessages       = BuildMessage where receiverId=me AND readAt IS NULL
//   - pendingApplications  = applications PENDING on my (owner's) vacancies
//   - applicationUpdates   = my own applications updated to ACCEPTED/REJECTED in last 14d
buildRouter.get("/notifications/summary", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [msgs, pending, updates] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM "BuildMessage"
         WHERE "receiverId" = $1 AND "readAt" IS NULL`,
        [auth.sub],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE p."clientId" = $1 AND a."status" = 'PENDING'`,
        [auth.sub],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c
         FROM "BuildApplication" a
         WHERE a."userId" = $1
           AND a."status" IN ('ACCEPTED','REJECTED')
           AND a."updatedAt" > NOW() - INTERVAL '14 days'`,
        [auth.sub],
      ),
    ]);

    const unreadMessages = msgs.rows[0]?.c ?? 0;
    const pendingApplications = pending.rows[0]?.c ?? 0;
    const applicationUpdates = updates.rows[0]?.c ?? 0;
    return ok(res, {
      unreadMessages,
      pendingApplications,
      applicationUpdates,
      total: unreadMessages + pendingApplications + applicationUpdates,
    });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_summary_failed", { details: (err as Error).message });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Pricing — plans, subscriptions, order ledger.
// Plans are seeded by ensureBuildTables. Reading is public; subscribing
// requires auth. Payments are out-of-scope: we record an order in
// PENDING/PAID and a Subscription row goes ACTIVE on the FREE tier
// immediately (everything else stays PENDING until a payment provider
// flips it).
// ──────────────────────────────────────────────────────────────────────

// GET /api/build/plans — public catalog
buildRouter.get("/plans", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT "key","name","tagline","priceMonthly","currency","vacancySlots","talentSearchPerMonth","boostsPerMonth","hireFeeBps","featuresJson","sortOrder"
       FROM "BuildPlan"
       WHERE "active" = TRUE
       ORDER BY "sortOrder" ASC`,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      features: safeParseJson(r.featuresJson, [] as string[]),
    }));
    res.setHeader("Cache-Control", "public, max-age=300");
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "plans_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/subscriptions/me — current plan for the bearer
buildRouter.get("/subscriptions/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const sub = await pool.query(
      `SELECT s.*, p."name" AS "planName", p."priceMonthly", p."currency",
              p."vacancySlots", p."talentSearchPerMonth", p."boostsPerMonth", p."hireFeeBps"
       FROM "BuildSubscription" s
       LEFT JOIN "BuildPlan" p ON p."key" = s."planKey"
       WHERE s."userId" = $1 AND s."status" = 'ACTIVE'
       ORDER BY s."createdAt" DESC
       LIMIT 1`,
      [auth.sub],
    );

    if (sub.rowCount === 0) return ok(res, { subscription: null });
    return ok(res, { subscription: sub.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "subscription_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/subscriptions/start { planKey } — start or switch plan
//   FREE                   → ACTIVE immediately, order PAID(0)
//   PPHIRE                 → ACTIVE (no monthly fee, fee at hire-time)
//   PRO/AGENCY             → subscription PENDING + order PENDING
//                            (real payment integration plugs in later)
buildRouter.post("/subscriptions/start", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const planKey = vEnum(req.body?.planKey, "planKey", PLAN_KEYS);
    if (!planKey.ok) return fail(res, 400, planKey.error);

    const plan = await pool.query(
      `SELECT "key","priceMonthly","currency" FROM "BuildPlan" WHERE "key" = $1 AND "active" = TRUE LIMIT 1`,
      [planKey.value],
    );
    if (plan.rowCount === 0) return fail(res, 404, "plan_not_found");
    const planRow = plan.rows[0];

    const isFreeStart = planRow.priceMonthly === 0;
    const subStatus = isFreeStart ? "ACTIVE" : "PENDING";
    const orderStatus = isFreeStart ? "PAID" : "PENDING";

    await pool.query("BEGIN");
    try {
      // Cancel any existing ACTIVE sub for this user before inserting a new one
      // (the partial-unique index requires it).
      await pool.query(
        `UPDATE "BuildSubscription" SET "status" = 'CANCELED', "endsAt" = NOW()
         WHERE "userId" = $1 AND "status" = 'ACTIVE'`,
        [auth.sub],
      );

      const subId = crypto.randomUUID();
      const subResult = await pool.query(
        `INSERT INTO "BuildSubscription" ("id","userId","planKey","status")
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [subId, auth.sub, planKey.value, subStatus],
      );

      const orderId = crypto.randomUUID();
      const orderResult = await pool.query(
        `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
         VALUES ($1,$2,'SUB_START',$3,$4,$5,$6,$7) RETURNING *`,
        [
          orderId,
          auth.sub,
          subId,
          planRow.priceMonthly,
          planRow.currency,
          orderStatus,
          JSON.stringify({ planKey: planKey.value }),
        ],
      );

      await pool.query("COMMIT");
      return ok(
        res,
        { subscription: subResult.rows[0], order: orderResult.rows[0] },
        201,
      );
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "subscription_start_failed", { details: (err as Error).message });
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

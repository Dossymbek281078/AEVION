import { Router } from "express";
import crypto from "crypto";
import { dispatchJobAlerts } from "./alerts";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
  vEnum,
  safeParseJson,
  getUserPlan,
  ensureUsageRow,
  bumpUsage,
  isUnlimited,
  VACANCY_STATUSES,
  PROJECT_STATUSES,
} from "../../lib/build";

export const vacanciesRouter = Router();

// POST /api/build/vacancies
vacanciesRouter.post("/", async (req, res) => {
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

    if (auth.role !== "ADMIN") {
      const plan = await getUserPlan(auth.sub);
      if (!isUnlimited(plan.vacancySlots)) {
        const active = await pool.query(
          `SELECT COUNT(*)::int AS c FROM "BuildVacancy" v
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND v."status" = 'OPEN'`,
          [auth.sub],
        );
        const used = active.rows[0]?.c ?? 0;
        if (used >= plan.vacancySlots) {
          return fail(res, 403, "plan_vacancy_limit_reached", { planKey: plan.key, limit: plan.vacancySlots, used, upgradeUrl: "/build/pricing" });
        }
      }
    }

    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 60).slice(0, 30)
      : [];
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const salaryCurrency = typeof req.body?.salaryCurrency === "string" ? req.body.salaryCurrency.trim().slice(0, 8) || "RUB" : "RUB";
    const questions = Array.isArray(req.body?.questions)
      ? req.body.questions.map((q: unknown) => String(q).trim()).filter((q: string) => q.length > 0 && q.length <= 200).slice(0, 5)
      : [];

    // Optional expiry date (ISO string). Default: 60 days if not provided.
    let expiresAt: Date | null = null;
    if (req.body?.expiresAt) {
      try { expiresAt = new Date(String(req.body.expiresAt)); } catch { /* ignore */ }
    }
    if (!expiresAt || isNaN(expiresAt.getTime())) {
      expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default
    }

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVacancy" ("id","projectId","title","description","salary","skillsJson","city","salaryCurrency","questionsJson","expiresAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, projectId.value, title.value, description.value, salary.value, JSON.stringify(skills), city, salaryCurrency, JSON.stringify(questions), expiresAt],
    );
    const row = result.rows[0];
    // Fire job alerts asynchronously — non-blocking
    void dispatchJobAlerts({ id: row.id, title: row.title, description: row.description, skillsJson: row.skillsJson, city: row.city, salary: row.salary }).catch(() => {});
    return ok(res, { ...row, skills: safeParseJson(row.skillsJson, [] as string[]), questions: safeParseJson(row.questionsJson, [] as string[]) }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies — cross-project feed
vacanciesRouter.get("/", async (req, res) => {
  try {
    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof req.query.status === "string") {
      const v = vEnum(req.query.status, "status", VACANCY_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); where.push(`v."status" = $${params.length}`);
    }
    if (typeof req.query.projectStatus === "string") {
      const v = vEnum(req.query.projectStatus, "projectStatus", PROJECT_STATUSES);
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); where.push(`p."status" = $${params.length}`);
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      params.push(`%${req.query.q.trim()}%`);
      where.push(`(v."title" ILIKE $${params.length} OR v."description" ILIKE $${params.length})`);
    }
    if (typeof req.query.city === "string" && req.query.city.trim()) {
      params.push(req.query.city.trim()); where.push(`p."city" ILIKE $${params.length}`);
    }
    if (req.query.minSalary !== undefined) {
      const v = vNumber(req.query.minSalary, "minSalary", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      params.push(v.value); where.push(`v."salary" >= $${params.length}`);
    }
    if (req.query.maxSalary !== undefined) {
      const v = vNumber(req.query.maxSalary, "maxSalary", { min: 0, max: 1e12 });
      if (!v.ok) return fail(res, 400, v.error);
      // Salary 0 means "not specified" — exclude from the upper-bound filter
      // so the candidate can still see roles where the recruiter hasn't set
      // a number rather than seeing an empty list.
      params.push(v.value); where.push(`(v."salary" <= $${params.length} OR v."salary" = 0)`);
    }
    if (typeof req.query.currency === "string" && req.query.currency.trim()) {
      params.push(req.query.currency.trim().toUpperCase().slice(0, 8));
      where.push(`UPPER(COALESCE(v."salaryCurrency", 'USD')) = $${params.length}`);
    }
    if (typeof req.query.skill === "string" && req.query.skill.trim()) {
      params.push(`%"${req.query.skill.trim().toLowerCase()}"%`);
      where.push(`lower(v."skillsJson") ILIKE $${params.length}`);
    }

    const limitRaw = req.query.limit !== undefined ? vNumber(req.query.limit, "limit", { min: 1, max: 100 }) : { ok: true as const, value: 50 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const sortRaw = typeof req.query.sort === "string" ? req.query.sort.toLowerCase() : "recent";
    const sortClause =
      sortRaw === "salary" ? `v."salary" DESC NULLS LAST, v."createdAt" DESC`
      : sortRaw === "popular" ? `(SELECT COUNT(*) FROM "BuildApplication" a2 WHERE a2."vacancyId" = v."id") DESC, v."createdAt" DESC`
      : `((SELECT MAX(b2."endsAt") FROM "BuildBoost" b2 WHERE b2."vacancyId" = v."id" AND b2."endsAt" > NOW())) DESC NULLS LAST, v."createdAt" DESC`;

    const result = await pool.query(
      `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status", v."createdAt",
              v."skillsJson", v."expiresAt",
              p."title" AS "projectTitle", p."status" AS "projectStatus", p."city" AS "projectCity", p."clientId",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ${sortClause}
       LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((row: Record<string, unknown>) => ({
      ...row, skills: safeParseJson(row.skillsJson, [] as string[]),
    }));
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_feed_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/invite — owner invites a candidate by email
vacanciesRouter.post("/:id/invite", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const emailVal = vString(req.body?.email, "email", { min: 3, max: 200 });
    if (!emailVal.ok) return fail(res, 400, emailVal.error);

    const owner = await pool.query(
      `SELECT v."title", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const recruiter = await pool.query(`SELECT "name" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [auth.sub]);
      const recruiterName = recruiter.rows[0]?.name || "An employer";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QBuild <noreply@aevion.tech>",
          to: emailVal.value,
          subject: `You've been invited to apply — ${owner.rows[0].title}`,
          text: `Hi,\n\n${recruiterName} thinks you'd be a great fit for:\n\n"${owner.rows[0].title}"\n\nApply here: https://aevion.tech/build/vacancy/${id}\n\n— AEVION QBuild`,
        }),
      }).catch(() => {});
    }

    return ok(res, { invited: true, email: emailVal.value });
  } catch (err: unknown) {
    return fail(res, 500, "invite_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/skills/popular — top N skills from open vacancies for autocomplete
vacanciesRouter.get("/skills/popular", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT "skillsJson" FROM "BuildVacancy" WHERE "status" = 'OPEN' LIMIT 500`,
    );
    const freq: Record<string, number> = {};
    for (const row of r.rows as { skillsJson: string }[]) {
      try {
        const skills: string[] = JSON.parse(row.skillsJson);
        for (const s of skills) {
          const key = s.trim().toLowerCase();
          if (key) freq[key] = (freq[key] ?? 0) + 1;
        }
      } catch { /* skip bad JSON */ }
    }
    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([skill, count]) => ({ skill, count }));
    return ok(res, { items: top });
  } catch (err: unknown) {
    return fail(res, 500, "skills_popular_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/by-project/:id
vacanciesRouter.get("/by-project/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT v.*,
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "applicationsCount",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v WHERE v."projectId" = $1 ORDER BY v."createdAt" DESC`,
      [id],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_list_failed", { details: (err as Error).message });
  }
});

// --- Vacancy templates -----------------------------------------------------
// IMPORTANT: these single-segment paths MUST be registered BEFORE the
// generic /:id route below, otherwise Express matches "/templates" against
// /:id with id="templates" and the dedicated handler never fires.

// GET /api/build/vacancies/templates — caller's saved templates.
vacanciesRouter.get("/templates", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT "id","name","title","description","skillsJson","salary","salaryCurrency",
              "city","questionsJson","createdAt"
       FROM "BuildVacancyTemplate"
       WHERE "ownerUserId" = $1
       ORDER BY "createdAt" DESC LIMIT 100`,
      [auth.sub],
    );
    const items = r.rows.map((row: Record<string, unknown>) => ({
      ...row,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      questions: safeParseJson(row.questionsJson, [] as string[]),
    }));
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "templates_list_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/templates — save a new template.
vacanciesRouter.post("/templates", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const name = vString(req.body?.name, "name", { min: 2, max: 200 });
    if (!name.ok) return fail(res, 400, name.error);
    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);

    const salary = req.body?.salary != null
      ? Math.max(0, Math.round(Number(req.body.salary) || 0))
      : 0;
    const salaryCurrency = typeof req.body?.salaryCurrency === "string"
      ? String(req.body.salaryCurrency).slice(0, 8)
      : null;
    const city = typeof req.body?.city === "string" && req.body.city.trim()
      ? String(req.body.city).slice(0, 100)
      : null;

    const skills = Array.isArray(req.body?.skills)
      ? (req.body.skills as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 60)).slice(0, 30)
      : [];
    const questions = Array.isArray(req.body?.questions)
      ? (req.body.questions as unknown[]).filter((q): q is string => typeof q === "string").map((q) => q.slice(0, 500)).slice(0, 10)
      : [];

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildVacancyTemplate"
         ("id","ownerUserId","name","title","description","skillsJson","salary","salaryCurrency","city","questionsJson")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id, auth.sub, name.value, title.value, description.value,
        JSON.stringify(skills), salary, salaryCurrency, city, JSON.stringify(questions),
      ],
    );
    return ok(res, r.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "template_create_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/vacancies/templates/:id
vacanciesRouter.delete("/templates/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const r = await pool.query(
      `DELETE FROM "BuildVacancyTemplate"
       WHERE "id" = $1 AND ("ownerUserId" = $2 OR $3 = TRUE)
       RETURNING "id"`,
      [id, auth.sub, auth.role === "ADMIN"],
    );
    if (r.rowCount === 0) return fail(res, 404, "template_not_found_or_not_owned");
    return ok(res, { id });
  } catch (err: unknown) {
    return fail(res, 500, "template_delete_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id
vacanciesRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    // Increment view counter fire-and-forget (best-effort, non-blocking)
    pool.query(`UPDATE "BuildVacancy" SET "viewCount" = COALESCE("viewCount", 0) + 1 WHERE "id" = $1`, [id]).catch(() => {});
    const result = await pool.query(
      `SELECT v.*, p."title" AS "projectTitle", p."status" AS "projectStatus", p."clientId",
              (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
       FROM "BuildVacancy" v LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const row = result.rows[0];
    return ok(res, { ...row, skills: safeParseJson(row.skillsJson, [] as string[]), questions: safeParseJson(row.questionsJson, [] as string[]) });
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/mine/funnel
// Recruiter overview: every vacancy the caller owns plus funnel counts
// (views, total apps, pending, accepted, rejected). Used by /build/dashboard.
vacanciesRouter.get("/mine/funnel", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT v."id", v."title", v."status", v."salary", v."salaryCurrency",
              v."viewCount", v."createdAt", v."expiresAt", v."projectId",
              p."title" AS "projectTitle",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id")::int AS "appsTotal",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id" AND a."status" = 'PENDING')::int AS "appsPending",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id" AND a."status" = 'ACCEPTED')::int AS "appsAccepted",
              (SELECT COUNT(*) FROM "BuildApplication" a WHERE a."vacancyId" = v."id" AND a."status" = 'REJECTED')::int AS "appsRejected",
              (SELECT MIN(a."createdAt") FROM "BuildApplication" a WHERE a."vacancyId" = v."id" AND a."status" = 'PENDING') AS "oldestPendingAt",
              (SELECT AVG(EXTRACT(EPOCH FROM (a."updatedAt" - a."createdAt")))
               FROM "BuildApplication" a
               WHERE a."vacancyId" = v."id"
                 AND a."status" <> 'PENDING'
                 AND a."updatedAt" > a."createdAt" + INTERVAL '1 second')::float AS "avgResponseSeconds"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1
       ORDER BY v."status" ASC, v."createdAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "vacancies_mine_funnel_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id/similar
// Public: returns up to 6 OPEN vacancies that overlap on skills (or fall back
// to same-city if the source vacancy has no skills declared). Used by the
// "Similar vacancies" widget on the detail page to keep candidates engaged
// when the current role doesn't fit.
vacanciesRouter.get("/:id/similar", async (req, res) => {
  try {
    const id = String(req.params.id);
    const src = await pool.query(
      `SELECT v."id", v."skillsJson", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (src.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const skills = safeParseJson(src.rows[0].skillsJson, [] as string[]);
    const city = src.rows[0].projectCity ? String(src.rows[0].projectCity) : null;

    // Pull a candidate set, score in JS — keeps the SQL simple while still
    // letting us rank by overlap count.
    const limit = 60;
    let rows: Record<string, unknown>[];
    if (skills.length > 0) {
      const orClauses = skills.map((_s, i) => `lower(v."skillsJson") LIKE $${i + 2}`).join(" OR ");
      const params: unknown[] = [id, ...skills.map((s) => `%"${s.toLowerCase()}"%`)];
      const r = await pool.query(
        `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status",
                v."createdAt", v."skillsJson", v."expiresAt",
                p."title" AS "projectTitle", p."city" AS "projectCity"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."status" = 'OPEN' AND v."id" <> $1 AND (${orClauses})
         ORDER BY v."createdAt" DESC
         LIMIT ${limit}`,
        params,
      );
      rows = r.rows;
    } else if (city) {
      const r = await pool.query(
        `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status",
                v."createdAt", v."skillsJson", v."expiresAt",
                p."title" AS "projectTitle", p."city" AS "projectCity"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."status" = 'OPEN' AND v."id" <> $1 AND p."city" ILIKE $2
         ORDER BY v."createdAt" DESC
         LIMIT 6`,
        [id, city],
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."status",
                v."createdAt", v."skillsJson", v."expiresAt",
                p."title" AS "projectTitle", p."city" AS "projectCity"
         FROM "BuildVacancy" v
         LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE v."status" = 'OPEN' AND v."id" <> $1
         ORDER BY v."createdAt" DESC
         LIMIT 6`,
        [id],
      );
      rows = r.rows;
    }

    const skillSet = new Set(skills.map((s) => s.toLowerCase()));
    const scored = rows
      .map((row: Record<string, unknown>) => {
        const rowSkills = safeParseJson(row.skillsJson, [] as string[]);
        const overlap = rowSkills.filter((s) => skillSet.has(s.toLowerCase()));
        return { ...row, skills: rowSkills, overlapCount: overlap.length, overlapSkills: overlap };
      })
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, 6);

    return ok(res, { items: scored, total: scored.length });
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_similar_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id/match-candidates — owner only
vacanciesRouter.get("/:id/match-candidates", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const owner = await pool.query(
      `SELECT v."skillsJson", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_vacancy_owner_can_match");

    const required = safeParseJson(owner.rows[0].skillsJson, [] as string[]).map((s) => s.toLowerCase());
    if (required.length === 0) {
      return ok(res, { items: [], total: 0, requiredSkills: [], note: "vacancy_has_no_required_skills" });
    }

    const pool_ = await pool.query(
      `SELECT p."userId", p."name", p."city", p."buildRole",
              p."title", p."summary", p."skillsJson", p."languagesJson",
              p."salaryMin", p."salaryMax", p."salaryCurrency",
              p."availability", p."experienceYears", p."photoUrl",
              p."openToWork", p."verifiedAt", p."updatedAt"
       FROM "BuildProfile" p WHERE p."userId" <> $1
       ORDER BY p."openToWork" DESC, p."updatedAt" DESC LIMIT 200`,
      [auth.sub],
    );

    type Row = { skillsJson: string; languagesJson: string; openToWork: boolean; [k: string]: unknown };
    const requiredSet = new Set(required);
    const ranked = (pool_.rows as Row[])
      .map((row) => {
        const candSkills = safeParseJson(row.skillsJson, [] as string[]);
        const candSet = new Set(candSkills.map((s) => s.toLowerCase()));
        const matched = required.filter((s) => candSet.has(s));
        const score = required.length === 0 ? 0 : Math.round((matched.length / required.length) * 100);
        return { ...row, skills: candSkills, languages: safeParseJson(row.languagesJson, [] as string[]), matchScore: score, matchedSkills: candSkills.filter((s) => requiredSet.has(s.toLowerCase())) };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => { if (a.openToWork !== b.openToWork) return a.openToWork ? -1 : 1; return b.matchScore - a.matchScore; })
      .slice(0, 20);

    return ok(res, { items: ranked, total: ranked.length, requiredSkills: required });
  } catch (err: unknown) {
    return fail(res, 500, "match_candidates_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/boost
vacanciesRouter.post("/:id/boost", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const days = req.body?.days != null ? Math.max(1, Math.min(30, Math.round(Number(req.body.days) || 7))) : 7;

    const row = await pool.query(
      `SELECT v."id", v."projectId", v."status", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId" WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_project_owner_can_boost");
    if (row.rows[0].status !== "OPEN") return fail(res, 400, "boost_requires_open_vacancy");

    const plan = await getUserPlan(auth.sub);
    const usage = await ensureUsageRow(auth.sub);
    const planAllows = !isUnlimited(plan.boostsPerMonth) ? usage.boostsUsed < plan.boostsPerMonth : true;
    const wantPaid = req.body?.paid === true;

    const boostId = crypto.randomUUID();
    const endsAt = new Date(Date.now() + days * 24 * 3600 * 1000);

    await pool.query("BEGIN");
    try {
      let orderId: string | null = null;
      let source: "PLAN" | "PAID" = "PLAN";

      if (planAllows && !wantPaid) {
        await bumpUsage(auth.sub, "boostsUsed");
      } else {
        source = "PAID";
        orderId = crypto.randomUUID();
        const amount = 990 * Math.ceil(days / 7);
        await pool.query(
          `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
           VALUES ($1,$2,'BOOST',$3,$4,'RUB','PENDING',$5)`,
          [orderId, auth.sub, boostId, amount, JSON.stringify({ vacancyId: id, days })],
        );
      }

      const ins = await pool.query(
        `INSERT INTO "BuildBoost" ("id","vacancyId","userId","endsAt","source","orderId")
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [boostId, id, auth.sub, endsAt.toISOString(), source, orderId],
      );

      await pool.query("COMMIT");
      return ok(res, { boost: ins.rows[0], orderId, source }, 201);
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "boost_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/vacancies/:id — toggle status
vacanciesRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", VACANCY_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT v."id", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId" WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_project_owner_can_update_vacancy");

    const result = await pool.query(`UPDATE "BuildVacancy" SET "status" = $1 WHERE "id" = $2 RETURNING *`, [status.value, id]);
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_update_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/vacancies/:id — owner can delete a vacancy that has
// zero applications. The "zero apps" guard exists because deleting a
// vacancy with applications would orphan candidate records, hire fees
// and CSV history. For vacancies with applications we recommend
// PATCH status=CLOSED via the existing patch endpoint instead.
vacanciesRouter.delete("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const owner = await pool.query(
      `SELECT v."id", p."clientId",
              (SELECT COUNT(*)::int FROM "BuildApplication" a WHERE a."vacancyId" = v."id") AS "appsCount"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_delete");
    }
    if (Number(owner.rows[0].appsCount) > 0) {
      return fail(res, 409, "vacancy_has_applications", {
        appsCount: Number(owner.rows[0].appsCount),
        hint: "Close the vacancy instead (PATCH status=CLOSED) to preserve the application history.",
      });
    }

    // Cascade-delete supporting rows that don't have FK to applications:
    // bookmarks pointing at this vacancy and any boost rows.
    await pool.query(`DELETE FROM "BuildBoost" WHERE "vacancyId" = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM "BuildBookmark" WHERE "kind" = 'VACANCY' AND "targetId" = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM "BuildVacancy" WHERE "id" = $1`, [id]);
    return ok(res, { id });
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_delete_failed", { details: (err as Error).message });
  }
});

// GET /api/build/vacancies/:id/timeline — owner-only chronological feed of
// vacancy events. No new table; we union 4 existing sources (vacancy itself,
// applications, boosts, hire orders) and sort by ts desc. Cap 80 events.
vacanciesRouter.get("/:id/timeline", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const owner = await pool.query(
      `SELECT v."id", v."createdAt", v."status", p."clientId", p."title" AS "projectTitle"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    type Event = {
      kind: "VACANCY_CREATED" | "BOOST_STARTED" | "BOOST_ENDED" | "APPLICATION_RECEIVED" | "APPLICATION_ACCEPTED" | "APPLICATION_REJECTED" | "HIRE_FEE";
      ts: string;
      title: string;
      meta?: Record<string, unknown>;
    };
    const events: Event[] = [];

    events.push({
      kind: "VACANCY_CREATED",
      ts: String(owner.rows[0].createdAt),
      title: "Vacancy posted",
      meta: { projectTitle: owner.rows[0].projectTitle },
    });

    const apps = await pool.query(
      `SELECT a."id", a."status", a."createdAt", a."updatedAt", a."rejectReason",
              u."name" AS "applicantName"
       FROM "BuildApplication" a
       JOIN "AEVIONUser" u ON u."id" = a."userId"
       WHERE a."vacancyId" = $1
       ORDER BY a."createdAt" DESC LIMIT 200`,
      [id],
    );
    for (const a of apps.rows as { id: string; status: string; createdAt: string; updatedAt: string; rejectReason: string | null; applicantName: string }[]) {
      events.push({
        kind: "APPLICATION_RECEIVED",
        ts: a.createdAt,
        title: `Application from ${a.applicantName}`,
        meta: { applicationId: a.id },
      });
      // Detect status change events from updatedAt > createdAt + 1s.
      // Note: we only know the final status, not intermediate flips. For a
      // PENDING row updatedAt may equal createdAt — skip in that case.
      if (a.status !== "PENDING" && new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime() > 1000) {
        events.push({
          kind: a.status === "ACCEPTED" ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
          ts: a.updatedAt,
          title: `${a.applicantName} ${a.status === "ACCEPTED" ? "accepted" : "rejected"}`,
          meta: { applicationId: a.id, rejectReason: a.rejectReason ?? undefined },
        });
      }
    }

    const boosts = await pool.query(
      `SELECT "id","startedAt","endsAt","source" FROM "BuildBoost"
       WHERE "vacancyId" = $1 ORDER BY "startedAt" DESC LIMIT 50`,
      [id],
    );
    for (const b of boosts.rows as { id: string; startedAt: string; endsAt: string; source: string }[]) {
      events.push({
        kind: "BOOST_STARTED",
        ts: b.startedAt,
        title: `Boost activated (${b.source})`,
        meta: { endsAt: b.endsAt, boostId: b.id },
      });
      if (new Date(b.endsAt) <= new Date()) {
        events.push({
          kind: "BOOST_ENDED",
          ts: b.endsAt,
          title: "Boost expired",
          meta: { boostId: b.id },
        });
      }
    }

    // Hire fee orders are tied to vacancy via metaJson.vacancyId.
    const hires = await pool.query(
      `SELECT "id","createdAt","amount","currency","status","metaJson"
       FROM "BuildOrder" WHERE "kind" = 'HIRE_FEE' AND "userId" = $1
       ORDER BY "createdAt" DESC LIMIT 50`,
      [auth.sub],
    );
    for (const o of hires.rows as { id: string; createdAt: string; amount: number; currency: string; status: string; metaJson: string }[]) {
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(o.metaJson) as Record<string, unknown>; } catch {}
      if (meta.vacancyId !== id) continue;
      events.push({
        kind: "HIRE_FEE",
        ts: o.createdAt,
        title: `Hire fee · ${o.amount.toLocaleString()} ${o.currency} (${o.status})`,
        meta: { orderId: o.id, status: o.status },
      });
    }

    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return ok(res, { events: events.slice(0, 80), total: events.length });
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_timeline_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/republish — owner reopens a CLOSED vacancy.
// Resets status -> OPEN and pushes expiresAt out by 30 days from now.
// Useful when a hire fell through or the role re-opened.
vacanciesRouter.post("/:id/republish", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const row = await pool.query(
      `SELECT v."id", v."status", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId" WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_republish");
    }
    if (row.rows[0].status === "OPEN") {
      return fail(res, 409, "vacancy_already_open");
    }

    // Respect plan vacancy slot limits — republishing counts as an active slot.
    if (auth.role !== "ADMIN") {
      const plan = await getUserPlan(auth.sub);
      if (!isUnlimited(plan.vacancySlots)) {
        const active = await pool.query(
          `SELECT COUNT(*)::int AS c FROM "BuildVacancy" v
           JOIN "BuildProject" p ON p."id" = v."projectId"
           WHERE p."clientId" = $1 AND v."status" = 'OPEN'`,
          [auth.sub],
        );
        const used = active.rows[0]?.c ?? 0;
        if (used >= plan.vacancySlots) {
          return fail(res, 403, "plan_vacancy_limit_reached", { planKey: plan.key, limit: plan.vacancySlots, used, upgradeUrl: "/build/pricing" });
        }
      }
    }

    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `UPDATE "BuildVacancy" SET "status" = 'OPEN', "expiresAt" = $1 WHERE "id" = $2 RETURNING *`,
      [newExpiry, id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_republish_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/duplicate — clone into another project
vacanciesRouter.post("/:id/duplicate", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const src = await pool.query(
      `SELECT v.*, p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (src.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (src.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const targetProjectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!targetProjectId.ok) return fail(res, 400, targetProjectId.error);

    const proj = await pool.query(
      `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [targetProjectId.value],
    );
    if (proj.rowCount === 0) return fail(res, 404, "target_project_not_found");
    if (proj.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_project_owner");

    const s = src.rows[0];
    const newId = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVacancy"
         ("id","projectId","title","description","salary","status","skillsJson","city","salaryCurrency","questionsJson")
       VALUES ($1,$2,$3,$4,$5,'OPEN',$6,$7,$8,$9)
       RETURNING *`,
      [newId, targetProjectId.value, `${s.title} (copy)`, s.description, s.salary, s.skillsJson, s.city, s.salaryCurrency, s.questionsJson],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_duplicate_failed", { details: (err as Error).message });
  }
});

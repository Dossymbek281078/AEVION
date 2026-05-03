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
    const salaryMin = req.body?.salaryMin != null ? Number(req.body.salaryMin) || null : null;
    const salaryMax = req.body?.salaryMax != null ? Number(req.body.salaryMax) || null : null;
    const urgent = req.body?.urgent === true;
    const urgentNote = urgent && typeof req.body?.urgentNote === "string" ? req.body.urgentNote.trim().slice(0, 300) || null : null;
    const urgentUntil = urgent ? new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() : null;

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildVacancy" ("id","projectId","title","description","salary","skillsJson","city","salaryCurrency","questionsJson","salaryMin","salaryMax","urgent","urgentUntil","urgentNote")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, projectId.value, title.value, description.value, salary.value, JSON.stringify(skills), city, salaryCurrency, JSON.stringify(questions), salaryMin, salaryMax, urgent, urgentUntil, urgentNote],
    );
    const row = result.rows[0];
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
    if (typeof req.query.skill === "string" && req.query.skill.trim()) {
      params.push(`%"${req.query.skill.trim().toLowerCase()}"%`);
      where.push(`lower(v."skillsJson") ILIKE $${params.length}`);
    }
    if (req.query.urgent === "true") {
      where.push(`v."urgent" = TRUE AND (v."urgentUntil" IS NULL OR v."urgentUntil" > NOW())`);
    }

    const limitRaw = req.query.limit !== undefined ? vNumber(req.query.limit, "limit", { min: 1, max: 200 }) : { ok: true as const, value: 50 };
    if (limitRaw.ok === false) return fail(res, 400, limitRaw.error);
    params.push(limitRaw.value);

    const sortRaw = typeof req.query.sort === "string" ? req.query.sort.toLowerCase() : "recent";
    const sortClause =
      sortRaw === "salary" ? `v."salary" DESC NULLS LAST, v."createdAt" DESC`
      : sortRaw === "popular" ? `(SELECT COUNT(*) FROM "BuildApplication" a2 WHERE a2."vacancyId" = v."id") DESC, v."createdAt" DESC`
      : `v."urgent" DESC, ((SELECT MAX(b2."endsAt") FROM "BuildBoost" b2 WHERE b2."vacancyId" = v."id" AND b2."endsAt" > NOW())) DESC NULLS LAST, v."createdAt" DESC`;

    const result = await pool.query(
      `SELECT v."id", v."projectId", v."title", v."description", v."salary", v."salaryMin", v."salaryMax", v."salaryCurrency", v."status", v."createdAt",
              v."skillsJson", v."city", v."urgent", v."urgentUntil", v."urgentNote",
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

// GET /api/build/vacancies/:id
vacanciesRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
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

// PATCH /api/build/vacancies/:id — update status and/or urgent flag
vacanciesRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);

    const row = await pool.query(
      `SELECT v."id", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId" WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_project_owner_can_update_vacancy");

    const sets: string[] = [];
    const params: unknown[] = [];

    if (req.body?.status !== undefined) {
      const status = vEnum(req.body.status, "status", VACANCY_STATUSES);
      if (!status.ok) return fail(res, 400, status.error);
      params.push(status.value); sets.push(`"status" = $${params.length}`);
    }
    if (req.body?.urgent !== undefined) {
      const urgent = req.body.urgent === true;
      params.push(urgent); sets.push(`"urgent" = $${params.length}`);
      const urgentUntil = urgent ? new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() : null;
      params.push(urgentUntil); sets.push(`"urgentUntil" = $${params.length}`);
      const note = urgent && typeof req.body?.urgentNote === "string" ? req.body.urgentNote.trim().slice(0, 300) || null : null;
      params.push(note); sets.push(`"urgentNote" = $${params.length}`);
    }
    if (sets.length === 0) return fail(res, 400, "no_changes");

    params.push(id);
    const result = await pool.query(
      `UPDATE "BuildVacancy" SET ${sets.join(", ")} WHERE "id" = $${params.length} RETURNING *`,
      params,
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "vacancy_update_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/multi-post — clone a vacancy to multiple projects at once.
vacanciesRouter.post("/multi-post", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 10_000 });
    if (!description.ok) return fail(res, 400, description.error);
    const projectIds = Array.isArray(req.body?.projectIds) ? req.body.projectIds.map((p: unknown) => String(p)).slice(0, 20) : [];
    if (projectIds.length === 0) return fail(res, 400, "projectIds required");

    const salary = req.body?.salary != null ? Math.max(0, Number(req.body.salary) || 0) : 0;
    const salaryMin = req.body?.salaryMin != null ? Number(req.body.salaryMin) || null : null;
    const salaryMax = req.body?.salaryMax != null ? Number(req.body.salaryMax) || null : null;
    const skills = Array.isArray(req.body?.skills) ? req.body.skills.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30) : [];
    const salaryCurrency = String(req.body?.salaryCurrency || "RUB").slice(0, 8);
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 100) || null;
    const questions = Array.isArray(req.body?.questions) ? req.body.questions.map((q: unknown) => String(q).trim()).filter(Boolean).slice(0, 5) : [];
    const urgent = req.body?.urgent === true;
    const urgentNote = urgent && typeof req.body?.urgentNote === "string" ? req.body.urgentNote.trim().slice(0, 300) || null : null;
    const urgentUntil = urgent ? new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() : null;

    // Verify all projects belong to caller
    const projects = await pool.query(
      `SELECT "id" FROM "BuildProject" WHERE "id" = ANY($1::text[]) AND "clientId" = $2`,
      [projectIds, auth.sub],
    );
    if (projects.rowCount !== projectIds.length && auth.role !== "ADMIN") {
      return fail(res, 403, "some_projects_not_owned");
    }

    const created: string[] = [];
    for (const projectId of projectIds) {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO "BuildVacancy" ("id","projectId","title","description","salary","skillsJson","city","salaryCurrency","questionsJson","salaryMin","salaryMax","urgent","urgentUntil","urgentNote")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, projectId, title.value, description.value, salary, JSON.stringify(skills), city, salaryCurrency, JSON.stringify(questions), salaryMin, salaryMax, urgent, urgentUntil, urgentNote],
      );
      created.push(id);
    }
    return ok(res, { created, count: created.length }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "multi_post_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/notify-workers — push urgent notification to matching workers
vacanciesRouter.post("/:id/notify-workers", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const vac = await pool.query(
      `SELECT v.*, p."clientId", p."city" AS "projectCity" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (vac.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (vac.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "forbidden");

    const vacancy = vac.rows[0];
    const skills: string[] = safeParseJson(vacancy.skillsJson, []);
    const city = vacancy.city || vacancy.projectCity || null;

    // Find workers with matching skills who have push subscriptions
    let workerQuery = `
      SELECT DISTINCT ps."userId"
      FROM "BuildPushSubscription" ps
      JOIN "BuildProfile" bp ON bp."userId" = ps."userId"
      WHERE bp."buildRole" IN ('WORKER','CONTRACTOR') AND bp."openToWork" = TRUE
    `;
    const qParams: unknown[] = [];
    if (city) {
      qParams.push(`%${city}%`);
      workerQuery += ` AND (bp."city" ILIKE $${qParams.length} OR bp."preferredLocationsJson" ILIKE $${qParams.length})`;
    }
    if (skills.length > 0) {
      const skillConds = skills.map((s) => {
        qParams.push(`%${s.toLowerCase()}%`);
        return `lower(bp."skillsJson") LIKE $${qParams.length}`;
      });
      workerQuery += ` AND (${skillConds.join(" OR ")})`;
    }
    workerQuery += " LIMIT 500";

    const workers = await pool.query(workerQuery, qParams);

    const { sendToUser } = await import("./push");
    let sent = 0;
    for (const w of workers.rows as Array<{ userId: string }>) {
      const r = await sendToUser(w.userId, {
        title: `🚨 Срочная вакансия: ${vacancy.title}`,
        body: `${city ? city + " · " : ""}${vacancy.salary > 0 ? vacancy.salary.toLocaleString("ru-RU") + " ₽" : "Зарплата по договору"}`,
        url: `/build/vacancy/${id}`,
        tag: `urgent-${id}`,
      });
      sent += r.sent;
    }

    return ok(res, { notified: workers.rowCount, sent });
  } catch (err: unknown) {
    return fail(res, 500, "notify_workers_failed", { details: (err as Error).message });
  }
});

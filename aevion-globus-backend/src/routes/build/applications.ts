import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vEnum,
  safeParseJson,
  APPLICATION_STATUSES,
  getRecruiterTier,
} from "../../lib/build";

export const applicationsRouter = Router();

async function scoreApplicationAsync(
  applicationId: string,
  ctx: {
    vacancyTitle: string;
    vacancyDescription: string;
    requiredSkills: string[];
    questions: string[];
    answers: string[];
    candidateUserId: string;
  },
): Promise<void> {
  try {
    const { callClaude, APPLICATION_SCORER_SYSTEM_PROMPT } = await import("../../lib/build/ai");
    const profileQ = await pool.query(
      `SELECT "name","title","summary","skillsJson","experienceYears"
       FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [ctx.candidateUserId],
    );
    const p = profileQ.rows[0];
    const profileSummary = p
      ? `Name: ${p.name}; Headline: ${p.title || "—"}; Years: ${p.experienceYears ?? 0}; Skills: ${(safeParseJson(p.skillsJson, [] as string[]) ?? []).join(", ") || "—"}; Summary: ${p.summary || "—"}`
      : "(no profile)";

    const userPayload = `VACANCY:\nTitle: ${ctx.vacancyTitle}\nDescription: ${ctx.vacancyDescription}\nRequired skills: ${ctx.requiredSkills.join(", ") || "—"}\n\nQUESTIONS:\n${ctx.questions.map((q, i) => `Q${i + 1}: ${q}`).join("\n")}\n\nCANDIDATE PROFILE:\n${profileSummary}\n\nCANDIDATE ANSWERS:\n${ctx.answers.map((a, i) => `A${i + 1}: ${a || "(empty)"}`).join("\n")}\n\nВозвращай только JSON. Без markdown.`;

    const reply = await callClaude({
      systemPrompt: APPLICATION_SCORER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPayload }],
      maxTokens: 1024,
      cacheSystem: true,
    });

    const stripped = reply.text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    let parsed: { overall?: number } | null = null;
    try { parsed = JSON.parse(stripped); } catch {
      console.warn(`[build] AI scoring returned invalid JSON for app ${applicationId}`);
      return;
    }
    const overall = typeof parsed?.overall === "number" ? Math.max(0, Math.min(100, Math.round(parsed.overall))) : null;

    await pool.query(
      `UPDATE "BuildApplication" SET "aiScoresJson" = $2, "aiScoreOverall" = $3, "updatedAt" = NOW() WHERE "id" = $1`,
      [applicationId, JSON.stringify(parsed), overall],
    );
  } catch (err) {
    console.warn(`[build] AI scoring failed for app ${applicationId}:`, (err as Error).message);
  }
}

// POST /api/build/applications — apply to vacancy
applicationsRouter.post("/", async (req, res) => {
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
      `SELECT v."id", v."status" AS "vacancyStatus", v."title", v."description",
              v."skillsJson", v."questionsJson", p."clientId"
       FROM "BuildVacancy" v LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId.value],
    );
    if (vacancy.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (vacancy.rows[0].vacancyStatus === "CLOSED") return fail(res, 409, "vacancy_closed");
    if (vacancy.rows[0].clientId === auth.sub) return fail(res, 400, "cannot_apply_to_own_vacancy");

    const questions = safeParseJson(vacancy.rows[0].questionsJson, [] as string[]);
    const answers = Array.isArray(req.body?.answers)
      ? req.body.answers.map((a: unknown) => String(a ?? "").trim().slice(0, 2000))
      : [];
    while (answers.length < questions.length) answers.push("");

    const referredByRaw = req.body?.referredByUserId;
    const referredByUserId =
      typeof referredByRaw === "string" && referredByRaw.trim().length > 0 && referredByRaw.trim() !== auth.sub
        ? referredByRaw.trim().slice(0, 200) : null;

    const id = crypto.randomUUID();
    try {
      const result = await pool.query(
        `INSERT INTO "BuildApplication" ("id","vacancyId","userId","message","answersJson","referredByUserId")
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, vacancyId.value, auth.sub, message.value || null, JSON.stringify(answers), referredByUserId],
      );

      if (questions.length > 0 && process.env.ANTHROPIC_API_KEY) {
        void scoreApplicationAsync(id, {
          vacancyTitle: vacancy.rows[0].title,
          vacancyDescription: vacancy.rows[0].description,
          requiredSkills: safeParseJson(vacancy.rows[0].skillsJson, [] as string[]),
          questions, answers, candidateUserId: auth.sub,
        });
      }

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

// GET /api/build/applications/my
applicationsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const result = await pool.query(
      `SELECT a.*, v."title" AS "vacancyTitle", v."salary", p."id" AS "projectId", p."title" AS "projectTitle"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."userId" = $1 ORDER BY a."createdAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/applications/by-vacancy/:id — owner only
applicationsRouter.get("/by-vacancy/:id", async (req, res) => {
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
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_vacancy_owner_can_list");

    const [vacancy, result] = await Promise.all([
      pool.query(`SELECT v."skillsJson", v."title" FROM "BuildVacancy" v WHERE v."id" = $1 LIMIT 1`, [id]),
      pool.query(
        `SELECT a.*, u."email", u."name" AS "applicantName",
                bp."city" AS "applicantCity", bp."skillsJson" AS "applicantSkillsJson",
                bp."title" AS "applicantHeadline", bp."experienceYears" AS "applicantExperienceYears"
         FROM "BuildApplication" a
         LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
         LEFT JOIN "BuildProfile" bp ON bp."userId" = a."userId"
         WHERE a."vacancyId" = $1 ORDER BY a."createdAt" DESC`,
        [id],
      ),
    ]);

    const vSkills = new Set(safeParseJson(vacancy.rows[0]?.skillsJson, [] as string[]).map((s) => s.toLowerCase()));
    const items = result.rows.map((row: Record<string, unknown>) => {
      const aSkillsArr = safeParseJson(row.applicantSkillsJson, [] as string[]);
      const aSkills = new Set(aSkillsArr.map((s) => s.toLowerCase()));
      let matchScore: number | null = null;
      let matchedSkills: string[] = [];
      if (vSkills.size > 0) {
        matchedSkills = aSkillsArr.filter((s) => vSkills.has(s.toLowerCase()));
        matchScore = Math.round((matchedSkills.length / vSkills.size) * 100);
      }
      void aSkills;
      return { ...row, applicantSkills: aSkillsArr, matchScore, matchedSkills };
    });

    items.sort((a: { matchScore: number | null }, b: { matchScore: number | null }) => {
      if (a.matchScore == null && b.matchScore == null) return 0;
      if (a.matchScore == null) return 1;
      if (b.matchScore == null) return -1;
      return b.matchScore - a.matchScore;
    });

    return ok(res, { items, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "applications_by_vacancy_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/applications/:id — owner accepts/rejects.
// On ACCEPT: creates an idempotent HIRE_FEE BuildOrder (amount = salary ×
// hireFeeBps / 10000) for the recruiter. Fee is tier-adjusted at the
// moment of hire, not at order payment time.
applicationsRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const status = vEnum(req.body?.status, "status", APPLICATION_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);

    const row = await pool.query(
      `SELECT a."id", a."userId", a."vacancyId", p."clientId",
              v."salary", v."salaryCurrency"
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
      `UPDATE "BuildApplication" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING *`,
      [status.value, id],
    );

    let hireOrder: Record<string, unknown> | null = null;
    if (status.value === "ACCEPTED") {
      const app = row.rows[0];
      const salary = Number(app.salary) || 0;
      const currency = String(app.salaryCurrency || "RUB");

      // Idempotent: skip if a HIRE_FEE order already exists for this application.
      const existing = await pool.query(
        `SELECT "id" FROM "BuildOrder" WHERE "kind" = 'HIRE_FEE' AND "ref" = $1 LIMIT 1`,
        [id],
      );

      if ((existing.rowCount ?? 0) === 0) {
        const { tier } = await getRecruiterTier(auth.sub);
        const feeAmount = Math.round(salary * (tier.hireFeeBps / 10000));

        const orderId = crypto.randomUUID();
        const orderResult = await pool.query(
          `INSERT INTO "BuildOrder"
             ("id","userId","kind","ref","amount","currency","status","metaJson")
           VALUES ($1,$2,'HIRE_FEE',$3,$4,$5,'PENDING',$6)
           RETURNING *`,
          [
            orderId,
            auth.sub,
            id,
            feeAmount,
            currency,
            JSON.stringify({
              applicationId: id,
              vacancyId: app.vacancyId,
              candidateId: app.userId,
              salary,
              hireFeeBps: tier.hireFeeBps,
              tierKey: tier.key,
            }),
          ],
        );
        hireOrder = orderResult.rows[0];
      } else {
        const o = await pool.query(
          `SELECT * FROM "BuildOrder" WHERE "id" = $1`,
          [existing.rows[0].id],
        );
        hireOrder = o.rows[0];
      }
    }

    // Fire-and-forget email notification to candidate
    const candidateId = row.rows[0].userId;
    void notifyCandidate(candidateId, status.value as "ACCEPTED" | "REJECTED").catch(() => {});

    return ok(res, { ...result.rows[0], hireOrder });
  } catch (err: unknown) {
    return fail(res, 500, "application_update_failed", { details: (err as Error).message });
  }
});

async function notifyCandidate(candidateId: string, status: "ACCEPTED" | "REJECTED") {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // email not configured
  try {
    const u = await pool.query(`SELECT "email","name" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [candidateId]);
    if (!u.rows[0]) return;
    const { email, name } = u.rows[0] as { email: string; name: string };
    const subject = status === "ACCEPTED"
      ? "Your application was accepted — AEVION QBuild"
      : "Update on your application — AEVION QBuild";
    const text = status === "ACCEPTED"
      ? `Hi ${name},\n\nGreat news! Your application was accepted. The employer will reach out via AEVION QBuild messages.\n\nhttps://aevion.tech/build/applications\n\n— AEVION QBuild`
      : `Hi ${name},\n\nThis employer has decided not to move forward. Keep browsing open vacancies.\n\nhttps://aevion.tech/build/vacancies\n\n— AEVION QBuild`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "QBuild <noreply@aevion.tech>", to: email, subject, text }),
    });
    console.info(`[build] email sent to ${email} (${status})`);
  } catch (e) {
    console.warn("[build] email notify failed:", (e as Error).message);
  }
}

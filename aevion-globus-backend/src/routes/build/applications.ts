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

      // Notify employer via webhook env (fire-and-forget)
      void notifyNewApplication(vacancy.rows[0].clientId, {
        applicationId: id, vacancyId: vacancyId.value, vacancyTitle: vacancy.rows[0].title,
        candidateId: auth.sub,
      }).catch(() => {});

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

async function notifyNewApplication(
  employerId: string,
  data: { applicationId: string; vacancyId: string; vacancyTitle: string; candidateId: string },
): Promise<void> {
  const webhookUrl = process.env.BUILD_APPLICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  const secret = process.env.BUILD_PAYMENT_WEBHOOK_SECRET ?? "";
  const payload = JSON.stringify({ event: "application.new", ...data, ts: Date.now() });
  const sig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Aevion-Signature": sig, "X-Employer-Id": employerId },
    body: payload,
    signal: AbortSignal.timeout(5000),
  });
}

// GET /api/build/applications/my
applicationsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const result = await pool.query(
      `SELECT a.*, v."title" AS "vacancyTitle", v."salary",
              v."status" AS "vacancyStatus", v."expiresAt" AS "vacancyExpiresAt",
              p."id" AS "projectId", p."title" AS "projectTitle"
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
// GET /api/build/applications/by-vacancy/:id/export.csv — owner downloads all applicants as CSV
applicationsRouter.get("/by-vacancy/:id/export.csv", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const owner = await pool.query(
      `SELECT v."title", p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const rows = await pool.query(
      `SELECT a."id", a."status", a."labelKey", a."createdAt", a."message", a."rejectReason",
              a."aiScoreOverall", a."matchScore",
              u."name" AS "applicantName", u."email" AS "applicantEmail",
              p."title" AS "profileTitle", p."city", p."experienceYears", p."skillsJson"
       FROM "BuildApplication" a
       JOIN "AEVIONUser" u ON u."id" = a."userId"
       LEFT JOIN "BuildProfile" p ON p."userId" = a."userId"
       WHERE a."vacancyId" = $1
       ORDER BY a."createdAt" DESC`,
      [id],
    );

    const header = ["id", "status", "label", "createdAt", "name", "email", "city", "experienceYears", "profileTitle", "skills", "aiScore", "matchScore", "message", "rejectReason"].join(",");
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const skillsList = (j: unknown) => {
      if (typeof j !== "string") return "";
      try { return (JSON.parse(j) as string[]).join("; "); } catch { return ""; }
    };
    const body = rows.rows.map((r: Record<string, unknown>) =>
      [r.id, r.status, r.labelKey, r.createdAt, r.applicantName, r.applicantEmail, r.city, r.experienceYears, r.profileTitle, skillsList(r.skillsJson), r.aiScoreOverall, r.matchScore, r.message, r.rejectReason]
        .map(escape)
        .join(","),
    ).join("\n");

    const vacancySlug = String(owner.rows[0].title || id).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="applications-${vacancySlug}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(`${header}\n${body}`);
  } catch (err: unknown) {
    return fail(res, 500, "applications_csv_failed", { details: (err as Error).message });
  }
});

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

    const rejectReason = status.value === "REJECTED" && req.body?.rejectReason
      ? String(req.body.rejectReason).slice(0, 500)
      : null;

    const result = await pool.query(
      `UPDATE "BuildApplication"
       SET "status" = $1, "updatedAt" = NOW()
         ${rejectReason !== null ? `, "rejectReason" = $3` : ""}
       WHERE "id" = $2
       RETURNING *`,
      rejectReason !== null ? [status.value, id, rejectReason] : [status.value, id],
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

// GET /api/build/applications/:id/notes — vacancy owner reads private notes.
applicationsRouter.get("/:id/notes", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "application_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_read_notes");
    }

    const r = await pool.query(
      `SELECT "id","applicationId","authorUserId","body","isPinned","createdAt"
       FROM "BuildApplicationNote"
       WHERE "applicationId" = $1
       ORDER BY "isPinned" DESC, "createdAt" DESC
       LIMIT 200`,
      [id],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "application_notes_fetch_failed", { details: (err as Error).message });
  }
});

// POST /api/build/applications/:id/notes — vacancy owner writes a note.
applicationsRouter.post("/:id/notes", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const body = vString(req.body?.body, "body", { min: 1, max: 4000 });
    if (!body.ok) return fail(res, 400, body.error);

    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "application_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_add_notes");
    }

    const noteId = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildApplicationNote" ("id","applicationId","authorUserId","body")
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [noteId, id, auth.sub, body.value],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_note_create_failed", { details: (err as Error).message });
  }
});

// POST /api/build/applications/bulk-status
// Owner-only. Bulk-update status (e.g. ACCEPTED or REJECTED) for several
// applications at once. Each application is verified to belong to a vacancy
// owned by the caller; rows that fail the check are silently skipped (their
// id is returned in skipped[]). Caps at 50 per call.
//
// We do NOT fire hire fees from this endpoint — too easy to trigger expensive
// operations in bulk by accident. Bulk ACCEPT just flips status and emails;
// individual Accept on the row keeps the fee logic.
applicationsRouter.post("/bulk-status", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 50)
      : [];
    if (ids.length === 0) return fail(res, 400, "ids_required");

    const status = vEnum(req.body?.status, "status", APPLICATION_STATUSES);
    if (!status.ok) return fail(res, 400, status.error);
    if (status.value === "PENDING") return fail(res, 400, "cannot_bulk_revert_to_pending");

    const rejectReason = status.value === "REJECTED" && typeof req.body?.rejectReason === "string"
      ? req.body.rejectReason.slice(0, 500)
      : null;

    // Load owner for each application in one query.
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const owned = await pool.query(
      `SELECT a."id", a."userId", p."clientId" FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" IN (${placeholders})`,
      ids,
    );

    const ownedSet = new Set<string>();
    const skipped: string[] = [];
    const candidateIdsByApp: Record<string, string> = {};
    for (const row of owned.rows as { id: string; userId: string; clientId: string }[]) {
      if (row.clientId === auth.sub || auth.role === "ADMIN") {
        ownedSet.add(row.id);
        candidateIdsByApp[row.id] = row.userId;
      } else {
        skipped.push(row.id);
      }
    }
    for (const id of ids) {
      if (!ownedSet.has(id) && !skipped.includes(id)) skipped.push(id);
    }
    const okIds = ids.filter((id) => ownedSet.has(id));
    if (okIds.length === 0) return ok(res, { updated: 0, skipped });

    const updatePlaceholders = okIds.map((_, i) => `$${i + 2}`).join(",");
    const params: unknown[] = [status.value, ...okIds];
    let extra = "";
    if (rejectReason !== null) {
      params.push(rejectReason);
      extra = `, "rejectReason" = $${params.length}`;
    }
    await pool.query(
      `UPDATE "BuildApplication"
       SET "status" = $1, "updatedAt" = NOW()${extra}
       WHERE "id" IN (${updatePlaceholders})`,
      params,
    );

    // Fire-and-forget candidate emails for each
    for (const id of okIds) {
      const candidateId = candidateIdsByApp[id];
      if (candidateId) {
        void notifyCandidate(candidateId, status.value as "ACCEPTED" | "REJECTED").catch(() => {});
      }
    }

    return ok(res, { updated: okIds.length, skipped, status: status.value });
  } catch (err: unknown) {
    return fail(res, 500, "applications_bulk_status_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/applications/:id/label
// Owner-only. Sets a recruiter-private label on the application
// (SHORTLIST/INTERVIEW/HOLD/TOP_PICK or null to clear). Doesn't move the
// application status, so it doesn't email the candidate or fire hire fees.
const ALLOWED_LABELS = new Set(["SHORTLIST", "INTERVIEW", "HOLD", "TOP_PICK"]);
applicationsRouter.patch("/:id/label", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const labelRaw = req.body?.labelKey;
    let labelKey: string | null = null;
    if (labelRaw === null || labelRaw === "" || labelRaw === undefined) {
      labelKey = null;
    } else if (typeof labelRaw === "string" && ALLOWED_LABELS.has(labelRaw)) {
      labelKey = labelRaw;
    } else {
      return fail(res, 400, "invalid_label");
    }

    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [id],
    );
    if (owner.rowCount === 0) return fail(res, 404, "application_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_label");
    }

    const r = await pool.query(
      `UPDATE "BuildApplication" SET "labelKey" = $2, "updatedAt" = NOW()
       WHERE "id" = $1 RETURNING *`,
      [id, labelKey],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_label_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/applications/:id/notes/:noteId — toggle isPinned.
applicationsRouter.patch("/:id/notes/:noteId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const noteId = String(req.params.noteId);
    if (typeof req.body?.isPinned !== "boolean") {
      return fail(res, 400, "isPinned_required");
    }
    const isPinned: boolean = req.body.isPinned;

    const note = await pool.query(
      `SELECT n."authorUserId", p."clientId"
       FROM "BuildApplicationNote" n
       LEFT JOIN "BuildApplication" a ON a."id" = n."applicationId"
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE n."id" = $1 AND n."applicationId" = $2 LIMIT 1`,
      [noteId, id],
    );
    if (note.rowCount === 0) return fail(res, 404, "note_not_found");
    if (note.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_pin");
    }

    const r = await pool.query(
      `UPDATE "BuildApplicationNote" SET "isPinned" = $2 WHERE "id" = $1 RETURNING *`,
      [noteId, isPinned],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_note_pin_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/applications/:id/notes/:noteId — owner or note author deletes.
applicationsRouter.delete("/:id/notes/:noteId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const noteId = String(req.params.noteId);

    const note = await pool.query(
      `SELECT n."authorUserId", p."clientId"
       FROM "BuildApplicationNote" n
       LEFT JOIN "BuildApplication" a ON a."id" = n."applicationId"
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE n."id" = $1 AND n."applicationId" = $2 LIMIT 1`,
      [noteId, id],
    );
    if (note.rowCount === 0) return fail(res, 404, "note_not_found");
    const { authorUserId, clientId } = note.rows[0];
    if (authorUserId !== auth.sub && clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_owner_or_author_can_delete_note");
    }
    await pool.query(`DELETE FROM "BuildApplicationNote" WHERE "id" = $1`, [noteId]);
    return ok(res, { id: noteId });
  } catch (err: unknown) {
    return fail(res, 500, "application_note_delete_failed", { details: (err as Error).message });
  }
});

// POST /api/build/vacancies/:id/bulk-message
// Owner sends the same DM to every applicant matching `status` (default PENDING).
// Mounted under /applications because it derives the recipient set from
// applications, even though the URL parameter is a vacancyId. We also expose
// it under /vacancies via the alias below in vacancies.ts.
applicationsRouter.post("/bulk-message/:vacancyId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const vacancyId = String(req.params.vacancyId);

    const content = vString(req.body?.content, "content", { min: 1, max: 4000 });
    if (!content.ok) return fail(res, 400, content.error);
    const statusFilter = typeof req.body?.status === "string"
      ? String(req.body.status).toUpperCase()
      : "PENDING";
    if (!["PENDING", "ACCEPTED", "REJECTED", "ALL"].includes(statusFilter)) {
      return fail(res, 400, "invalid_status_filter");
    }

    const owner = await pool.query(
      `SELECT p."clientId" FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [vacancyId],
    );
    if (owner.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    if (owner.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_vacancy_owner_can_bulk_message");
    }

    const params: unknown[] = [vacancyId];
    let extra = "";
    if (statusFilter !== "ALL") {
      params.push(statusFilter);
      extra = ` AND a."status" = $2`;
    }
    const recipients = await pool.query(
      `SELECT DISTINCT a."userId" FROM "BuildApplication" a
       WHERE a."vacancyId" = $1${extra} AND a."userId" <> '${auth.sub.replace(/'/g, "''")}'`,
      params,
    );

    const ids: string[] = recipients.rows.map((r: Record<string, unknown>) => String(r.userId));
    if (ids.length === 0) return ok(res, { sent: 0, recipients: [] });

    // Cap at 200 per call so a runaway loop can't spam.
    const capped = ids.slice(0, 200);
    let sent = 0;
    for (const rid of capped) {
      try {
        const id = crypto.randomUUID();
        await pool.query(
          `INSERT INTO "BuildMessage" ("id","senderId","receiverId","content") VALUES ($1,$2,$3,$4)`,
          [id, auth.sub, rid, content.value],
        );
        sent += 1;
      } catch {
        // Continue on per-row errors (e.g. unique violation, deleted user)
      }
    }
    return ok(res, { sent, recipients: capped });
  } catch (err: unknown) {
    return fail(res, 500, "bulk_message_failed", { details: (err as Error).message });
  }
});

// POST /api/build/applications/:id/withdraw — candidate withdraws their own application.
// Status moves to REJECTED with a rejectReason of "(withdrawn by candidate)" so the
// recruiter still sees it in their pipeline. We don't introduce a new status to keep
// the existing analytics/CSV stable.
applicationsRouter.post("/:id/withdraw", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const row = await pool.query(
      `SELECT "id","userId","status" FROM "BuildApplication" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (row.rowCount === 0) return fail(res, 404, "application_not_found");
    if (row.rows[0].userId !== auth.sub) {
      return fail(res, 403, "only_applicant_can_withdraw");
    }
    if (row.rows[0].status === "ACCEPTED") {
      return fail(res, 409, "cannot_withdraw_accepted_application");
    }

    const result = await pool.query(
      `UPDATE "BuildApplication"
       SET "status" = 'REJECTED', "rejectReason" = '(withdrawn by candidate)', "updatedAt" = NOW()
       WHERE "id" = $1 RETURNING *`,
      [id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "application_withdraw_failed", { details: (err as Error).message });
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

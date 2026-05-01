import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, vNumber, TRIAL_TASK_STATUSES } from "../../lib/build";

export const trialTasksRouter = Router();

async function loadTrialAndCheck(
  id: string,
  expectedActor: "candidate" | "recruiter",
  authSub: string,
  authRole: string,
): Promise<{ row: Record<string, unknown>; err?: { status: number; code: string } }> {
  const q = await pool.query(`SELECT * FROM "BuildTrialTask" WHERE "id" = $1 LIMIT 1`, [id]);
  if (q.rowCount === 0) return { row: {}, err: { status: 404, code: "trial_not_found" } };
  const row = q.rows[0];
  const expectedId = expectedActor === "candidate" ? row.candidateId : row.recruiterId;
  if (expectedId !== authSub && authRole !== "ADMIN") return { row, err: { status: 403, code: `only_${expectedActor}_can_act` } };
  return { row };
}

// POST /api/build/trial-tasks — recruiter proposes
trialTasksRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 200 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);
    const title = vString(req.body?.title, "title", { min: 3, max: 200 });
    if (!title.ok) return fail(res, 400, title.error);
    const description = vString(req.body?.description, "description", { min: 10, max: 4000 });
    if (!description.ok) return fail(res, 400, description.error);
    const paymentAmount = req.body?.paymentAmount == null
      ? 0 : Math.round(Math.max(0, Math.min(1e9, Number(req.body.paymentAmount) || 0)));
    const paymentCurrency = typeof req.body?.paymentCurrency === "string"
      ? req.body.paymentCurrency.trim().slice(0, 8) || "RUB" : "RUB";

    const appQ = await pool.query(
      `SELECT a."id", a."userId" AS "candidateId", a."vacancyId",
              v."projectId", p."clientId" AS "recruiterId"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [applicationId.value],
    );
    if (appQ.rowCount === 0) return fail(res, 404, "application_not_found");
    const app = appQ.rows[0];
    if (app.recruiterId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_vacancy_owner_can_propose_trial");

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildTrialTask"
         ("id","applicationId","vacancyId","recruiterId","candidateId","title","description","paymentAmount","paymentCurrency","status")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PROPOSED') RETURNING *`,
      [id, applicationId.value, app.vacancyId, app.recruiterId, app.candidateId, title.value, description.value, paymentAmount, paymentCurrency],
    );
    return ok(res, r.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "trial_create_failed", { details: (err as Error).message });
  }
});

// POST /api/build/trial-tasks/:id/accept — candidate
trialTasksRouter.post("/:id/accept", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const { row, err } = await loadTrialAndCheck(String(req.params.id), "candidate", auth.sub, auth.role);
    if (err) return fail(res, err.status, err.code);
    if (row.status !== "PROPOSED") return fail(res, 400, "trial_not_in_proposed_state", { currentStatus: row.status });
    const r = await pool.query(`UPDATE "BuildTrialTask" SET "status" = 'ACCEPTED', "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`, [row.id]);
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "trial_accept_failed", { details: (err as Error).message });
  }
});

// POST /api/build/trial-tasks/:id/submit — candidate
trialTasksRouter.post("/:id/submit", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const { row, err } = await loadTrialAndCheck(String(req.params.id), "candidate", auth.sub, auth.role);
    if (err) return fail(res, err.status, err.code);
    if (row.status !== "ACCEPTED") return fail(res, 400, "trial_not_in_accepted_state", { currentStatus: row.status });
    const submissionUrl = req.body?.submissionUrl == null ? null : String(req.body.submissionUrl).trim().slice(0, 2000) || null;
    const submissionNote = req.body?.submissionNote == null ? null : String(req.body.submissionNote).trim().slice(0, 4000) || null;
    const r = await pool.query(
      `UPDATE "BuildTrialTask" SET "status" = 'SUBMITTED', "submissionUrl" = $2, "submissionNote" = $3, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
      [row.id, submissionUrl, submissionNote],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "trial_submit_failed", { details: (err as Error).message });
  }
});

// POST /api/build/trial-tasks/:id/approve — recruiter
trialTasksRouter.post("/:id/approve", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const { row, err } = await loadTrialAndCheck(String(req.params.id), "recruiter", auth.sub, auth.role);
    if (err) return fail(res, err.status, err.code);
    if (row.status !== "SUBMITTED") return fail(res, 400, "trial_not_in_submitted_state", { currentStatus: row.status });

    await pool.query("BEGIN");
    try {
      const orderId = crypto.randomUUID();
      const orderStatus = (row.paymentAmount as number) > 0 ? "PENDING" : "PAID";
      await pool.query(
        `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
         VALUES ($1,$2,'TRIAL_PAYOUT',$3,$4,$5,$6,$7)`,
        [orderId, row.recruiterId, row.id, row.paymentAmount, row.paymentCurrency, orderStatus,
          JSON.stringify({ candidateId: row.candidateId, vacancyId: row.vacancyId })],
      );
      const r = await pool.query(
        `UPDATE "BuildTrialTask" SET "status" = 'APPROVED', "payoutOrderId" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
        [row.id, orderId],
      );
      await pool.query("COMMIT");
      return ok(res, { trialTask: r.rows[0], payoutOrderId: orderId, payoutStatus: orderStatus });
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "trial_approve_failed", { details: (err as Error).message });
  }
});

// POST /api/build/trial-tasks/:id/reject — candidate or recruiter
trialTasksRouter.post("/:id/reject", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const q = await pool.query(`SELECT * FROM "BuildTrialTask" WHERE "id" = $1 LIMIT 1`, [id]);
    if (q.rowCount === 0) return fail(res, 404, "trial_not_found");
    const row = q.rows[0];
    const isCandidateAtProposed = row.candidateId === auth.sub && row.status === "PROPOSED";
    const isRecruiterAtSubmitted = row.recruiterId === auth.sub && row.status === "SUBMITTED";
    if (!isCandidateAtProposed && !isRecruiterAtSubmitted && auth.role !== "ADMIN") return fail(res, 403, "cannot_reject_at_this_stage");
    const reason = req.body?.reason == null ? null : String(req.body.reason).trim().slice(0, 1000) || null;
    const r = await pool.query(
      `UPDATE "BuildTrialTask" SET "status" = 'REJECTED', "rejectReason" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
      [id, reason],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "trial_reject_failed", { details: (err as Error).message });
  }
});

// GET /api/build/trial-tasks/by-application/:applicationId
trialTasksRouter.get("/by-application/:applicationId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.applicationId);
    const r = await pool.query(`SELECT * FROM "BuildTrialTask" WHERE "applicationId" = $1 ORDER BY "createdAt" DESC`, [id]);
    if ((r.rowCount ?? 0) > 0) {
      const row = r.rows[0];
      if (row.recruiterId !== auth.sub && row.candidateId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_party_to_trial");
    }
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "trial_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/trial-tasks/my
trialTasksRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT t.*, v."title" AS "vacancyTitle", p."title" AS "projectTitle"
       FROM "BuildTrialTask" t
       LEFT JOIN "BuildVacancy" v ON v."id" = t."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE t."candidateId" = $1 OR t."recruiterId" = $1
       ORDER BY t."updatedAt" DESC LIMIT 100`,
      [auth.sub],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "trial_my_failed", { details: (err as Error).message });
  }
});

void TRIAL_TASK_STATUSES;
void vNumber;

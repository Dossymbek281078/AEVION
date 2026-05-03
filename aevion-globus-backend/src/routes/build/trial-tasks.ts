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

// GET /api/build/trial-tasks/:id/invoice.pdf — recruiter downloads payment invoice
trialTasksRouter.get("/:id/invoice.pdf", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const r = await pool.query(
      `SELECT t.*, u."name" AS "candidateName", u."email" AS "candidateEmail",
              r."name" AS "recruiterName", v."title" AS "vacancyTitle"
       FROM "BuildTrialTask" t
       JOIN "AEVIONUser" u ON u."id" = t."candidateId"
       JOIN "AEVIONUser" r ON r."id" = t."recruiterId"
       LEFT JOIN "BuildVacancy" v ON v."id" = t."vacancyId"
       WHERE t."id" = $1 LIMIT 1`,
      [id],
    );
    if (r.rowCount === 0) return fail(res, 404, "trial_not_found");
    const t = r.rows[0];
    if (t.recruiterId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_recruiter");
    if (t.status !== "APPROVED") return fail(res, 400, "trial_not_approved");

    const PDFDocument = ((await import("pdfkit")) as unknown as { default: new (opts: object) => PDFKit.PDFDocument }).default;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    await new Promise<void>((resolve) => doc.on("end", resolve));

    doc.fontSize(22).font("Helvetica-Bold").text("AEVION QBuild", 50, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("Trial Task Invoice", 50, 80);

    doc.moveTo(50, 100).lineTo(545, 100).stroke("#e2e8f0");

    doc.fillColor("#0f172a").fontSize(12).font("Helvetica-Bold").text("Invoice details", 50, 115);
    const col = (label: string, value: string, y: number) => {
      doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(label, 50, y);
      doc.fontSize(10).font("Helvetica").fillColor("#0f172a").text(value, 180, y);
    };
    col("Invoice ID", id.slice(0, 16), 140);
    col("Date", new Date().toLocaleDateString("en-GB"), 158);
    col("Status", "PAID", 176);
    col("Task", t.title || "Trial task", 194);
    col("Vacancy", t.vacancyTitle || "—", 212);
    col("Candidate", `${t.candidateName} <${t.candidateEmail}>`, 230);
    col("Recruiter / Payer", t.recruiterName || "—", 248);

    doc.moveTo(50, 275).lineTo(545, 275).stroke("#e2e8f0");

    doc.fillColor("#0f172a").fontSize(14).font("Helvetica-Bold").text("Amount due", 50, 290);
    const amt = `${Number(t.paymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t.paymentCurrency}`;
    doc.fontSize(28).text(amt, 50, 310);

    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(
      "This invoice is generated automatically by AEVION QBuild. Keep for your records.",
      50, 380, { width: 495 },
    );

    doc.end();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="qbuild-invoice-${id.slice(0, 8)}.pdf"`);
    const pdf = Buffer.concat(chunks);
    return res.send(pdf);
  } catch (err: unknown) {
    return fail(res, 500, "trial_invoice_failed", { details: (err as Error).message });
  }
});

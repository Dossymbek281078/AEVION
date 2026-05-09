import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, safeParseJson } from "../../lib/build";
import { sendNewMessage } from "../../lib/build/email";

export const interviewsRouter = Router();

// Recruiter proposes time slots → candidate picks one → both get confirmation.

// POST /api/build/interviews — recruiter proposes slots
// Body: { applicationId, slots: string[] (ISO), notes?, meetingUrl? }
interviewsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 100 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);

    const app = await pool.query(
      `SELECT a."userId" AS "candidateId", p."clientId" AS "recruiterId", a."status"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 LIMIT 1`,
      [applicationId.value],
    );
    if (app.rowCount === 0) return fail(res, 404, "application_not_found");
    const { candidateId, recruiterId } = app.rows[0] as { candidateId: string; recruiterId: string };
    if (recruiterId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_recruiter_can_propose");

    const slots = Array.isArray(req.body?.slots)
      ? req.body.slots.map((s: unknown) => String(s)).filter((s: string) => s.length > 0).slice(0, 5)
      : [];
    if (slots.length === 0) return fail(res, 400, "at least one slot required");

    const notes = req.body?.notes == null ? null : String(req.body.notes).trim().slice(0, 500) || null;
    const meetingUrl = req.body?.meetingUrl == null ? null : String(req.body.meetingUrl).trim().slice(0, 500) || null;

    const id = crypto.randomUUID();
    // Upsert — one interview per application
    await pool.query(
      `INSERT INTO "BuildInterview" ("id","applicationId","recruiterId","candidateId","proposedSlots","notes","meetingUrl")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("applicationId") DO UPDATE SET
         "proposedSlots" = $5, "notes" = $6, "meetingUrl" = $7,
         "status" = 'PROPOSED', "confirmedSlot" = NULL, "updatedAt" = NOW()`,
      [id, applicationId.value, recruiterId, candidateId, JSON.stringify(slots), notes, meetingUrl],
    );

    const r = await pool.query(`SELECT * FROM "BuildInterview" WHERE "applicationId" = $1 LIMIT 1`, [applicationId.value]);

    // Notify candidate via email
    void (async () => {
      try {
        const emails = await pool.query(
          `SELECT cu."email" AS "cEmail", cu."name" AS "cName", ru."name" AS "rName"
           FROM "AEVIONUser" cu, "AEVIONUser" ru
           WHERE cu."id" = $1 AND ru."id" = $2`,
          [candidateId, recruiterId],
        );
        const e = emails.rows[0];
        if (e?.cEmail) {
          sendNewMessage({
            receiverEmail: e.cEmail,
            senderName: e.rName ?? "Работодатель",
            preview: `Предложено ${slots.length} вариант(а) для интервью. Выберите удобное время.`,
          });
        }
      } catch {/**/}
    })();

    return ok(res, { ...r.rows[0], slots: safeParseJson(r.rows[0].proposedSlots, [] as string[]) }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "interview_propose_failed", { details: (err as Error).message });
  }
});

// GET /api/build/interviews/my — both sides see their interviews
interviewsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT i.*, a."vacancyId", v."title" AS "vacancyTitle"
       FROM "BuildInterview" i
       LEFT JOIN "BuildApplication" a ON a."id" = i."applicationId"
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       WHERE i."recruiterId" = $1 OR i."candidateId" = $1
       ORDER BY i."updatedAt" DESC`,
      [auth.sub],
    );
    const items = r.rows.map((row: Record<string, unknown>) => ({
      ...row,
      slots: safeParseJson(row.proposedSlots, [] as string[]),
    }));
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "interviews_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/interviews/by-application/:id
interviewsRouter.get("/by-application/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT * FROM "BuildInterview" WHERE "applicationId" = $1 LIMIT 1`,
      [req.params.id],
    );
    if (r.rowCount === 0) return ok(res, null);
    const row = r.rows[0];
    const isParty = row.recruiterId === auth.sub || row.candidateId === auth.sub || auth.role === "ADMIN";
    if (!isParty) return fail(res, 403, "forbidden");
    return ok(res, { ...row, slots: safeParseJson(row.proposedSlots, [] as string[]) });
  } catch (err: unknown) {
    return fail(res, 500, "interview_fetch_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/interviews/:id/confirm — candidate picks a slot
interviewsRouter.patch("/:id/confirm", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const row = await pool.query(`SELECT * FROM "BuildInterview" WHERE "id" = $1 LIMIT 1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "interview_not_found");
    const iv = row.rows[0] as { candidateId: string; proposedSlots: string; recruiterId: string };
    if (iv.candidateId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_candidate_can_confirm");

    const slot = vString(req.body?.slot, "slot", { min: 1, max: 100 });
    if (!slot.ok) return fail(res, 400, slot.error);
    const slots: string[] = safeParseJson(iv.proposedSlots, []);
    if (!slots.includes(slot.value)) return fail(res, 400, "slot_not_in_proposed_list");

    const r = await pool.query(
      `UPDATE "BuildInterview" SET "confirmedSlot" = $1, "status" = 'CONFIRMED', "updatedAt" = NOW()
       WHERE "id" = $2 RETURNING *`,
      [slot.value, id],
    );

    // Notify recruiter
    void (async () => {
      try {
        const emails = await pool.query(
          `SELECT ru."email", ru."name" AS "rName", cu."name" AS "cName"
           FROM "AEVIONUser" ru, "AEVIONUser" cu
           WHERE ru."id" = $1 AND cu."id" = $2`,
          [iv.recruiterId, iv.candidateId],
        );
        const e = emails.rows[0];
        if (e?.email) {
          sendNewMessage({
            receiverEmail: e.email,
            senderName: e.cName ?? "Кандидат",
            preview: `Кандидат подтвердил время интервью: ${slot.value}`,
          });
        }
      } catch {/**/}
    })();

    return ok(res, { ...r.rows[0], slots: safeParseJson(r.rows[0].proposedSlots, [] as string[]) });
  } catch (err: unknown) {
    return fail(res, 500, "interview_confirm_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/interviews/:id/cancel
interviewsRouter.patch("/:id/cancel", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "recruiterId","candidateId" FROM "BuildInterview" WHERE "id" = $1 LIMIT 1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "interview_not_found");
    const iv = row.rows[0] as { recruiterId: string; candidateId: string };
    const isParty = iv.recruiterId === auth.sub || iv.candidateId === auth.sub || auth.role === "ADMIN";
    if (!isParty) return fail(res, 403, "forbidden");
    const r = await pool.query(`UPDATE "BuildInterview" SET "status" = 'CANCELED', "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`, [id]);
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "interview_cancel_failed", { details: (err as Error).message });
  }
});

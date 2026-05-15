import { Router } from "express";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vEnum,
} from "../../lib/build";

export const interviewsRouter = Router();

const INTERVIEW_STATUSES = ["PROPOSED", "CONFIRMED", "CANCELED", "COMPLETED"] as const;
const INTERVIEW_FORMATS = ["video", "phone", "in_person"] as const;

// Auto-create table on first use
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildInterview" (
      "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "applicationId"  TEXT NOT NULL,
      "vacancyId"      TEXT NOT NULL,
      "recruiterId"    TEXT NOT NULL,
      "candidateId"    TEXT NOT NULL,
      "title"          TEXT NOT NULL DEFAULT 'Интервью',
      "proposedSlots"  JSONB NOT NULL DEFAULT '[]',
      "confirmedSlot"  TIMESTAMPTZ,
      "format"         TEXT NOT NULL DEFAULT 'video',
      "location"       TEXT,
      "notes"          TEXT,
      "status"         TEXT NOT NULL DEFAULT 'PROPOSED',
      "canceledBy"     TEXT,
      "cancelReason"   TEXT,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_bi_app ON "BuildInterview" ("applicationId");
    CREATE INDEX IF NOT EXISTS idx_bi_rec ON "BuildInterview" ("recruiterId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS idx_bi_can ON "BuildInterview" ("candidateId", "createdAt" DESC);
  `);
  tableReady = true;
}

// POST /api/build/interviews — recruiter proposes interview
interviewsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 64 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);

    const title = vString(req.body?.title ?? "Интервью", "title", { min: 1, max: 120 });
    if (!title.ok) return fail(res, 400, title.error);

    const formatVal = vEnum(req.body?.format ?? "video", "format", INTERVIEW_FORMATS);
    if (!formatVal.ok) return fail(res, 400, formatVal.error);

    const slotsRaw = req.body?.proposedSlots;
    if (!Array.isArray(slotsRaw) || slotsRaw.length === 0 || slotsRaw.length > 5) {
      return fail(res, 400, "proposedSlots_required_1_to_5");
    }
    const slots = slotsRaw.map((s: unknown) => {
      const d = new Date(String(s));
      if (isNaN(d.getTime())) throw new Error("invalid_slot_date");
      return d.toISOString();
    });

    // Verify application exists + get candidate
    const appRow = await pool.query(
      `SELECT a."userId" AS "candidateId", a."vacancyId",
              v."title" AS "vacancyTitle", v."clientId" AS "clientId"
       FROM "BuildApplication" a
       JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       WHERE a."id" = $1 LIMIT 1`,
      [applicationId.value],
    );
    if (!appRow.rows[0]) return fail(res, 404, "application_not_found");

    const { candidateId, vacancyId, clientId } = appRow.rows[0];
    if (auth.sub !== clientId) return fail(res, 403, "only_vacancy_owner_can_propose");

    const r = await pool.query(
      `INSERT INTO "BuildInterview"
         ("applicationId","vacancyId","recruiterId","candidateId","title","proposedSlots","format","location","notes")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING "id","status","createdAt"`,
      [
        applicationId.value, vacancyId, auth.sub, candidateId,
        title.value, JSON.stringify(slots), formatVal.value,
        (req.body?.location ?? null),
        (req.body?.notes ?? null),
      ],
    );
    return ok(res, { interview: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "create_interview_failed");
  }
});

// GET /api/build/interviews/my — list my interviews (as recruiter or candidate)
interviewsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
    const params: unknown[] = [auth.sub, auth.sub];
    let where = `("recruiterId" = $1 OR "candidateId" = $2)`;
    if (statusFilter) { params.push(statusFilter); where += ` AND "status" = $${params.length}`; }
    params.push(50);

    const rows = await pool.query(
      `SELECT "id","applicationId","vacancyId","recruiterId","candidateId","title",
              "proposedSlots","confirmedSlot","format","location","notes",
              "status","canceledBy","cancelReason","createdAt","updatedAt"
       FROM "BuildInterview" WHERE ${where}
       ORDER BY COALESCE("confirmedSlot", "createdAt") DESC
       LIMIT $${params.length}`,
      params,
    );

    return ok(res, { interviews: rows.rows, total: rows.rowCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "list_interviews_failed");
  }
});

// GET /api/build/interviews/by-application/:id — interviews for an application
interviewsRouter.get("/by-application/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const rows = await pool.query(
      `SELECT "id","applicationId","vacancyId","recruiterId","candidateId","title",
              "proposedSlots","confirmedSlot","format","location","notes",
              "status","canceledBy","cancelReason","createdAt","updatedAt"
       FROM "BuildInterview"
       WHERE "applicationId" = $1
         AND ("recruiterId" = $2 OR "candidateId" = $2)
       ORDER BY "createdAt" DESC`,
      [req.params.id, auth.sub],
    );
    return ok(res, { interviews: rows.rows });
  } catch (err: unknown) {
    return fail(res, 500, "get_interviews_failed");
  }
});

// PATCH /api/build/interviews/:id/confirm — candidate confirms a slot
interviewsRouter.patch("/:id/confirm", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const slotRaw = req.body?.slot;
    if (!slotRaw) return fail(res, 400, "slot_required");
    const slot = new Date(String(slotRaw));
    if (isNaN(slot.getTime())) return fail(res, 400, "invalid_slot_date");

    const r = await pool.query(
      `UPDATE "BuildInterview"
       SET "status" = 'CONFIRMED', "confirmedSlot" = $1, "updatedAt" = NOW()
       WHERE "id" = $2 AND "candidateId" = $3 AND "status" = 'PROPOSED'
         AND "proposedSlots" @> $4::jsonb
       RETURNING "id","confirmedSlot","status"`,
      [slot.toISOString(), req.params.id, auth.sub, JSON.stringify([slot.toISOString()])],
    );
    if ((r.rowCount ?? 0) === 0) return fail(res, 404, "interview_not_found_or_slot_invalid");
    return ok(res, { interview: r.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "confirm_interview_failed");
  }
});

// PATCH /api/build/interviews/:id/cancel — either party cancels
interviewsRouter.patch("/:id/cancel", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const reason = vString(req.body?.reason ?? "", "reason", { min: 0, max: 500 });
    if (!reason.ok) return fail(res, 400, reason.error);

    const r = await pool.query(
      `UPDATE "BuildInterview"
       SET "status" = 'CANCELED', "canceledBy" = $1, "cancelReason" = $2, "updatedAt" = NOW()
       WHERE "id" = $3
         AND ("recruiterId" = $1 OR "candidateId" = $1)
         AND "status" IN ('PROPOSED','CONFIRMED')
       RETURNING "id","status"`,
      [auth.sub, reason.value || null, req.params.id],
    );
    if ((r.rowCount ?? 0) === 0) return fail(res, 404, "interview_not_found_or_not_cancelable");
    return ok(res, { interview: r.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "cancel_interview_failed");
  }
});

// PATCH /api/build/interviews/:id/complete — recruiter marks completed
interviewsRouter.patch("/:id/complete", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const r = await pool.query(
      `UPDATE "BuildInterview"
       SET "status" = 'COMPLETED', "updatedAt" = NOW()
       WHERE "id" = $1 AND "recruiterId" = $2 AND "status" = 'CONFIRMED'
       RETURNING "id","status"`,
      [req.params.id, auth.sub],
    );
    if ((r.rowCount ?? 0) === 0) return fail(res, 404, "interview_not_found_or_not_confirmed");
    return ok(res, { interview: r.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "complete_interview_failed");
  }
});

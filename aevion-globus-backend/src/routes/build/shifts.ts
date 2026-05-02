import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const shiftsRouter = Router();

// POST /api/build/shifts — client creates a shift for a hired worker
shiftsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 100 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);

    // Verify the application is ACCEPTED and caller is the client
    const appRow = await pool.query(
      `SELECT a."userId" AS "workerId", p."clientId"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 AND a."status" = 'ACCEPTED' LIMIT 1`,
      [applicationId.value],
    );
    if (appRow.rowCount === 0) return fail(res, 404, "accepted_application_not_found");
    if (appRow.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_client_can_schedule");

    const shiftDate = vString(req.body?.shiftDate, "shiftDate", { min: 1, max: 32 });
    if (!shiftDate.ok) return fail(res, 400, shiftDate.error);
    const startTime = req.body?.startTime == null ? null : String(req.body.startTime).trim().slice(0, 10);
    const endTime = req.body?.endTime == null ? null : String(req.body.endTime).trim().slice(0, 10);
    const notes = req.body?.notes == null ? null : String(req.body.notes).trim().slice(0, 500) || null;

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildShift" ("id","applicationId","workerId","clientId","shiftDate","startTime","endTime","notes")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, applicationId.value, appRow.rows[0].workerId, auth.sub, shiftDate.value, startTime, endTime, notes],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "shift_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/shifts/my — worker or client sees their shifts
shiftsRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const from = typeof req.query.from === "string" ? req.query.from.trim() : null;
    const params: unknown[] = [auth.sub, auth.sub];
    let timeCond = "";
    if (from) { params.push(from); timeCond = `AND s."shiftDate" >= $${params.length}`; }

    const result = await pool.query(
      `SELECT s.*,
              uw."name" AS "workerName",
              uc."name" AS "clientName"
       FROM "BuildShift" s
       LEFT JOIN "AEVIONUser" uw ON uw."id" = s."workerId"
       LEFT JOIN "AEVIONUser" uc ON uc."id" = s."clientId"
       WHERE (s."workerId" = $1 OR s."clientId" = $2) ${timeCond}
       ORDER BY s."shiftDate" ASC, s."startTime" ASC`,
      params,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "shifts_my_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/shifts/:id/checkin — worker checks in
shiftsRouter.patch("/:id/checkin", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const shift = await pool.query(`SELECT * FROM "BuildShift" WHERE "id" = $1 LIMIT 1`, [id]);
    if (shift.rowCount === 0) return fail(res, 404, "shift_not_found");
    if (shift.rows[0].workerId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_worker_can_checkin");
    if (shift.rows[0].checkInAt) return fail(res, 409, "already_checked_in");

    const lat = typeof req.body?.lat === "number" ? req.body.lat : null;
    const lng = typeof req.body?.lng === "number" ? req.body.lng : null;
    const geoNote = lat != null && lng != null ? `GPS: ${lat.toFixed(5)},${lng.toFixed(5)}` : null;

    const result = await pool.query(
      `UPDATE "BuildShift"
         SET "checkInAt" = NOW(), "status" = 'STARTED',
             "notes" = COALESCE($2, "notes"), "updatedAt" = NOW()
       WHERE "id" = $1 RETURNING *`,
      [id, geoNote],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "shift_checkin_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/shifts/:id/checkout — worker checks out
shiftsRouter.patch("/:id/checkout", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const shift = await pool.query(`SELECT * FROM "BuildShift" WHERE "id" = $1 LIMIT 1`, [id]);
    if (shift.rowCount === 0) return fail(res, 404, "shift_not_found");
    if (shift.rows[0].workerId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_worker_can_checkout");
    if (!shift.rows[0].checkInAt) return fail(res, 400, "not_checked_in_yet");
    if (shift.rows[0].checkOutAt) return fail(res, 409, "already_checked_out");

    const result = await pool.query(
      `UPDATE "BuildShift" SET "checkOutAt" = NOW(), "status" = 'DONE', "updatedAt" = NOW()
       WHERE "id" = $1 RETURNING *`,
      [id],
    );
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "shift_checkout_failed", { details: (err as Error).message });
  }
});

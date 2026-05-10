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
} from "../../lib/build";

export const paymentCalendarRouter = Router();

// Payment calendar: lightweight ledger of expected payouts between
// client and worker on an accepted application. Replaces the HH-style
// "we'll figure out wages later" black hole with a concrete schedule
// both sides can see and check off.

const STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELED"] as const;

// POST /api/build/payment-calendar — client adds a planned payment.
// Body: { applicationId, amount, currency?, dueDate (YYYY-MM-DD), note? }
paymentCalendarRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const applicationId = vString(req.body?.applicationId, "applicationId", { min: 1, max: 100 });
    if (!applicationId.ok) return fail(res, 400, applicationId.error);
    const amount = vNumber(req.body?.amount, "amount", { min: 0 });
    if (!amount.ok) return fail(res, 400, amount.error);
    const dueDate = vString(req.body?.dueDate, "dueDate", { min: 4, max: 32 });
    if (!dueDate.ok) return fail(res, 400, dueDate.error);
    const currency = (typeof req.body?.currency === "string" ? req.body.currency : "RUB").toUpperCase().slice(0, 8);
    const note = req.body?.note == null ? null : String(req.body.note).trim().slice(0, 500) || null;

    // Resolve clientId/workerId from the application.
    const app = await pool.query(
      `SELECT a."userId" AS "workerId", p."clientId"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE a."id" = $1 AND a."status" = 'ACCEPTED' LIMIT 1`,
      [applicationId.value],
    );
    if (app.rowCount === 0) return fail(res, 404, "accepted_application_not_found");
    const { workerId, clientId } = app.rows[0] as { workerId: string; clientId: string };
    if (clientId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_client_can_schedule");
    }

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildPaymentEvent"
         ("id","applicationId","clientId","workerId","amount","currency","dueDate","note")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, applicationId.value, clientId, workerId, amount.value, currency, dueDate.value, note],
    );
    return ok(res, r.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "payment_event_create_failed", { details: (err as Error).message });
  }
});

// GET /api/build/payment-calendar/my — caller sees both sides.
paymentCalendarRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const from = typeof req.query.from === "string" ? req.query.from : null;
    const to = typeof req.query.to === "string" ? req.query.to : null;

    const params: unknown[] = [auth.sub, auth.sub];
    let where = `"clientId" = $1 OR "workerId" = $2`;
    if (from) {
      params.push(from);
      where = `(${where}) AND "dueDate" >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where = `(${where}) AND "dueDate" <= $${params.length}`;
    }
    const r = await pool.query(
      `SELECT * FROM "BuildPaymentEvent" WHERE ${where} ORDER BY "dueDate" ASC LIMIT 500`,
      params,
    );

    // Roll up totals so the UI can show "due this month" without doing math.
    let due = 0;
    let paid = 0;
    let overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const row of r.rows as Array<{ status: string; amount: number; dueDate: string }>) {
      if (row.status === "PAID") paid += Number(row.amount);
      else if (row.status === "PENDING" && row.dueDate < today) overdue += Number(row.amount);
      else if (row.status === "PENDING") due += Number(row.amount);
    }

    return ok(res, {
      items: r.rows,
      total: r.rowCount,
      summary: { due, paid, overdue },
    });
  } catch (err: unknown) {
    return fail(res, 500, "payment_calendar_my_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/payment-calendar/:id — update status / note.
paymentCalendarRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);

    const row = await pool.query(`SELECT * FROM "BuildPaymentEvent" WHERE "id" = $1 LIMIT 1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "payment_event_not_found");
    const ev = row.rows[0] as { clientId: string; workerId: string; status: string };
    const isParty = ev.clientId === auth.sub || ev.workerId === auth.sub || auth.role === "ADMIN";
    if (!isParty) return fail(res, 403, "forbidden");

    let nextStatus: string | null = null;
    if (typeof req.body?.status === "string") {
      const e = vEnum(req.body.status, "status", STATUSES);
      if (!e.ok) return fail(res, 400, e.error);
      nextStatus = e.value;
      // Workers can mark PAID confirming receipt; only client can CANCEL.
      if (e.value === "CANCELED" && ev.clientId !== auth.sub && auth.role !== "ADMIN") {
        return fail(res, 403, "only_client_can_cancel");
      }
    }
    const note = req.body?.note == null ? undefined : String(req.body.note).trim().slice(0, 500) || null;

    const sets: string[] = [];
    const params: unknown[] = [];
    if (nextStatus) {
      params.push(nextStatus);
      sets.push(`"status" = $${params.length}`);
      if (nextStatus === "PAID") {
        sets.push(`"paidAt" = NOW()`);
      }
    }
    if (note !== undefined) {
      params.push(note);
      sets.push(`"note" = $${params.length}`);
    }
    if (sets.length === 0) return fail(res, 400, "no_changes");

    params.push(id);
    const r = await pool.query(
      `UPDATE "BuildPaymentEvent" SET ${sets.join(", ")} WHERE "id" = $${params.length} RETURNING *`,
      params,
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "payment_event_update_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/payment-calendar/:id — client only.
paymentCalendarRouter.delete("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "clientId" FROM "BuildPaymentEvent" WHERE "id" = $1 LIMIT 1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "payment_event_not_found");
    if (row.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "forbidden");
    await pool.query(`DELETE FROM "BuildPaymentEvent" WHERE "id" = $1`, [id]);
    return ok(res, { ok: true });
  } catch (err: unknown) {
    return fail(res, 500, "payment_event_delete_failed", { details: (err as Error).message });
  }
});

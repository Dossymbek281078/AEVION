import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  safeParseJson,
} from "../../lib/build";

export const safetyBriefingRouter = Router();

// Default checklist — used by the frontend modal when the client has
// not customised the briefing for the project. Stored on the briefing
// row as items (JSON) so a future audit can prove what the worker
// actually signed off on.
export const DEFAULT_SAFETY_ITEMS = [
  "Каска, очки и сигнальный жилет надеты до входа на объект.",
  "Я знаю, где находится аптечка и эвакуационный выход.",
  "Я ознакомлен с расположением опасных зон (кран, котлован, монтаж высотой).",
  "У меня есть страховочный пояс при работе на высоте >1.8 м.",
  "Электроинструмент проверен на исправность до старта смены.",
  "Я не нахожусь в состоянии алкогольного / наркотического опьянения.",
  "В случае травмы немедленно сообщаю прорабу или в скорую (103).",
];

// GET /api/build/safety-briefing/template — public default checklist.
safetyBriefingRouter.get("/template", (_req, res) => {
  return ok(res, { items: DEFAULT_SAFETY_ITEMS });
});

// POST /api/build/safety-briefing — worker signs off pre-shift.
// Body: { shiftId, items: string[] }
safetyBriefingRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const shiftId = vString(req.body?.shiftId, "shiftId", { min: 1, max: 100 });
    if (!shiftId.ok) return fail(res, 400, shiftId.error);

    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : null;
    const items =
      itemsRaw && itemsRaw.length > 0
        ? itemsRaw.map((s: unknown) => String(s).slice(0, 300)).slice(0, 30)
        : DEFAULT_SAFETY_ITEMS;

    const shift = await pool.query(
      `SELECT "workerId" FROM "BuildShift" WHERE "id" = $1 LIMIT 1`,
      [shiftId.value],
    );
    if (shift.rowCount === 0) return fail(res, 404, "shift_not_found");
    if (shift.rows[0].workerId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_worker_can_sign");
    }

    const id = crypto.randomUUID();
    try {
      const r = await pool.query(
        `INSERT INTO "BuildSafetyBriefing" ("id","shiftId","workerId","items")
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, shiftId.value, auth.sub, JSON.stringify(items)],
      );
      return ok(res, r.rows[0], 201);
    } catch (err: unknown) {
      // Unique violation on (shiftId, workerId) — already signed.
      if ((err as { code?: string }).code === "23505") {
        const existing = await pool.query(
          `SELECT * FROM "BuildSafetyBriefing" WHERE "shiftId" = $1 AND "workerId" = $2 LIMIT 1`,
          [shiftId.value, auth.sub],
        );
        return ok(res, existing.rows[0]);
      }
      throw err;
    }
  } catch (err: unknown) {
    return fail(res, 500, "safety_briefing_failed", { details: (err as Error).message });
  }
});

// GET /api/build/safety-briefing/shift/:id — list briefings for a shift
safetyBriefingRouter.get("/shift/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const shiftId = String(req.params.id);

    const shift = await pool.query(
      `SELECT "workerId","clientId" FROM "BuildShift" WHERE "id" = $1 LIMIT 1`,
      [shiftId],
    );
    if (shift.rowCount === 0) return fail(res, 404, "shift_not_found");
    const isParty =
      shift.rows[0].workerId === auth.sub ||
      shift.rows[0].clientId === auth.sub ||
      auth.role === "ADMIN";
    if (!isParty) return fail(res, 403, "forbidden");

    const r = await pool.query(
      `SELECT * FROM "BuildSafetyBriefing" WHERE "shiftId" = $1 ORDER BY "signedAt" DESC`,
      [shiftId],
    );
    const items = r.rows.map((row: Record<string, unknown>) => ({
      ...row,
      items: safeParseJson(row.items, [] as string[]),
    }));
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "safety_briefing_list_failed", { details: (err as Error).message });
  }
});

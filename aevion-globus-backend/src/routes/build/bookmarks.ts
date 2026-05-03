import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, vEnum, safeParseJson, BOOKMARK_KINDS } from "../../lib/build";

export const bookmarksRouter = Router();

// POST /api/build/bookmarks — toggle
bookmarksRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const kind = vEnum(req.body?.kind, "kind", BOOKMARK_KINDS);
    if (!kind.ok) return fail(res, 400, kind.error);
    const targetId = vString(req.body?.targetId, "targetId", { min: 1, max: 200 });
    if (!targetId.ok) return fail(res, 400, targetId.error);
    const note = req.body?.note == null ? null : String(req.body.note).trim().slice(0, 500) || null;

    const existing = await pool.query(
      `SELECT "id" FROM "BuildBookmark" WHERE "userId" = $1 AND "kind" = $2 AND "targetId" = $3 LIMIT 1`,
      [auth.sub, kind.value, targetId.value],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await pool.query(`DELETE FROM "BuildBookmark" WHERE "id" = $1`, [existing.rows[0].id]);
      return ok(res, { saved: false, removed: existing.rows[0].id });
    }

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildBookmark" ("id","userId","kind","targetId","note") VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, auth.sub, kind.value, targetId.value, note],
    );
    return ok(res, { saved: true, bookmark: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "bookmark_toggle_failed", { details: (err as Error).message });
  }
});

// GET /api/build/bookmarks — hydrated list
bookmarksRouter.get("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const kindFilter = typeof req.query.kind === "string" ? vEnum(req.query.kind, "kind", BOOKMARK_KINDS) : null;
    if (kindFilter && !kindFilter.ok) return fail(res, 400, kindFilter.error);

    const params: unknown[] = [auth.sub];
    let where = `"userId" = $1`;
    if (kindFilter && kindFilter.ok) {
      params.push(kindFilter.value);
      where += ` AND "kind" = $${params.length}`;
    }
    const rows = await pool.query(
      `SELECT * FROM "BuildBookmark" WHERE ${where} ORDER BY "createdAt" DESC LIMIT 200`,
      params,
    );

    const vacancyIds = (rows.rows as Array<{ kind: string; targetId: string }>).filter((r) => r.kind === "VACANCY").map((r) => r.targetId);
    const candidateIds = (rows.rows as Array<{ kind: string; targetId: string }>).filter((r) => r.kind === "CANDIDATE").map((r) => r.targetId);

    const [vacanciesQ, candidatesQ] = await Promise.all([
      vacancyIds.length
        ? pool.query(
            `SELECT v."id", v."title", v."salary", v."status", v."createdAt",
                    p."title" AS "projectTitle", p."city" AS "projectCity",
                    (SELECT MAX(b."endsAt") FROM "BuildBoost" b WHERE b."vacancyId" = v."id" AND b."endsAt" > NOW()) AS "boostUntil"
             FROM "BuildVacancy" v LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
             WHERE v."id" = ANY($1::text[])`,
            [vacancyIds],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      candidateIds.length
        ? pool.query(
            `SELECT p."userId", p."name", p."city", p."buildRole",
                    p."title", p."skillsJson", p."experienceYears", p."photoUrl", p."openToWork", p."verifiedAt"
             FROM "BuildProfile" p WHERE p."userId" = ANY($1::text[])`,
            [candidateIds],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);

    const vacancyMap = new Map<string, Record<string, unknown>>(vacanciesQ.rows.map((r: Record<string, unknown>) => [String(r.id), r]));
    const candidateMap = new Map<string, Record<string, unknown>>(
      candidatesQ.rows.map((r: Record<string, unknown>) => [String(r.userId), { ...r, skills: safeParseJson(r.skillsJson, [] as string[]) }]),
    );

    const items = rows.rows.map((r: Record<string, unknown>) => ({
      ...r,
      target: r.kind === "VACANCY" ? vacancyMap.get(String(r.targetId)) ?? null : candidateMap.get(String(r.targetId)) ?? null,
    }));

    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "bookmarks_list_failed", { details: (err as Error).message });
  }
});

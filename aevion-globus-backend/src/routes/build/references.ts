/**
 * QBuild References — post-project employer references for workers.
 *
 * After a project is DONE, CLIENT can write a reference for a WORKER
 * (or CONTRACTOR) who worked on it. Visible on the worker's public profile.
 *
 * Routes:
 *   POST /api/build/projects/:id/references        create reference (CLIENT only, project DONE)
 *   GET  /api/build/projects/:id/references        list references for project (public)
 *   GET  /api/build/worker-references/:userId      all references for a worker (public)
 *   GET  /api/build/references/my                  references I gave (as a client)
 *   DELETE /api/build/references/:id               revoke reference (only author, within 7 days)
 */

import { Router } from "express";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
} from "../../lib/build";

export const referencesRouter = Router();

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildReference" (
      "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId"   TEXT NOT NULL,
      "authorId"    TEXT NOT NULL,       -- client who writes
      "workerId"    TEXT NOT NULL,       -- worker being referenced
      "rating"      INT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
      "text"        TEXT NOT NULL,
      "skills"      TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
      "recommend"   BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_bref_project ON "BuildReference" ("projectId");
    CREATE INDEX IF NOT EXISTS idx_bref_worker  ON "BuildReference" ("workerId");
    CREATE INDEX IF NOT EXISTS idx_bref_author  ON "BuildReference" ("authorId");
  `);
  tableReady = true;
}

// POST /api/build/projects/:id/references — client writes a reference for a worker
referencesRouter.post("/projects/:id/references", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const projectId = req.params.id;
    const proj = await pool.query(
      `SELECT "id","clientId","status" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
      [projectId],
    );
    if (!proj.rows[0]) return fail(res, 404, "project_not_found");
    if (proj.rows[0].clientId !== auth.sub) return fail(res, 403, "only_project_owner_can_write_reference");

    const workerId = vString(req.body?.workerId, "workerId", { min: 1, max: 200 });
    if (!workerId.ok) return fail(res, 400, workerId.error);

    const text = vString(req.body?.text, "text", { min: 20, max: 2000 });
    if (!text.ok) return fail(res, 400, text.error);

    const ratingVal = vNumber(req.body?.rating, "rating", { min: 1, max: 5 });
    if (!ratingVal.ok) return fail(res, 400, ratingVal.error);
    const rating = Math.round(ratingVal.value);

    const skills = Array.isArray(req.body?.skills)
      ? JSON.stringify(req.body.skills.map((s: unknown) => String(s).trim()).slice(0, 10))
      : "[]";
    const recommend = req.body?.recommend !== false;

    // One reference per (author, worker, project)
    const existing = await pool.query(
      `SELECT "id" FROM "BuildReference" WHERE "projectId"=$1 AND "authorId"=$2 AND "workerId"=$3 LIMIT 1`,
      [projectId, auth.sub, workerId.value],
    );
    if (existing.rows[0]) return fail(res, 409, "reference_already_written");

    const r = await pool.query(
      `INSERT INTO "BuildReference" ("projectId","authorId","workerId","rating","text","skills","recommend")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [projectId, auth.sub, workerId.value, rating, text.value.trim(), skills, recommend],
    );
    return ok(res, { reference: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "create_reference_failed", { details: (err as Error).message });
  }
});

// GET /api/build/projects/:id/references — list references for a project (public)
referencesRouter.get("/projects/:id/references", async (req, res) => {
  try {
    await ensureTable();
    const rows = await pool.query(
      `SELECT r."id", r."workerId", r."authorId", r."rating", r."text",
              r."skills", r."recommend", r."createdAt",
              wp."name" AS "workerName", wp."title" AS "workerTitle", wp."photoUrl" AS "workerPhoto",
              ap."name" AS "authorName"
       FROM "BuildReference" r
       LEFT JOIN "BuildProfile" wp ON wp."userId" = r."workerId"
       LEFT JOIN "BuildProfile" ap ON ap."userId" = r."authorId"
       WHERE r."projectId" = $1
       ORDER BY r."createdAt" DESC`,
      [req.params.id],
    );
    return ok(res, {
      references: rows.rows.map((r: Record<string, unknown>) => ({
        ...r,
        skills: (() => { try { return JSON.parse(r.skills as string); } catch { return []; } })(),
      })),
    });
  } catch (err: unknown) {
    return fail(res, 500, "get_references_failed", { details: (err as Error).message });
  }
});

// GET /api/build/worker-references/:userId — all references for a worker (public profile)
referencesRouter.get("/worker-references/:userId", async (req, res) => {
  try {
    await ensureTable();
    const rows = await pool.query(
      `SELECT r."id", r."projectId", r."authorId", r."rating", r."text",
              r."skills", r."recommend", r."createdAt",
              p."title" AS "projectTitle",
              ap."name" AS "authorName", ap."photoUrl" AS "authorPhoto"
       FROM "BuildReference" r
       LEFT JOIN "BuildProject" p ON p."id" = r."projectId"
       LEFT JOIN "BuildProfile" ap ON ap."userId" = r."authorId"
       WHERE r."workerId" = $1
       ORDER BY r."createdAt" DESC
       LIMIT 50`,
      [req.params.userId],
    );
    const refs = rows.rows.map((r: Record<string, unknown>) => ({
      ...r,
      skills: (() => { try { return JSON.parse(r.skills as string); } catch { return []; } })(),
    }));
    const avg = refs.length
      ? refs.reduce((s: number, r: Record<string, unknown>) => s + (r.rating as number), 0) / refs.length
      : null;
    return ok(res, { references: refs, total: refs.length, avgRating: avg ? parseFloat(avg.toFixed(2)) : null });
  } catch (err: unknown) {
    return fail(res, 500, "get_worker_references_failed", { details: (err as Error).message });
  }
});

// GET /api/build/references/my — references I wrote as a client
referencesRouter.get("/references/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const rows = await pool.query(
      `SELECT r."id", r."projectId", r."workerId", r."rating", r."text",
              r."recommend", r."createdAt",
              p."title" AS "projectTitle",
              wp."name" AS "workerName"
       FROM "BuildReference" r
       LEFT JOIN "BuildProject" p ON p."id" = r."projectId"
       LEFT JOIN "BuildProfile" wp ON wp."userId" = r."workerId"
       WHERE r."authorId" = $1
       ORDER BY r."createdAt" DESC
       LIMIT 50`,
      [auth.sub],
    );
    return ok(res, { references: rows.rows, total: rows.rowCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "get_my_references_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/references/:id — revoke within 7 days
referencesRouter.delete("/references/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const r = await pool.query(
      `DELETE FROM "BuildReference"
       WHERE "id"=$1 AND "authorId"=$2
         AND "createdAt" > NOW() - INTERVAL '7 days'
       RETURNING "id"`,
      [req.params.id, auth.sub],
    );
    if ((r.rowCount ?? 0) === 0) return fail(res, 404, "reference_not_found_or_too_old");
    return ok(res, { deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "delete_reference_failed", { details: (err as Error).message });
  }
});

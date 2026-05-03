import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
} from "../../lib/build";

export const storiesRouter = Router();

// Site stories: short text + optional photo/video, posted by workers
// from the job-site. Doubles as a recruiter signal ("this person actually
// works") and as marketing content for the platform feed.

// GET /api/build/stories — public feed, paginated.
storiesRouter.get("/", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 20;
    const beforeIso = typeof req.query.before === "string" ? req.query.before : null;

    const params: unknown[] = [];
    let where = "";
    if (beforeIso) {
      params.push(beforeIso);
      where = `WHERE s."createdAt" < $${params.length}`;
    }
    params.push(limit);

    const r = await pool.query(
      `SELECT s.*,
              p."name" AS "userName",
              p."photoUrl" AS "userPhoto",
              p."city" AS "userCity",
              proj."title" AS "projectTitle"
       FROM "BuildStory" s
       LEFT JOIN "BuildProfile" p ON p."userId" = s."userId"
       LEFT JOIN "BuildProject" proj ON proj."id" = s."projectId"
       ${where}
       ORDER BY s."createdAt" DESC
       LIMIT $${params.length}`,
      params,
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "stories_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/stories/by-user/:id — public profile feed
storiesRouter.get("/by-user/:id", async (req, res) => {
  try {
    const userId = String(req.params.id);
    const r = await pool.query(
      `SELECT * FROM "BuildStory" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [userId],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "stories_user_failed", { details: (err as Error).message });
  }
});

// POST /api/build/stories — create a story.
storiesRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const content = vString(req.body?.content, "content", { min: 3, max: 1500 });
    if (!content.ok) return fail(res, 400, content.error);

    const projectId = req.body?.projectId == null ? null : String(req.body.projectId).slice(0, 100);
    const mediaUrl = req.body?.mediaUrl == null ? null : String(req.body.mediaUrl).slice(0, 1000);
    const mediaTypeRaw = req.body?.mediaType == null ? null : String(req.body.mediaType).toLowerCase();
    const mediaType =
      mediaTypeRaw === "image" || mediaTypeRaw === "video" ? mediaTypeRaw : null;

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildStory" ("id","userId","projectId","content","mediaUrl","mediaType")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, auth.sub, projectId, content.value, mediaUrl, mediaType],
    );
    return ok(res, r.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "story_create_failed", { details: (err as Error).message });
  }
});

// POST /api/build/stories/:id/like — toggle like.
storiesRouter.post("/:id/like", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const storyId = String(req.params.id);

    const story = await pool.query(`SELECT "id" FROM "BuildStory" WHERE "id" = $1 LIMIT 1`, [storyId]);
    if (story.rowCount === 0) return fail(res, 404, "story_not_found");

    const existing = await pool.query(
      `SELECT 1 FROM "BuildStoryLike" WHERE "storyId" = $1 AND "userId" = $2`,
      [storyId, auth.sub],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await pool.query(
        `DELETE FROM "BuildStoryLike" WHERE "storyId" = $1 AND "userId" = $2`,
        [storyId, auth.sub],
      );
      const upd = await pool.query(
        `UPDATE "BuildStory" SET "likeCount" = GREATEST("likeCount" - 1, 0) WHERE "id" = $1 RETURNING "likeCount"`,
        [storyId],
      );
      return ok(res, { liked: false, likeCount: upd.rows[0]?.likeCount ?? 0 });
    }

    await pool.query(
      `INSERT INTO "BuildStoryLike" ("storyId","userId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [storyId, auth.sub],
    );
    const upd = await pool.query(
      `UPDATE "BuildStory" SET "likeCount" = "likeCount" + 1 WHERE "id" = $1 RETURNING "likeCount"`,
      [storyId],
    );
    return ok(res, { liked: true, likeCount: upd.rows[0]?.likeCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "story_like_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/stories/:id — author or admin only.
storiesRouter.delete("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const storyId = String(req.params.id);
    const r = await pool.query(`SELECT "userId" FROM "BuildStory" WHERE "id" = $1 LIMIT 1`, [storyId]);
    if (r.rowCount === 0) return fail(res, 404, "story_not_found");
    if (r.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "forbidden");
    await pool.query(`DELETE FROM "BuildStoryLike" WHERE "storyId" = $1`, [storyId]);
    await pool.query(`DELETE FROM "BuildStory" WHERE "id" = $1`, [storyId]);
    return ok(res, { ok: true });
  } catch (err: unknown) {
    return fail(res, 500, "story_delete_failed", { details: (err as Error).message });
  }
});

import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
  vNumber,
} from "../../lib/build";

export const reviewsRouter = Router();

const reviewPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "review_rate_limit_exceeded" },
});

type ReviewDirection = "CLIENT_TO_WORKER" | "WORKER_TO_CLIENT";

async function resolveReviewDirection(
  projectId: string,
  reviewerId: string,
  revieweeId: string,
): Promise<{ direction: ReviewDirection } | { error: string }> {
  const proj = await pool.query(
    `SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`,
    [projectId],
  );
  if (proj.rowCount === 0) return { error: "project_not_found" };
  const clientId = proj.rows[0].clientId as string;

  const reviewerIsClient = reviewerId === clientId;
  const revieweeIsClient = revieweeId === clientId;
  if (reviewerIsClient && revieweeIsClient) return { error: "self_review_forbidden" };

  const workerCandidate = reviewerIsClient ? revieweeId : reviewerIsClient ? null : reviewerId;
  const workerId = reviewerIsClient ? revieweeId : reviewerId;
  if (!reviewerIsClient && !revieweeIsClient) return { error: "neither_party_is_client" };
  if (!workerId) return { error: "worker_id_unresolved" };

  const accepted = await pool.query(
    `SELECT 1
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
      WHERE v."projectId" = $1 AND a."userId" = $2 AND a."status" = 'ACCEPTED'
      LIMIT 1`,
    [projectId, workerId],
  );
  if (accepted.rowCount === 0) return { error: "not_accepted_on_project" };

  void workerCandidate;
  return { direction: reviewerIsClient ? "CLIENT_TO_WORKER" : "WORKER_TO_CLIENT" };
}

// POST /api/build/reviews
reviewsRouter.post("/", reviewPostLimiter, async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 100 });
    if (!projectId.ok) return fail(res, 400, projectId.error);
    const revieweeId = vString(req.body?.revieweeId, "revieweeId", { min: 1, max: 100 });
    if (!revieweeId.ok) return fail(res, 400, revieweeId.error);
    if (revieweeId.value === auth.sub) return fail(res, 400, "cannot_review_self");

    const rating = vNumber(req.body?.rating, "rating", { min: 1, max: 5 });
    if (!rating.ok) return fail(res, 400, rating.error);
    const ratingInt = Math.round(rating.value);

    const commentRaw = req.body?.comment;
    const comment =
      commentRaw == null
        ? null
        : (() => {
            const v = vString(commentRaw, "comment", { max: 2000, allowEmpty: true });
            return v.ok ? v.value || null : null;
          })();

    const eligibility = await resolveReviewDirection(projectId.value, auth.sub, revieweeId.value);
    if ("error" in eligibility) return fail(res, 403, eligibility.error);

    const id = crypto.randomUUID();
    try {
      const r = await pool.query(
        `INSERT INTO "BuildReview"
           ("id","projectId","reviewerId","revieweeId","direction","rating","comment")
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [id, projectId.value, auth.sub, revieweeId.value, eligibility.direction, ratingInt, comment],
      );
      return ok(res, r.rows[0], 201);
    } catch (innerErr: unknown) {
      const code = (innerErr as { code?: string })?.code;
      if (code === "23505") {
        return fail(res, 409, "already_reviewed", {
          details: "You have already reviewed this user on this project.",
        });
      }
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "review_submit_failed", { details: (err as Error).message });
  }
});

// GET /api/build/reviews/by-user/:userId
reviewsRouter.get("/by-user/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) return fail(res, 400, "userId_required");

    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const [list, agg] = await Promise.all([
      pool.query(
        `SELECT r."id", r."projectId", r."reviewerId", r."revieweeId",
                r."direction", r."rating", r."comment", r."createdAt",
                u."name" AS "reviewerName",
                p."title" AS "projectTitle"
           FROM "BuildReview" r
           LEFT JOIN "AEVIONUser" u ON u."id" = r."reviewerId"
           LEFT JOIN "BuildProject" p ON p."id" = r."projectId"
          WHERE r."revieweeId" = $1
          ORDER BY r."createdAt" DESC
          LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS "count",
                COALESCE(AVG("rating"),0)::float8 AS "avg"
           FROM "BuildReview" WHERE "revieweeId" = $1`,
        [userId],
      ),
    ]);

    return ok(res, {
      items: list.rows,
      total: Number(agg.rows[0]?.count ?? 0),
      avgRating: Number((Number(agg.rows[0]?.avg ?? 0)).toFixed(2)),
      limit,
      offset,
    });
  } catch (err: unknown) {
    return fail(res, 500, "reviews_by_user_failed", { details: (err as Error).message });
  }
});

// GET /api/build/reviews/by-project/:id
reviewsRouter.get("/by-project/:id", async (req, res) => {
  try {
    const projectId = String(req.params.id || "").trim();
    if (!projectId) return fail(res, 400, "projectId_required");

    const r = await pool.query(
      `SELECT r."id", r."projectId", r."reviewerId", r."revieweeId",
              r."direction", r."rating", r."comment", r."createdAt",
              ur."name" AS "reviewerName",
              ue."name" AS "revieweeName"
         FROM "BuildReview" r
         LEFT JOIN "AEVIONUser" ur ON ur."id" = r."reviewerId"
         LEFT JOIN "AEVIONUser" ue ON ue."id" = r."revieweeId"
        WHERE r."projectId" = $1
        ORDER BY r."createdAt" DESC`,
      [projectId],
    );
    return ok(res, { items: r.rows, total: r.rowCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "reviews_by_project_failed", { details: (err as Error).message });
  }
});

// GET /api/build/reviews/eligible
reviewsRouter.get("/eligible", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [asClient, asWorker] = await Promise.all([
      pool.query(
        `SELECT DISTINCT p."id" AS "projectId", p."title" AS "projectTitle",
                a."userId" AS "revieweeId",
                u."name" AS "revieweeName"
           FROM "BuildProject" p
           JOIN "BuildVacancy" v ON v."projectId" = p."id"
           JOIN "BuildApplication" a ON a."vacancyId" = v."id" AND a."status" = 'ACCEPTED'
           LEFT JOIN "AEVIONUser" u ON u."id" = a."userId"
           LEFT JOIN "BuildReview" r
             ON r."projectId" = p."id" AND r."reviewerId" = $1 AND r."revieweeId" = a."userId"
          WHERE p."clientId" = $1 AND r."id" IS NULL`,
        [auth.sub],
      ),
      pool.query(
        `SELECT DISTINCT p."id" AS "projectId", p."title" AS "projectTitle",
                p."clientId" AS "revieweeId",
                u."name" AS "revieweeName"
           FROM "BuildApplication" a
           JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
           JOIN "BuildProject" p ON p."id" = v."projectId"
           LEFT JOIN "AEVIONUser" u ON u."id" = p."clientId"
           LEFT JOIN "BuildReview" r
             ON r."projectId" = p."id" AND r."reviewerId" = $1 AND r."revieweeId" = p."clientId"
          WHERE a."userId" = $1 AND a."status" = 'ACCEPTED' AND r."id" IS NULL`,
        [auth.sub],
      ),
    ]);

    const items = [
      ...asClient.rows.map((row: Record<string, unknown>) => ({ ...row, direction: "CLIENT_TO_WORKER" as const })),
      ...asWorker.rows.map((row: Record<string, unknown>) => ({ ...row, direction: "WORKER_TO_CLIENT" as const })),
    ];
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "reviews_eligible_failed", { details: (err as Error).message });
  }
});

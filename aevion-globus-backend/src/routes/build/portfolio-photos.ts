import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const portfolioPhotosRouter = Router();

// POST /api/build/portfolio/photos — add a work photo
portfolioPhotosRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const url = vString(req.body?.url, "url", { min: 1, max: 2000 });
    if (!url.ok) return fail(res, 400, url.error);
    try { new URL(url.value); } catch { return fail(res, 400, "url_invalid"); }

    const caption = req.body?.caption == null ? null : String(req.body.caption).trim().slice(0, 300) || null;
    const projectType = req.body?.projectType == null ? null : String(req.body.projectType).trim().slice(0, 100) || null;
    const takenAt = req.body?.takenAt == null ? null : String(req.body.takenAt).trim().slice(0, 32) || null;

    // Cap at 30 photos per user
    const count = await pool.query(`SELECT COUNT(*) FROM "BuildPortfolioPhoto" WHERE "userId" = $1`, [auth.sub]);
    if (Number(count.rows[0].count) >= 30) return fail(res, 400, "portfolio_photo_limit_reached", { limit: 30 });

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildPortfolioPhoto" ("id","userId","url","caption","projectType","takenAt")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, auth.sub, url.value, caption, projectType, takenAt],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "portfolio_photo_add_failed", { details: (err as Error).message });
  }
});

// GET /api/build/portfolio/photos/:userId — public, sorted by sortOrder
portfolioPhotosRouter.get("/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const result = await pool.query(
      `SELECT * FROM "BuildPortfolioPhoto" WHERE "userId" = $1
       ORDER BY "sortOrder" ASC, "createdAt" DESC`,
      [userId],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "portfolio_photos_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/portfolio/photos/:id — owner only
portfolioPhotosRouter.delete("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildPortfolioPhoto" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "photo_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    await pool.query(`DELETE FROM "BuildPortfolioPhoto" WHERE "id" = $1`, [id]);
    return ok(res, { deleted: true });
  } catch (err: unknown) {
    return fail(res, 500, "portfolio_photo_delete_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/portfolio/photos/:id — update caption or sortOrder
portfolioPhotosRouter.patch("/:id", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const row = await pool.query(`SELECT "userId" FROM "BuildPortfolioPhoto" WHERE "id" = $1`, [id]);
    if (row.rowCount === 0) return fail(res, 404, "photo_not_found");
    if (row.rows[0].userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");

    const sets: string[] = [];
    const vals: unknown[] = [id];
    if (req.body?.caption !== undefined) { vals.push(req.body.caption == null ? null : String(req.body.caption).slice(0, 300)); sets.push(`"caption" = $${vals.length}`); }
    if (req.body?.projectType !== undefined) { vals.push(req.body.projectType == null ? null : String(req.body.projectType).slice(0, 100)); sets.push(`"projectType" = $${vals.length}`); }
    if (req.body?.sortOrder !== undefined) { vals.push(Math.round(Number(req.body.sortOrder) || 0)); sets.push(`"sortOrder" = $${vals.length}`); }
    if (sets.length === 0) return ok(res, { id, updated: false });

    const upd = await pool.query(
      `UPDATE "BuildPortfolioPhoto" SET ${sets.join(", ")} WHERE "id" = $1 RETURNING *`,
      vals,
    );
    return ok(res, upd.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "portfolio_photo_update_failed", { details: (err as Error).message });
  }
});

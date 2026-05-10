import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, vEnum } from "../../lib/build";

export const documentsRouter = Router();

const DOC_TYPES = [
  "WELDER", "ELECTRICIAN", "DRIVER_LICENSE", "MEDICAL",
  "SAFETY", "PLUMBER", "ENGINEER", "OTHER",
] as const;

// POST /api/build/documents — upload document for verification
documentsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const fileUrl = vString(req.body?.fileUrl, "fileUrl", { min: 1, max: 2000 });
    if (!fileUrl.ok) return fail(res, 400, fileUrl.error);
    try { new URL(fileUrl.value); } catch { return fail(res, 400, "fileUrl_invalid"); }

    const docType = vEnum(req.body?.docType, "docType", DOC_TYPES);
    if (!docType.ok) return fail(res, 400, docType.error);

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildDocument" ("id","userId","docType","fileUrl","status")
       VALUES ($1,$2,$3,$4,'PENDING')
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [id, auth.sub, docType.value, fileUrl.value],
    );
    if ((result.rowCount ?? 0) === 0) return fail(res, 409, "document_already_exists");
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "document_upload_failed", { details: (err as Error).message });
  }
});

// GET /api/build/documents/me — my documents with verification status
documentsRouter.get("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const result = await pool.query(
      `SELECT * FROM "BuildDocument" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "documents_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/documents/user/:userId — public verified docs for a profile
documentsRouter.get("/user/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const result = await pool.query(
      `SELECT "id","docType","status","verifiedAt"
       FROM "BuildDocument"
       WHERE "userId" = $1 AND "status" = 'VERIFIED'
       ORDER BY "docType" ASC`,
      [userId],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "documents_user_failed", { details: (err as Error).message });
  }
});

// GET /api/build/admin/documents/pending — admin: list awaiting review
documentsRouter.get("/admin/pending", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const result = await pool.query(
      `SELECT d.*, u."name" AS "userName", u."email" AS "userEmail"
       FROM "BuildDocument" d
       LEFT JOIN "AEVIONUser" u ON u."id" = d."userId"
       WHERE d."status" = 'PENDING'
       ORDER BY d."createdAt" ASC LIMIT 100`,
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "admin_documents_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/documents/:id/verify — admin approves
documentsRouter.patch("/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const id = String(req.params.id);
    const result = await pool.query(
      `UPDATE "BuildDocument" SET "status" = 'VERIFIED', "verifiedBy" = $2, "verifiedAt" = NOW()
       WHERE "id" = $1 RETURNING *`,
      [id, auth.sub],
    );
    if (result.rowCount === 0) return fail(res, 404, "document_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "document_verify_failed", { details: (err as Error).message });
  }
});

// PATCH /api/build/documents/:id/reject — admin rejects
documentsRouter.patch("/:id/reject", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const id = String(req.params.id);
    const reason = req.body?.reason == null ? null : String(req.body.reason).trim().slice(0, 500) || null;
    const result = await pool.query(
      `UPDATE "BuildDocument" SET "status" = 'REJECTED', "verifiedBy" = $2, "verifiedAt" = NOW(), "rejectReason" = $3
       WHERE "id" = $1 RETURNING *`,
      [id, auth.sub, reason],
    );
    if (result.rowCount === 0) return fail(res, 404, "document_not_found");
    return ok(res, result.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "document_reject_failed", { details: (err as Error).message });
  }
});

void vEnum;

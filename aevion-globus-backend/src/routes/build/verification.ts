import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const verificationRouter = Router();

// POST /api/build/verification/request — candidate submits request for ✓ badge
verificationRouter.post("/request", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const note = req.body?.note == null
      ? { ok: true as const, value: null }
      : vString(req.body.note, "note", { max: 1000, allowEmpty: true });
    if (!note.ok) return fail(res, 400, note.error);

    // Check if already verified
    const profile = await pool.query(
      `SELECT "verifiedAt" FROM "BuildProfile" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (profile.rows[0]?.verifiedAt) return fail(res, 409, "already_verified");

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildVerificationRequest" ("id","userId","status","note")
       VALUES ($1,$2,'PENDING',$3)
       ON CONFLICT ("userId") DO UPDATE SET "note" = EXCLUDED."note", "status" = 'PENDING', "updatedAt" = NOW()
       RETURNING *`,
      [id, auth.sub, note.value || null],
    );
    return ok(res, { request: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "verification_request_failed", { details: (err as Error).message });
  }
});

// GET /api/build/verification/my — check own request status
verificationRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT * FROM "BuildVerificationRequest" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    return ok(res, { request: r.rows[0] ?? null });
  } catch (err: unknown) {
    return fail(res, 500, "verification_my_failed", { details: (err as Error).message });
  }
});

// GET /api/build/admin/verification — admin queue of pending requests
verificationRouter.get("/admin/queue", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const r = await pool.query(
      `SELECT vr.*, u."name", u."email", p."city", p."buildRole", p."experienceYears"
       FROM "BuildVerificationRequest" vr
       JOIN "AEVIONUser" u ON u."id" = vr."userId"
       LEFT JOIN "BuildProfile" p ON p."userId" = vr."userId"
       WHERE vr."status" = 'PENDING'
       ORDER BY vr."createdAt" ASC LIMIT 100`,
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "verification_queue_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/verification/:userId/approve — approve and set verifiedAt
verificationRouter.post("/admin/:userId/approve", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const userId = String(req.params.userId);

    await pool.query(
      `UPDATE "BuildVerificationRequest" SET "status" = 'APPROVED', "updatedAt" = NOW() WHERE "userId" = $1`,
      [userId],
    );
    await pool.query(
      `UPDATE "BuildProfile" SET "verifiedAt" = NOW(), "verifiedReason" = 'Verified by AEVION admin' WHERE "userId" = $1`,
      [userId],
    );
    // Notify candidate
    const u = await pool.query(`SELECT "email","name" FROM "AEVIONUser" WHERE "id" = $1`, [userId]);
    if (u.rows[0] && process.env.RESEND_API_KEY) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QBuild <noreply@aevion.tech>",
          to: u.rows[0].email,
          subject: "Your profile is now verified — AEVION QBuild",
          text: `Hi ${u.rows[0].name},\n\nGreat news! Your profile has been verified. The ✓ Verified badge is now visible on your public profile.\n\nhttps://aevion.tech/build/u/${userId}\n\n— AEVION QBuild`,
        }),
      }).catch(() => {});
    }
    return ok(res, { userId, approved: true });
  } catch (err: unknown) {
    return fail(res, 500, "verification_approve_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/verification/:userId/reject
verificationRouter.post("/admin/:userId/reject", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const userId = String(req.params.userId);
    const adminNote = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;

    await pool.query(
      `UPDATE "BuildVerificationRequest" SET "status" = 'REJECTED', "adminNote" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
      [userId, adminNote],
    );
    return ok(res, { userId, rejected: true });
  } catch (err: unknown) {
    return fail(res, 500, "verification_reject_failed", { details: (err as Error).message });
  }
});

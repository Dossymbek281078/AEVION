import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

export const adminRouter = Router();

// GET /api/build/admin/stats
adminRouter.get("/stats", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const r = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildLead"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildLead" WHERE "createdAt" > NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildOrder" WHERE "status" = 'PAID'`),
      pool.query(`SELECT COALESCE(SUM("amount"),0)::float8 AS "n" FROM "BuildOrder" WHERE "status" = 'PAID'`),
      pool.query(`SELECT COALESCE(SUM("cashbackAev"),0)::float8 AS "n" FROM "BuildCashback"`),
      pool.query(`SELECT COALESCE(SUM("cashbackAev"),0)::float8 AS "n" FROM "BuildCashback" WHERE "claimStatus" = 'CLAIMED'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "AEVIONUser"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildProfile"`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildVacancy" WHERE "status" = 'OPEN'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildApplication" WHERE "status" = 'PENDING'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "AEVIONUser" WHERE "createdAt" > NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildVerificationRequest" WHERE "status" = 'PENDING'`).catch(() => ({ rows: [{ n: 0 }] })),
    ]);
    return ok(res, {
      leads: { total: Number(r[0].rows[0].n), last7d: Number(r[1].rows[0].n) },
      paidOrders: { count: Number(r[2].rows[0].n), totalAmount: Number(r[3].rows[0].n) },
      cashback: { totalAev: Number(r[4].rows[0].n), claimedAev: Number(r[5].rows[0].n) },
      users: { total: Number(r[6].rows[0].n), newLast7d: Number(r[10].rows[0].n) },
      profiles: { total: Number(r[7].rows[0].n) },
      vacancies: { open: Number(r[8].rows[0].n) },
      applications: { pending: Number(r[9].rows[0].n) },
      verificationPending: Number(r[11].rows[0].n),
    });
  } catch (err: unknown) {
    return fail(res, 500, "admin_stats_failed", { details: (err as Error).message });
  }
});

// --- Partner API key management (admin) ----------------------------------
// GET /api/build/admin/partner-keys — list all keys (without plaintext).
adminRouter.get("/partner-keys", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const r = await pool.query(
      `SELECT "id","label","scopesJson","ownerUserId","lastUsedAt","usageCount","revokedAt","createdAt"
       FROM "BuildPartnerApiKey" ORDER BY "createdAt" DESC LIMIT 200`,
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "partner_keys_list_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/partner-keys — mint a new key. Plaintext returned
// ONCE in the response (qb_pk_*); the DB stores only sha256(plaintext).
adminRouter.post("/partner-keys", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const label = typeof req.body?.label === "string" ? String(req.body.label).trim().slice(0, 200) : "";
    if (label.length < 2) return fail(res, 400, "label_required");

    const id = crypto.randomUUID();
    const plaintext = `qb_pk_${crypto.randomBytes(24).toString("base64url")}`;
    const keyHash = crypto.createHash("sha256").update(plaintext).digest("hex");

    const r = await pool.query(
      `INSERT INTO "BuildPartnerApiKey" ("id","label","keyHash") VALUES ($1,$2,$3) RETURNING *`,
      [id, label, keyHash],
    );
    return ok(res, { ...r.rows[0], plaintext }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "partner_key_create_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/partner-keys/:id/revoke — revoke a key (idempotent).
adminRouter.post("/partner-keys/:id/revoke", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const id = String(req.params.id);
    const r = await pool.query(
      `UPDATE "BuildPartnerApiKey" SET "revokedAt" = COALESCE("revokedAt", NOW())
       WHERE "id" = $1 RETURNING *`,
      [id],
    );
    if (r.rowCount === 0) return fail(res, 404, "key_not_found");
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "partner_key_revoke_failed", { details: (err as Error).message });
  }
});

// GET /api/build/admin/leads
adminRouter.get("/leads", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const q = typeof req.query.q === "string" ? String(req.query.q).trim().slice(0, 100) : "";
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const params: unknown[] = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE "email" ILIKE $1 OR COALESCE("city", '') ILIKE $1 OR COALESCE("utmSource", '') ILIKE $1`;
    }
    params.push(limit);
    params.push(offset);
    const limOff = `LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const [list, total] = await Promise.all([
      pool.query(
        `SELECT "id","email","city","locale","source","referrer","utmSource","utmCampaign","createdAt"
         FROM "BuildLead" ${where} ORDER BY "createdAt" DESC ${limOff}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS "n" FROM "BuildLead" ${where}`, q ? [`%${q}%`] : []),
    ]);
    return ok(res, { items: list.rows, total: Number(total.rows[0]?.n ?? 0), limit, offset });
  } catch (err: unknown) {
    return fail(res, 500, "admin_leads_failed", { details: (err as Error).message });
  }
});

// GET /api/build/admin/leads.csv — CSV download
adminRouter.get("/leads.csv", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const q = typeof req.query.q === "string" ? String(req.query.q).trim().slice(0, 100) : "";
    const params: unknown[] = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE "email" ILIKE $1 OR COALESCE("city", '') ILIKE $1 OR COALESCE("utmSource", '') ILIKE $1`;
    }
    const r = await pool.query(
      `SELECT "email","city","locale","source","referrer","utmSource","utmCampaign","createdAt"
       FROM "BuildLead" ${where} ORDER BY "createdAt" DESC`,
      params,
    );

    const escape = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = "email,city,locale,source,referrer,utmSource,utmCampaign,createdAt";
    const body = r.rows
      .map((row: Record<string, unknown>) =>
        [
          row.email, row.city, row.locale, row.source, row.referrer,
          row.utmSource, row.utmCampaign,
          row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        ]
          .map(escape)
          .join(","),
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qbuild-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(`${header}\n${body}`);
  } catch (err: unknown) {
    return fail(res, 500, "admin_leads_csv_failed", { details: (err as Error).message });
  }
});

// GET /api/build/admin/users — admin-only user list
adminRouter.get("/users", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");

    const q = typeof req.query.q === "string" ? String(req.query.q).trim().slice(0, 100) : "";
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const params: unknown[] = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE (u."email" ILIKE $1 OR u."name" ILIKE $1)`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS "n" FROM "AEVIONUser" u ${where}`, params);
    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT u."id", u."email", u."name", u."role", u."createdAt",
              p."buildRole", p."city", p."openToWork", p."verifiedAt"
       FROM "AEVIONUser" u LEFT JOIN "BuildProfile" p ON p."userId" = u."id"
       ${where} ORDER BY u."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok(res, { items: rows.rows, total: Number(countRes.rows[0].n) });
  } catch (err: unknown) {
    return fail(res, 500, "admin_users_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/users/:id/verify — set verifiedAt on BuildProfile
adminRouter.post("/users/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const userId = String(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : "Manual admin verification";
    const r = await pool.query(
      `UPDATE "BuildProfile" SET "verifiedAt" = NOW(), "verifiedReason" = $2 WHERE "userId" = $1 RETURNING "userId","verifiedAt"`,
      [userId, reason],
    );
    if (r.rowCount === 0) return fail(res, 404, "profile_not_found");
    return ok(res, { userId, verified: true, verifiedAt: r.rows[0].verifiedAt });
  } catch (err: unknown) {
    return fail(res, 500, "admin_verify_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/admin/users/:id/verify — remove verification
adminRouter.delete("/users/:id/verify", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const userId = String(req.params.id);
    await pool.query(
      `UPDATE "BuildProfile" SET "verifiedAt" = NULL, "verifiedReason" = NULL WHERE "userId" = $1`,
      [userId],
    );
    return ok(res, { userId, verified: false });
  } catch (err: unknown) {
    return fail(res, 500, "admin_unverify_failed", { details: (err as Error).message });
  }
});

// POST /api/build/admin/vacancies/close-expired — bulk close vacancies past expiresAt
adminRouter.post("/vacancies/close-expired", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    if (auth.role !== "ADMIN") return fail(res, 403, "admin_only");
    const r = await pool.query(
      `UPDATE "BuildVacancy" SET "status" = 'CLOSED'
       WHERE "status" = 'OPEN' AND "expiresAt" IS NOT NULL AND "expiresAt" < NOW()
       RETURNING "id"`,
    );
    return ok(res, { closed: r.rowCount, ids: r.rows.map((row: { id: string }) => row.id) });
  } catch (err: unknown) {
    return fail(res, 500, "admin_close_expired_failed", { details: (err as Error).message });
  }
});

// Suppress unused import warning — crypto used for future admin routes
void crypto;

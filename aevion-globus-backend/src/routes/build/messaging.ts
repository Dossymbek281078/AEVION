import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString, vNumber } from "../../lib/build";

export const messagingRouter = Router();

// POST /api/build/messages — send DM
messagingRouter.post("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const receiverId = vString(req.body?.receiverId, "receiverId", { min: 1, max: 200 });
    if (!receiverId.ok) return fail(res, 400, receiverId.error);
    if (receiverId.value === auth.sub) return fail(res, 400, "cannot_message_self");

    const content = vString(req.body?.content, "content", { min: 1, max: 4000 });
    if (!content.ok) return fail(res, 400, content.error);

    const recv = await pool.query(`SELECT "id" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [receiverId.value]);
    if (recv.rowCount === 0) return fail(res, 404, "receiver_not_found");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildMessage" ("id","senderId","receiverId","content") VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, auth.sub, receiverId.value, content.value],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "message_send_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages/:userId — full thread
messagingRouter.get("/messages/:userId", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const peerId = String(req.params.userId);
    if (peerId === auth.sub) return fail(res, 400, "cannot_thread_with_self");

    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const result = await pool.query(
      `SELECT * FROM "BuildMessage"
       WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $2 AND "receiverId" = $1)
       ORDER BY "createdAt" ASC LIMIT $3`,
      [auth.sub, peerId, limit],
    );

    pool.query(
      `UPDATE "BuildMessage" SET "readAt" = NOW() WHERE "receiverId" = $1 AND "senderId" = $2 AND "readAt" IS NULL`,
      [auth.sub, peerId],
    ).catch((err: Error) => console.warn("[build] mark-read failed:", err.message));

    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_thread_failed", { details: (err as Error).message });
  }
});

// GET /api/build/messages — inbox summary (latest msg per peer)
messagingRouter.get("/messages", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const result = await pool.query(
      `WITH threads AS (
         SELECT CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS "peerId",
                MAX("createdAt") AS "lastAt"
         FROM "BuildMessage" WHERE "senderId" = $1 OR "receiverId" = $1
         GROUP BY 1
       )
       SELECT t."peerId", u."name" AS "peerName", u."email" AS "peerEmail", t."lastAt",
              (SELECT m."content" FROM "BuildMessage" m
               WHERE (m."senderId" = $1 AND m."receiverId" = t."peerId") OR (m."senderId" = t."peerId" AND m."receiverId" = $1)
               ORDER BY m."createdAt" DESC LIMIT 1) AS "lastContent",
              (SELECT COUNT(*)::int FROM "BuildMessage" m
               WHERE m."receiverId" = $1 AND m."senderId" = t."peerId" AND m."readAt" IS NULL) AS "unread"
       FROM threads t LEFT JOIN "AEVIONUser" u ON u."id" = t."peerId"
       ORDER BY t."lastAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "messages_inbox_failed", { details: (err as Error).message });
  }
});

// POST /api/build/files/upload — register an externally-uploaded file URL
messagingRouter.post("/files/upload", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const projectId = vString(req.body?.projectId, "projectId", { min: 1, max: 200 });
    if (!projectId.ok) return fail(res, 400, projectId.error);
    const url = vString(req.body?.url, "url", { min: 1, max: 2000 });
    if (!url.ok) return fail(res, 400, url.error);
    try {
      const u = new URL(url.value);
      if (u.protocol !== "https:" && u.protocol !== "http:") return fail(res, 400, "url_must_be_http_or_https");
    } catch { return fail(res, 400, "url_invalid"); }

    const name = req.body?.name == null ? { ok: true as const, value: null } : vString(req.body.name, "name", { max: 500, allowEmpty: true });
    if (name.ok === false) return fail(res, 400, name.error);
    const mimeType = req.body?.mimeType == null ? { ok: true as const, value: null } : vString(req.body.mimeType, "mimeType", { max: 200, allowEmpty: true });
    if (mimeType.ok === false) return fail(res, 400, mimeType.error);
    const sizeBytes = req.body?.sizeBytes == null ? { ok: true as const, value: null } : vNumber(req.body.sizeBytes, "sizeBytes", { min: 0, max: 5e10 });
    if (sizeBytes.ok === false) return fail(res, 400, sizeBytes.error);

    const project = await pool.query(`SELECT "id","clientId" FROM "BuildProject" WHERE "id" = $1 LIMIT 1`, [projectId.value]);
    if (project.rowCount === 0) return fail(res, 404, "project_not_found");
    if (project.rows[0].clientId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "only_project_owner_can_upload");

    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO "BuildFile" ("id","projectId","url","name","mimeType","sizeBytes","uploaderId")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, projectId.value, url.value, name.value || null, mimeType.value || null, sizeBytes.value !== null ? Math.round(sizeBytes.value) : null, auth.sub],
    );
    return ok(res, result.rows[0], 201);
  } catch (err: unknown) {
    return fail(res, 500, "file_upload_failed", { details: (err as Error).message });
  }
});

// POST /api/build/notifications/read — mark messages from a sender as read.
// Body: { senderId: string }. Used by the notification badge to clear the
// unread count after the user opens a thread.
messagingRouter.post("/notifications/read", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const senderId = typeof req.body?.senderId === "string" ? req.body.senderId.trim() : null;
    if (!senderId) return fail(res, 400, "senderId_required");

    const result = await pool.query(
      `UPDATE "BuildMessage"
         SET "readAt" = NOW()
       WHERE "receiverId" = $1 AND "senderId" = $2 AND "readAt" IS NULL
       RETURNING "id"`,
      [auth.sub, senderId],
    );
    return ok(res, { markedRead: result.rowCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_read_failed", { details: (err as Error).message });
  }
});

// GET /api/build/notifications/summary
messagingRouter.get("/notifications/summary", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const [msgs, pending, updates] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM "BuildMessage" WHERE "receiverId" = $1 AND "readAt" IS NULL`, [auth.sub]),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" p ON p."id" = v."projectId"
         WHERE p."clientId" = $1 AND a."status" = 'PENDING'`,
        [auth.sub],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM "BuildApplication" a
         WHERE a."userId" = $1 AND a."status" IN ('ACCEPTED','REJECTED')
           AND a."updatedAt" > NOW() - INTERVAL '14 days'`,
        [auth.sub],
      ),
    ]);

    const unreadMessages = msgs.rows[0]?.c ?? 0;
    const pendingApplications = pending.rows[0]?.c ?? 0;
    const applicationUpdates = updates.rows[0]?.c ?? 0;
    return ok(res, { unreadMessages, pendingApplications, applicationUpdates, total: unreadMessages + pendingApplications + applicationUpdates });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_summary_failed", { details: (err as Error).message });
  }
});

// GET /api/build/notifications — paginated synthetic notification feed
messagingRouter.get("/notifications", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const [msgs, appUpdates, pending] = await Promise.all([
      pool.query(
        `SELECT m."id", m."senderId", m."content", m."createdAt", m."readAt",
                u."name" AS "senderName", u."email" AS "senderEmail"
         FROM "BuildMessage" m LEFT JOIN "AEVIONUser" u ON u."id" = m."senderId"
         WHERE m."receiverId" = $1 ORDER BY m."createdAt" DESC LIMIT $2`,
        [auth.sub, limit],
      ),
      pool.query(
        `SELECT a."id", a."status", a."updatedAt", v."title" AS "vacancyTitle"
         FROM "BuildApplication" a JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         WHERE a."userId" = $1 AND a."status" IN ('ACCEPTED','REJECTED')
           AND a."updatedAt" > NOW() - INTERVAL '30 days'
         ORDER BY a."updatedAt" DESC LIMIT $2`,
        [auth.sub, limit],
      ),
      pool.query(
        `SELECT a."id", a."createdAt", v."title" AS "vacancyTitle", u."name" AS "applicantName"
         FROM "BuildApplication" a
         JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
         JOIN "BuildProject" p ON p."id" = v."projectId"
         JOIN "AEVIONUser" u ON u."id" = a."userId"
         WHERE p."clientId" = $1 AND a."status" = 'PENDING'
         ORDER BY a."createdAt" DESC LIMIT $2`,
        [auth.sub, limit],
      ),
    ]);

    const items: { id: string; kind: string; title: string; body: string; href: string; read: boolean; at: string }[] = [];
    for (const m of msgs.rows) {
      items.push({ id: `msg-${m.id}`, kind: "message", title: `Message from ${m.senderName || m.senderEmail || "someone"}`, body: String(m.content).slice(0, 120), href: `/build/messages?to=${encodeURIComponent(m.senderId)}`, read: !!m.readAt, at: m.createdAt });
    }
    for (const a of appUpdates.rows) {
      items.push({ id: `app-${a.id}`, kind: a.status === "ACCEPTED" ? "accepted" : "rejected", title: a.status === "ACCEPTED" ? "Application accepted" : "Application declined", body: `Your application for "${a.vacancyTitle}" was ${a.status.toLowerCase()}.`, href: `/build/vacancies`, read: false, at: a.updatedAt });
    }
    for (const p of pending.rows) {
      items.push({ id: `pend-${p.id}`, kind: "pending", title: "New application", body: `${p.applicantName || "Someone"} applied for "${p.vacancyTitle}".`, href: `/build/vacancy/${encodeURIComponent(p.id)}`, read: false, at: p.createdAt });
    }
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return ok(res, { items: items.slice(0, limit), total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_list_failed", { details: (err as Error).message });
  }
});

// POST /api/build/notifications/mark-read — mark all incoming messages as read
messagingRouter.post("/notifications/mark-read", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await pool.query(`UPDATE "BuildMessage" SET "readAt" = NOW() WHERE "receiverId" = $1 AND "readAt" IS NULL`, [auth.sub]);
    return ok(res, { marked: true });
  } catch (err: unknown) {
    return fail(res, 500, "notifications_mark_read_failed", { details: (err as Error).message });
  }
});

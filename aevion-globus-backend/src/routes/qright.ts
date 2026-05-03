import { Router } from "express";
import crypto from "crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { deliverWebhook } from "../lib/webhookDelivery";
import { applyOgEtag, applyEtag } from "../lib/ogEtag";

const QRIGHT_WEBHOOK_DELIVERY_CFG = {
  webhookTable: "QRightWebhook",
  deliveryTable: "QRightWebhookDelivery",
  entityColumn: "objectId",
  userAgent: "AEVION-QRight-Webhook/1.0",
} as const;

export const qrightRouter = Router();

const pool = getPool();

qrightRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qright",
    timestamp: new Date().toISOString(),
  });
});

const objectsRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "qright:objects",
});

// Public embed surfaces are hit by third-party pages; allow more headroom but still cap.
const embedRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "qright:embed",
});

let ensuredTable = false;
async function ensureQRightTable() {
  if (ensuredTable) return;

  // Minimal table bootstrap for fresh DBs.
  // Backend uses raw SQL via `pg`, so we ensure the table exists here.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightObject" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "contentHash" TEXT NOT NULL,
      "ownerName" TEXT,
      "ownerEmail" TEXT,
      "ownerUserId" TEXT,
      "country" TEXT,
      "city" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // If the table already existed (older bootstraps), ensure columns exist.
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "country" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "city" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "revokeReasonCode" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "embedFetches" BIGINT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "lastFetchedAt" TIMESTAMPTZ;`);

  // Daily-bucket table for time-series counters. UPSERT keeps row count
  // bounded at O(active_objects × days) instead of O(fetches).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightFetchDaily" (
      "objectId" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("objectId", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightFetchDaily_day_idx" ON "QRightFetchDaily" ("day");`
  );

  // Per-source bucket — tracks which third-party hostnames are loading the
  // embed/badge for an object. Privacy: hostname only (no path, no query,
  // no IP, no UA). Direct fetches with no Referer collapse to "(direct)".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightFetchSource" (
      "objectId" TEXT NOT NULL,
      "sourceHost" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("objectId", "sourceHost", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightFetchSource_obj_day_idx" ON "QRightFetchSource" ("objectId", "day");`
  );

  // Persistent audit log — admin-visible, append-only history of
  // privileged actions (revoke, admin-takedown, bulk-revoke).
  // payload is JSONB so we can store reasonCode + reason + counts
  // without growing the column list every time we add a new action.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightAuditLog" (
      "id" TEXT PRIMARY KEY,
      "actor" TEXT,
      "action" TEXT NOT NULL,
      "targetId" TEXT,
      "payload" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightAuditLog_at_idx" ON "QRightAuditLog" ("at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightAuditLog_action_idx" ON "QRightAuditLog" ("action");`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightAuditLog_target_idx" ON "QRightAuditLog" ("targetId");`
  );

  // Owner-configured outgoing webhooks. Fired when one of the owner's
  // objects is revoked (owner action OR admin force-revoke), so a
  // third-party site embedding the badge can auto-remove it.
  // secret is the HMAC signing key; we never display it after creation.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightWebhook" (
      "id" TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "secret" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastDeliveredAt" TIMESTAMPTZ,
      "lastFailedAt" TIMESTAMPTZ,
      "lastError" TEXT
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightWebhook_owner_idx" ON "QRightWebhook" ("ownerUserId");`
  );

  // Per-attempt webhook delivery log (v1.2). Lets owners see exactly what
  // was sent, when, and why a delivery failed — and lets them re-issue the
  // same body via POST /webhooks/:id/retry/:deliveryId. We store the raw
  // request body so a retry uses the original payload (not a fresh one
  // built around the current revokedAt timestamp), which preserves the
  // signature semantics for the receiver's idempotency keys.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightWebhookDelivery" (
      "id" TEXT PRIMARY KEY,
      "webhookId" TEXT NOT NULL,
      "objectId" TEXT,
      "eventType" TEXT NOT NULL,
      "requestBody" TEXT NOT NULL,
      "statusCode" INTEGER,
      "ok" BOOLEAN NOT NULL DEFAULT FALSE,
      "error" TEXT,
      "deliveredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "isRetry" BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QRightWebhookDelivery_webhook_idx" ON "QRightWebhookDelivery" ("webhookId", "deliveredAt" DESC);`
  );

  ensuredTable = true;
}

// Single delivery attempt: sign, POST, persist a delivery row, update the
// webhook's last* status. Returns the inserted delivery row id so callers
// can correlate / retry by id. Body is the raw JSON we'll send AND the
// payload we sign — receiver verifies HMAC against this exact byte stream.
//
// Best-effort error handling: this never throws. Even an outright DB failure
// while writing the delivery log is swallowed (warn-logged) so the original
// revoke flow remains unaffected.
async function attemptWebhookDelivery(opts: {
  webhookId: string;
  url: string;
  secret: string;
  body: string;
  eventType: string;
  objectId: string | null;
  isRetry: boolean;
}): Promise<{ ok: boolean; statusCode: number | null; error: string | null }> {
  return deliverWebhook(pool, QRIGHT_WEBHOOK_DELIVERY_CFG, {
    webhookId: opts.webhookId,
    url: opts.url,
    secret: opts.secret,
    body: opts.body,
    eventType: opts.eventType,
    entityId: opts.objectId,
    isRetry: opts.isRetry,
  });
}

// Fan out a revoke event to every webhook registered by the object's owner.
// Best-effort, fire-and-forget — a slow or 5xx webhook target must not block
// the revoke response. Each delivery is signed with HMAC-SHA256 of the raw
// JSON body using the webhook's per-row secret; receivers verify by recomputing
// the same HMAC. We update lastDeliveredAt / lastFailedAt so owners can see
// which targets are healthy in their UI.
//
// `revokedBy` distinguishes owner.revoke from admin force-revoke so the
// receiving site can show provenance to its users.
function triggerRevokeWebhooks(
  objectId: string,
  payload: {
    revokedAt: string;
    reasonCode: string | null;
    reason: string | null;
    revokedBy: "owner" | "admin";
  }
): void {
  pool
    .query(
      `SELECT w."id", w."url", w."secret"
       FROM "QRightWebhook" w
       INNER JOIN "QRightObject" o
         ON o."ownerUserId" = w."ownerUserId" AND o."ownerUserId" IS NOT NULL
       WHERE o."id" = $1`,
      [objectId]
    )
    .then(async (result: { rows: { id: string; url: string; secret: string }[] }) => {
      for (const wh of result.rows) {
        const body = JSON.stringify({
          event: "qright.object.revoked",
          objectId,
          revokedAt: payload.revokedAt,
          reasonCode: payload.reasonCode,
          reason: payload.reason,
          revokedBy: payload.revokedBy,
          deliveredAt: new Date().toISOString(),
        });
        await attemptWebhookDelivery({
          webhookId: wh.id,
          url: wh.url,
          secret: wh.secret,
          body,
          eventType: "qright.object.revoked",
          objectId,
          isRetry: false,
        });
      }
    })
    .catch((err: Error) => {
      console.warn(`[qright] webhook fanout failed for ${objectId}:`, err.message);
    });
}

// Append an audit row. Fire-and-forget like the counter bumps — the underlying
// admin/owner action must succeed even if the audit insert hits a transient DB
// error. We still log to console as a tail-grep fallback so an audit gap is
// never invisible.
function recordAudit(
  actor: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown> | null
): void {
  pool
    .query(
      `INSERT INTO "QRightAuditLog" ("id", "actor", "action", "targetId", "payload")
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), actor, action, targetId, payload ? JSON.stringify(payload) : null]
    )
    .catch((err: Error) => {
      console.warn(`[qright] audit insert failed action=${action}:`, err.message);
    });
}

// Pure helpers (no DB / no IO) live in src/lib/qrightHelpers.ts so vitest
// can exercise them in isolation. Imported here unchanged.
import { readExpectedHash, timingSafeHexEq, refererHost } from "../lib/qrightHelpers";
import { makeServiceCapture } from "../lib/sentry/platform";
const captureQrightError = makeServiceCapture("qright");

// Best-effort counter bump — fire-and-forget. Errors here must never break
// the embed/badge response, since these endpoints are loaded by third parties.
// Bumps three counters in parallel: total on QRightObject, daily bucket on
// QRightFetchDaily, and per-source-host bucket on QRightFetchSource.
function bumpEmbedCounters(
  req: { headers: Record<string, string | string[] | undefined> },
  id: string
): void {
  pool
    .query(
      `UPDATE "QRightObject"
       SET "embedFetches" = "embedFetches" + 1, "lastFetchedAt" = NOW()
       WHERE "id" = $1`,
      [id]
    )
    .catch((err: Error) => {
      console.warn(`[qright] fetch counter bump failed for ${id}:`, err.message);
    });
  pool
    .query(
      `INSERT INTO "QRightFetchDaily" ("objectId", "day", "fetches")
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT ("objectId", "day") DO UPDATE SET "fetches" = "QRightFetchDaily"."fetches" + 1`,
      [id]
    )
    .catch((err: Error) => {
      console.warn(`[qright] daily counter bump failed for ${id}:`, err.message);
    });
  const host = refererHost(req);
  pool
    .query(
      `INSERT INTO "QRightFetchSource" ("objectId", "sourceHost", "day", "fetches")
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT ("objectId", "sourceHost", "day")
       DO UPDATE SET "fetches" = "QRightFetchSource"."fetches" + 1`,
      [id, host]
    )
    .catch((err: Error) => {
      console.warn(`[qright] source counter bump failed for ${id}:`, err.message);
    });
}

// Closed set — UI is the source of truth. Any unrecognised value is rejected
// to keep the public revoke ledger machine-readable.
const REVOKE_REASON_CODES = new Set([
  "license-conflict",
  "withdrawn",
  "dispute",
  "mistake",
  "superseded",
  "other",
  // Admin-only:
  "admin-takedown",
]);

// Admin allowlist by email (ENV) + JWT role=admin. Used for force-revoke and
// audit listing. Empty allowlist = no email-based admins (only role=admin).
function getAdminEmailAllowlist(): Set<string> {
  return new Set(
    (process.env.QRIGHT_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isQRightAdmin(auth: { role?: string; email?: string } | null): boolean {
  if (!auth) return false;
  if (auth.role === "admin") return true;
  if (auth.email && getAdminEmailAllowlist().has(auth.email.toLowerCase())) return true;
  return false;
}

// 🔹 Получить все объекты (или ?mine=1 при Bearer — по ownerUserId, с fallback на старые строки по email)
qrightRouter.get("/objects", objectsRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const mineRaw = req.query.mine;
    const mine =
      mineRaw === "1" ||
      mineRaw === "true" ||
      String(mineRaw || "").toLowerCase() === "yes";

    if (mine) {
      const auth = verifyBearerOptional(req);
      if (!auth) {
        return res.status(401).json({ error: "Bearer token required for mine=1" });
      }
      const result = await pool.query(
        `
        SELECT * FROM "QRightObject"
        WHERE ("ownerUserId" = $1)
           OR ("ownerUserId" IS NULL AND "ownerEmail" = $2)
        ORDER BY "createdAt" DESC
        `,
        [auth.sub, auth.email]
      );
      return res.json({
        items: result.rows,
        total: result.rowCount,
        scope: "mine",
      });
    }

    const result = await pool.query(
      'SELECT * FROM "QRightObject" ORDER BY "createdAt" DESC'
    );

    res.json({
      items: result.rows,
      total: result.rowCount,
      scope: "all",
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Search — GET /objects/search?q=...&kind=music&limit=20
//    Case-insensitive ILIKE on title; optional kind filter; capped at 50.
//    Declared BEFORE /objects/:id so Express doesn't treat "search" as an id.
qrightRouter.get("/objects/search", objectsRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 chars" });
    }
    const kind = String(req.query.kind || "").trim();
    const limitRaw = parseInt(String(req.query.limit || "20"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;

    const params: unknown[] = [`%${q}%`];
    let where = `"title" ILIKE $1`;
    if (kind) {
      params.push(kind);
      where += ` AND "kind" = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT id, title, kind, "contentHash", "ownerName", country, city, "createdAt", "revokedAt"
       FROM "QRightObject"
       WHERE ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      query: q,
      kind: kind || null,
      total: result.rowCount,
      items: result.rows,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Owner-only stats — GET /objects/:id/stats
//    Returns aggregate fetch counter (no PII, no per-IP data) + revoke metadata.
//    Declared BEFORE the catch-all /objects/:id so it isn't shadowed.
qrightRouter.get("/objects/:id/stats", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!auth) {
      return res.status(401).json({ error: "Bearer token required" });
    }

    const id = String(req.params.id);
    const result = await pool.query(
      `SELECT id, "ownerUserId", "ownerEmail", "embedFetches", "lastFetchedAt",
              "revokedAt", "revokeReason", "revokeReasonCode", "createdAt"
       FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = result.rows[0] as {
      id: string;
      ownerUserId: string | null;
      ownerEmail: string | null;
      embedFetches: string | number;
      lastFetchedAt: Date | string | null;
      revokedAt: Date | string | null;
      revokeReason: string | null;
      revokeReasonCode: string | null;
      createdAt: Date | string;
    };
    const isOwner =
      (row.ownerUserId && row.ownerUserId === auth.sub) ||
      (!row.ownerUserId && row.ownerEmail && row.ownerEmail === auth.email);
    if (!isOwner) {
      return res.status(403).json({ error: "Not the owner of this object" });
    }
    const daysRaw = parseInt(String(req.query.days || "30"), 10);
    const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(180, daysRaw)) : 30;

    const [series, sources] = await Promise.all([
      pool.query(
        `SELECT to_char("day", 'YYYY-MM-DD') AS day, "fetches"::bigint AS fetches
         FROM "QRightFetchDaily"
         WHERE "objectId" = $1 AND "day" >= CURRENT_DATE - $2::int
         ORDER BY "day" ASC`,
        [id, days]
      ),
      pool.query(
        `SELECT "sourceHost" AS host, SUM("fetches")::bigint AS fetches
         FROM "QRightFetchSource"
         WHERE "objectId" = $1 AND "day" >= CURRENT_DATE - $2::int
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 20`,
        [id, days]
      ),
    ]);

    res.json({
      id: row.id,
      embedFetches: Number(row.embedFetches) || 0,
      lastFetchedAt:
        row.lastFetchedAt instanceof Date ? row.lastFetchedAt.toISOString() : row.lastFetchedAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      revoked: !!row.revokedAt,
      revokedAt:
        row.revokedAt instanceof Date ? row.revokedAt.toISOString() : row.revokedAt,
      revokeReason: row.revokeReason,
      revokeReasonCode: row.revokeReasonCode,
      series: {
        days,
        points: series.rows.map((r: { day: string; fetches: string }) => ({
          day: r.day,
          fetches: Number(r.fetches) || 0,
        })),
      },
      topSources: {
        days,
        hosts: sources.rows.map((r: { host: string; fetches: string }) => ({
          host: r.host,
          fetches: Number(r.fetches) || 0,
        })),
      },
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Получить один объект по id (с ETag/304 для эффективного embed-поллинга)
qrightRouter.get("/objects/:id", objectsRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM "QRightObject" WHERE "id" = $1 LIMIT 1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const row = result.rows[0];
    const etag = `W/"qright-${id}-${
      row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt
    }"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(row);
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 CSV export — GET /objects.csv
qrightRouter.get("/objects.csv", objectsRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const result = await pool.query(
      `SELECT id, title, kind, "contentHash", "ownerName", "ownerEmail", country, city, "createdAt"
       FROM "QRightObject"
       ORDER BY "createdAt" DESC`
    );

    // RFC 4180 CSV escaping: wrap field in quotes if it contains comma, quote, or newline;
    // escape internal double-quotes by doubling them.
    function csvField(value: unknown): string {
      if (value === null || value === undefined) return "";
      const s =
        value instanceof Date ? value.toISOString() : String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const columns = [
      "id",
      "title",
      "kind",
      "contentHash",
      "ownerName",
      "ownerEmail",
      "country",
      "city",
      "createdAt",
    ] as const;

    const today = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qright-objects-${today}.csv"`
    );
    res.setHeader("Cache-Control", "public, max-age=60");

    const header = columns.join(",");
    const rows = result.rows.map((row: Record<string, unknown>) =>
      columns.map((col) => csvField(row[col])).join(",")
    );
    res.send([header, ...rows].join("\r\n"));
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Public embed JSON — minimal, sanitized, CORS-friendly, ETag/304
//    Designed for third-party sites embedding a QRight verification widget.
//    Drops PII (email) and DB-internal fields; safe to cache at the CDN edge.
qrightRouter.get("/embed/:id", embedRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const id = String(req.params.id);
    // LEFT JOIN IPCertificate so the embed surface can deep-link to /verify/[certId].
    // The pipeline route writes both rows in one transaction, but the JOIN tolerates
    // legacy QRightObject rows created via POST /objects with no certificate.
    const result = await pool.query(
      `SELECT q.id, q.title, q.kind, q."contentHash", q."ownerName", q.country, q.city,
              q."createdAt", q."revokedAt", q."revokeReason", q."revokeReasonCode",
              c.id AS "certificateId"
       FROM "QRightObject" q
       LEFT JOIN "IPCertificate" c ON c."objectId" = q.id
       WHERE q."id" = $1
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      // Use 200 with explicit status so embeds can render a "not found" badge
      // without tripping the consumer's error-handler.
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id, status: "not_found" });
    }

    const row = result.rows[0] as {
      id: string;
      title: string;
      kind: string;
      contentHash: string;
      ownerName: string | null;
      country: string | null;
      city: string | null;
      createdAt: Date | string;
      revokedAt: Date | string | null;
      revokeReason: string | null;
      revokeReasonCode: string | null;
      certificateId: string | null;
    };

    const createdAtMs =
      row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
    const revokedAtMs = row.revokedAt
      ? row.revokedAt instanceof Date
        ? row.revokedAt.getTime()
        : new Date(row.revokedAt).getTime()
      : 0;
    // SRI-like integrity gate (v1.2): caller pins the contentHash they were
    // built around. We compare in constant time and report match/mismatch
    // as a separate field, leaving `status` (registered/revoked) untouched
    // so existing consumers don't break. The expected-hash is folded into
    // the ETag so a client polling with the same pin gets a stable 304 even
    // if another caller hits the same id with a different pin.
    const expectedHash = readExpectedHash(req.query as Record<string, unknown>);
    const storedHashLower = (row.contentHash || "").toLowerCase();
    const hashStatus: "match" | "mismatch" | "unspecified" = expectedHash
      ? timingSafeHexEq(expectedHash, storedHashLower)
        ? "match"
        : "mismatch"
      : "unspecified";
    const etag = `W/"qright-embed-${row.id}-${createdAtMs}-${revokedAtMs}-${hashStatus}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }

    bumpEmbedCounters(req, row.id);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: row.id,
      status: row.revokedAt ? "revoked" : "registered",
      title: row.title,
      kind: row.kind,
      contentHashPrefix: row.contentHash.slice(0, 16),
      contentHash: row.contentHash,
      expectedHash,
      hashStatus,
      ownerName: row.ownerName,
      country: row.country,
      city: row.city,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      revokedAt: row.revokedAt
        ? row.revokedAt instanceof Date
          ? row.revokedAt.toISOString()
          : row.revokedAt
        : null,
      revokeReason: row.revokeReason,
      revokeReasonCode: row.revokeReasonCode,
      certificateId: row.certificateId,
      verifyUrl: row.certificateId
        ? `/verify/${row.certificateId}`
        : `/qright/object/${row.id}`,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Public embeddable SVG badge — used as <img src="…/badge/:id.svg">
//    Two-segment "shields.io"-style label. Theme via ?theme=dark|light.
qrightRouter.get("/badge/:id.svg", embedRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();

    const id = String(req.params.id);
    const theme = String(req.query.theme || "dark").toLowerCase() === "light" ? "light" : "dark";

    const result = await pool.query(
      `SELECT id, kind, "contentHash", "createdAt", "revokedAt"
       FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );

    // SRI-like pin (v1.2): if a pin was supplied and doesn't match the
    // stored contentHash, the badge flips to a HASH MISMATCH state — even
    // when the underlying object is still active. This protects third-party
    // sites whose embed snippet was generated against a specific contentHash.
    const expectedHash = readExpectedHash(req.query as Record<string, unknown>);

    function svgShell(left: string, right: string, rightFill: string): string {
      // Approximate text widths (Verdana 11px ≈ 6.6px/char for uppercase).
      const padX = 8;
      const charW = 6.6;
      const lW = Math.max(60, Math.round(left.length * charW + padX * 2));
      const rW = Math.max(70, Math.round(right.length * charW + padX * 2));
      const total = lW + rW;
      const leftFill = theme === "light" ? "#e2e8f0" : "#1e293b";
      const leftText = theme === "light" ? "#0f172a" : "#e2e8f0";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${escapeXml(
        left
      )}: ${escapeXml(right)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".08"/>
  </linearGradient>
  <rect width="${total}" height="22" rx="4" fill="${leftFill}"/>
  <rect x="${lW}" width="${rW}" height="22" rx="4" fill="${rightFill}"/>
  <rect x="${lW - 4}" width="8" height="22" fill="${rightFill}"/>
  <rect width="${total}" height="22" rx="4" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
    <text x="${lW / 2}" y="15" fill="${leftText}">${escapeXml(left)}</text>
    <text x="${lW + rW / 2}" y="15">${escapeXml(right)}</text>
  </g>
</svg>`;
    }

    function escapeXml(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (result.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.send(svgShell("AEVION QRIGHT", "not found", "#94a3b8"));
    }

    const row = result.rows[0] as {
      id: string;
      kind: string;
      contentHash: string;
      createdAt: Date | string;
      revokedAt: Date | string | null;
    };
    const createdAt =
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const revokedAtMs = row.revokedAt
      ? row.revokedAt instanceof Date
        ? row.revokedAt.getTime()
        : new Date(row.revokedAt).getTime()
      : 0;
    const storedHashLower = (row.contentHash || "").toLowerCase();
    const hashStatus: "match" | "mismatch" | "unspecified" = expectedHash
      ? timingSafeHexEq(expectedHash, storedHashLower)
        ? "match"
        : "mismatch"
      : "unspecified";
    // ETag includes hashStatus so a CDN doesn't cache a "match" variant
    // and serve it to a caller passing a different (or no) pin.
    const etag = `W/"qright-badge-${row.id}-${createdAt.getTime()}-${revokedAtMs}-${theme}-${hashStatus}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }

    const dateLabel = createdAt.toISOString().slice(0, 10);

    bumpEmbedCounters(req, row.id);

    if (row.revokedAt) {
      // Revoked: keep the badge so the third-party site doesn't 404, but
      // visibly flip it red — the integrity guarantee no longer holds.
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(svgShell("AEVION QRIGHT", `REVOKED · ${dateLabel}`, "#dc2626"));
    }

    if (hashStatus === "mismatch") {
      // Pinned hash didn't match — surface as orange to distinguish from
      // revocation. Tells the embedding site that the content has drifted
      // from what they originally generated their snippet against.
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(svgShell("AEVION QRIGHT", `HASH MISMATCH · ${dateLabel}`, "#ea580c"));
    }

    const right = `${row.kind.toUpperCase()} · ${dateLabel}`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION QRIGHT", right, "#0d9488"));
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Создать объект
qrightRouter.post("/objects", async (req, res) => {
  try {
    const { title, description, kind, ownerName, ownerEmail, country, city } =
      req.body;

    if (!title || !description || !kind) {
      return res.status(400).json({
        error: "title, description and kind required",
      });
    }

    const raw = JSON.stringify({ title, description, kind, country, city });
    const contentHash = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex");

    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    let resolvedOwnerName = ownerName ?? null;
    let resolvedOwnerEmail = ownerEmail ?? null;
    let resolvedOwnerUserId: string | null = null;
    if (auth) {
      await ensureUsersTable(pool);
      const u = await pool.query(
        `SELECT "id","name","email" FROM "AEVIONUser" WHERE "id"=$1`,
        [auth.sub]
      );
      const row = u.rows?.[0];
      if (row) {
        resolvedOwnerUserId = row.id;
        if (!resolvedOwnerName) resolvedOwnerName = row.name;
        if (!resolvedOwnerEmail) resolvedOwnerEmail = row.email;
      }
    }

    const result = await pool.query(
      `
      INSERT INTO "QRightObject"
      ("id","title","description","kind","contentHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
      `,
      [
        crypto.randomUUID(),
        title,
        description,
        kind,
        contentHash,
        resolvedOwnerName,
        resolvedOwnerEmail,
        resolvedOwnerUserId,
        country || null,
        city || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin: list all objects with optional status/query filters
qrightRouter.get("/admin/objects", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();
    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status === "active") conds.push(`"revokedAt" IS NULL`);
    else if (status === "revoked") conds.push(`"revokedAt" IS NOT NULL`);
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`("title" ILIKE $${params.length} OR "ownerEmail" ILIKE $${params.length})`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT id, title, kind, "contentHash", "ownerName", "ownerEmail", country, city,
              "createdAt", "revokedAt", "revokeReason", "revokeReasonCode",
              "embedFetches", "lastFetchedAt"
       FROM "QRightObject"
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      total: result.rowCount,
      filter: { status, q: q || null },
      items: result.rows,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin: CSV export of full registry (incl. revoke + fetch fields)
//    Same status/q filters as /admin/objects so the operator can export
//    exactly what's on screen. Auth via Bearer token in Authorization header.
qrightRouter.get("/admin/objects.csv", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status === "active") conds.push(`"revokedAt" IS NULL`);
    else if (status === "revoked") conds.push(`"revokedAt" IS NOT NULL`);
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`("title" ILIKE $${params.length} OR "ownerEmail" ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT id, title, kind, "contentHash", "ownerName", "ownerEmail", country, city,
              "createdAt", "revokedAt", "revokeReasonCode", "revokeReason",
              "embedFetches", "lastFetchedAt"
       FROM "QRightObject"
       ${where}
       ORDER BY "createdAt" DESC`,
      params
    );

    function csvField(value: unknown): string {
      if (value === null || value === undefined) return "";
      const s = value instanceof Date ? value.toISOString() : String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const columns = [
      "id",
      "title",
      "kind",
      "contentHash",
      "ownerName",
      "ownerEmail",
      "country",
      "city",
      "createdAt",
      "revokedAt",
      "revokeReasonCode",
      "revokeReason",
      "embedFetches",
      "lastFetchedAt",
    ] as const;

    const today = new Date().toISOString().slice(0, 10);
    const suffix = status === "all" ? "" : `-${status}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qright-admin${suffix}-${today}.csv"`
    );
    res.setHeader("Cache-Control", "no-store");

    const header = columns.join(",");
    const rows = result.rows.map((row: Record<string, unknown>) =>
      columns.map((col) => csvField(row[col])).join(",")
    );
    res.send([header, ...rows].join("\r\n"));
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin: bulk force-revoke (best-effort per-id)
//    Body: { ids: string[], reasonCode: string, reason?: string }.
//    Caps the batch at BULK_LIMIT to keep the SQL round-trip bounded and to
//    avoid making this surface a takedown firehose. Returns a per-id summary
//    so the UI can render which ids were already revoked vs missing.
qrightRouter.post("/admin/revoke-bulk", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const BULK_LIMIT = 200;
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!idsRaw || idsRaw.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }
    const ids = Array.from(
      new Set(
        idsRaw
          .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
          .filter((v: string) => v.length > 0)
      )
    ) as string[];
    if (ids.length === 0) {
      return res.status(400).json({ error: "ids must contain at least one non-empty string" });
    }
    if (ids.length > BULK_LIMIT) {
      return res
        .status(400)
        .json({ error: `Too many ids — max ${BULK_LIMIT} per request`, received: ids.length });
    }

    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "admin-takedown").trim();
    if (!REVOKE_REASON_CODES.has(reasonCodeRaw)) {
      return res.status(400).json({
        error: "Unknown reasonCode",
        allowed: Array.from(REVOKE_REASON_CODES),
      });
    }

    // Snapshot existing rows so we can partition input ids into
    // not_found / already_revoked / to_revoke without a second round-trip.
    const existing = await pool.query(
      `SELECT id, "revokedAt" FROM "QRightObject" WHERE id = ANY($1::text[])`,
      [ids]
    );
    const existingMap = new Map<string, Date | string | null>();
    for (const r of existing.rows as { id: string; revokedAt: Date | string | null }[]) {
      existingMap.set(r.id, r.revokedAt);
    }

    const notFound: string[] = [];
    const alreadyRevoked: string[] = [];
    const toRevoke: string[] = [];
    for (const id of ids) {
      if (!existingMap.has(id)) notFound.push(id);
      else if (existingMap.get(id)) alreadyRevoked.push(id);
      else toRevoke.push(id);
    }

    let revokedRows: { id: string; revokedAt: Date | string }[] = [];
    if (toRevoke.length > 0) {
      const updated = await pool.query(
        `UPDATE "QRightObject"
         SET "revokedAt" = NOW(), "revokeReason" = $2, "revokeReasonCode" = $3
         WHERE id = ANY($1::text[]) AND "revokedAt" IS NULL
         RETURNING id, "revokedAt"`,
        [toRevoke, reason, reasonCodeRaw]
      );
      revokedRows = updated.rows as { id: string; revokedAt: Date | string }[];
    }

    const actor = auth?.email || auth?.sub || null;
    console.warn(
      `[qright] admin bulk-revoke by=${actor} code=${reasonCodeRaw} ` +
        `revoked=${revokedRows.length} already=${alreadyRevoked.length} missing=${notFound.length}`
    );
    recordAudit(actor, "admin.bulk-revoke", null, {
      reasonCode: reasonCodeRaw,
      reason,
      requested: ids.length,
      revokedIds: revokedRows.map((r) => r.id),
      alreadyRevoked,
      notFound,
    });
    for (const r of revokedRows) {
      triggerRevokeWebhooks(r.id, {
        revokedAt: r.revokedAt instanceof Date ? r.revokedAt.toISOString() : r.revokedAt,
        reasonCode: reasonCodeRaw,
        reason,
        revokedBy: "admin",
      });
    }

    res.json({
      requested: ids.length,
      revoked: revokedRows.map((r) => ({
        id: r.id,
        revokedAt: r.revokedAt instanceof Date ? r.revokedAt.toISOString() : r.revokedAt,
      })),
      alreadyRevoked,
      notFound,
      reasonCode: reasonCodeRaw,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin: force-revoke any object (regardless of ownership)
//    Required for handling DMCA-style takedowns, fraudulent registrations,
//    and dispute outcomes where the registrant is uncooperative.
qrightRouter.post("/admin/revoke/:id", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const id = String(req.params.id);
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "admin-takedown").trim();
    if (!REVOKE_REASON_CODES.has(reasonCodeRaw)) {
      return res.status(400).json({
        error: "Unknown reasonCode",
        allowed: Array.from(REVOKE_REASON_CODES),
      });
    }

    const existing = await pool.query(
      `SELECT id, "revokedAt" FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    if (existing.rows[0].revokedAt) {
      return res.status(409).json({ error: "Already revoked", revokedAt: existing.rows[0].revokedAt });
    }

    const updated = await pool.query(
      `UPDATE "QRightObject"
       SET "revokedAt" = NOW(), "revokeReason" = $2, "revokeReasonCode" = $3
       WHERE "id" = $1
       RETURNING id, "revokedAt", "revokeReason", "revokeReasonCode"`,
      [id, reason, reasonCodeRaw]
    );

    const actor = auth?.email || auth?.sub || null;
    console.warn(
      `[qright] admin force-revoke id=${id} by=${actor} code=${reasonCodeRaw}`
    );
    recordAudit(actor, "admin.revoke", id, {
      reasonCode: reasonCodeRaw,
      reason,
    });
    triggerRevokeWebhooks(id, {
      revokedAt:
        updated.rows[0].revokedAt instanceof Date
          ? updated.rows[0].revokedAt.toISOString()
          : updated.rows[0].revokedAt,
      reasonCode: reasonCodeRaw,
      reason,
      revokedBy: "admin",
    });

    res.json({
      id: updated.rows[0].id,
      status: "revoked",
      adminAction: true,
      revokedAt: updated.rows[0].revokedAt,
      revokeReason: updated.rows[0].revokeReason,
      revokeReasonCode: updated.rows[0].revokeReasonCode,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Public transparency aggregates — counts only, no PII.
//    Counts are cached for 5 min via Cache-Control.
qrightRouter.get("/transparency", embedRateLimit, async (_req, res) => {
  try {
    await ensureQRightTable();

    const [totals, byCode, byKind] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) AS "total",
          COUNT("revokedAt") AS "revoked",
          MIN("createdAt") AS "first",
          MAX("createdAt") AS "last"
         FROM "QRightObject"`
      ),
      pool.query(
        `SELECT COALESCE("revokeReasonCode", 'unspecified') AS code, COUNT(*) AS n
         FROM "QRightObject"
         WHERE "revokedAt" IS NOT NULL
         GROUP BY 1
         ORDER BY 2 DESC`
      ),
      pool.query(
        `SELECT "kind", COUNT(*) AS n
         FROM "QRightObject"
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 12`
      ),
    ]);

    const t = totals.rows[0] as {
      total: string;
      revoked: string;
      first: Date | string | null;
      last: Date | string | null;
    };
    const totalNum = Number(t.total) || 0;
    const revokedNum = Number(t.revoked) || 0;

    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        registered: totalNum,
        active: totalNum - revokedNum,
        revoked: revokedNum,
        firstRegisteredAt: t.first instanceof Date ? t.first.toISOString() : t.first,
        lastRegisteredAt: t.last instanceof Date ? t.last.toISOString() : t.last,
      },
      revokesByReasonCode: byCode.rows.map((r: { code: string; n: string }) => ({
        code: r.code,
        count: Number(r.n) || 0,
      })),
      registrationsByKind: byKind.rows.map((r: { kind: string; n: string }) => ({
        kind: r.kind,
        count: Number(r.n) || 0,
      })),
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin: read audit log — paginated, filterable by action / targetId.
//    Append-only; no delete endpoint — audit history is the point.
qrightRouter.get("/admin/audit", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
    const action = String(req.query.action || "").trim();
    const targetId = String(req.query.targetId || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (action) {
      params.push(action);
      conds.push(`"action" = $${params.length}`);
    }
    if (targetId) {
      params.push(targetId);
      conds.push(`"targetId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT id, actor, action, "targetId", payload, at
       FROM "QRightAuditLog"
       ${where}
       ORDER BY "at" DESC
       LIMIT $${params.length}`,
      params
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: result.rowCount,
      filter: { action: action || null, targetId: targetId || null, limit },
      items: result.rows.map(
        (r: { id: string; actor: string | null; action: string; targetId: string | null; payload: unknown; at: Date | string }) => ({
          id: r.id,
          actor: r.actor,
          action: r.action,
          targetId: r.targetId,
          payload: r.payload,
          at: r.at instanceof Date ? r.at.toISOString() : r.at,
        })
      ),
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin per-source breakdown — aggregated topSources across ALL objects
//    Useful for abuse detection: which third-party hosts are loading the
//    most badges, and how many distinct works they're scraping. Owner-only
//    topSources (in /objects/:id/stats) shows the same for one work; this
//    rolls them up. Privacy is preserved by reusing the same hostname-only
//    bucket from QRightFetchSource (no path/UA/IP).
qrightRouter.get("/admin/sources", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!isQRightAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const daysRaw = parseInt(String(req.query.days || "30"), 10);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

    // Group by sourceHost over the window. Per-row UNIQUE objectId count tells
    // operators whether a host is scraping one work hard or many works thinly.
    const result = await pool.query(
      `SELECT "sourceHost",
              SUM("fetches")::bigint AS total,
              COUNT(DISTINCT "objectId")::int AS objects
       FROM "QRightFetchSource"
       WHERE "day" >= (CURRENT_DATE - ($1::int * INTERVAL '1 day'))
       GROUP BY "sourceHost"
       ORDER BY total DESC
       LIMIT $2`,
      [days, limit]
    );

    const rows = result.rows.map(
      (r: { sourceHost: string; total: string | number; objects: number }) => ({
        host: r.sourceHost,
        totalFetches: Number(r.total) || 0,
        uniqueObjects: Number(r.objects) || 0,
      })
    );
    const totalFetches = rows.reduce(
      (acc: number, r: { totalFetches: number }) => acc + r.totalFetches,
      0
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      days,
      windowStart: new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10),
      windowEnd: new Date().toISOString().slice(0, 10),
      uniqueHosts: rows.length,
      totalFetches,
      hosts: rows,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Admin probe — lets the frontend /admin/qright check role without leaking data
qrightRouter.get("/admin/whoami", async (req, res) => {
  const auth = verifyBearerOptional(req);
  res.json({
    isAdmin: isQRightAdmin(auth),
    email: auth?.email || null,
    role: auth?.role || null,
  });
});

// 🔹 Revoke — POST /revoke/:id
//    Owner-only. Marks the object as revoked; embed/badge surfaces flip red.
//    Original record is kept (regulatory: revocation is a public event, not a delete).
qrightRouter.post("/revoke/:id", async (req, res) => {
  try {
    await ensureQRightTable();

    const auth = verifyBearerOptional(req);
    if (!auth) {
      return res.status(401).json({ error: "Bearer token required" });
    }

    const id = String(req.params.id);
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "").trim();
    const reasonCode = reasonCodeRaw || null;
    if (reasonCode && !REVOKE_REASON_CODES.has(reasonCode)) {
      return res.status(400).json({
        error: "Unknown reasonCode",
        allowed: Array.from(REVOKE_REASON_CODES),
      });
    }

    const owned = await pool.query(
      `SELECT "id", "ownerUserId", "ownerEmail", "revokedAt"
       FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    if (owned.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = owned.rows[0] as {
      id: string;
      ownerUserId: string | null;
      ownerEmail: string | null;
      revokedAt: Date | string | null;
    };

    const isOwner =
      (row.ownerUserId && row.ownerUserId === auth.sub) ||
      (!row.ownerUserId && row.ownerEmail && row.ownerEmail === auth.email);
    if (!isOwner) {
      return res.status(403).json({ error: "Not the owner of this object" });
    }

    if (row.revokedAt) {
      return res.status(409).json({ error: "Already revoked", revokedAt: row.revokedAt });
    }

    const updated = await pool.query(
      `UPDATE "QRightObject"
       SET "revokedAt" = NOW(), "revokeReason" = $2, "revokeReasonCode" = $3
       WHERE "id" = $1
       RETURNING id, "revokedAt", "revokeReason", "revokeReasonCode"`,
      [id, reason, reasonCode]
    );

    recordAudit(auth.email || auth.sub || null, "owner.revoke", id, {
      reasonCode,
      reason,
    });
    triggerRevokeWebhooks(id, {
      revokedAt:
        updated.rows[0].revokedAt instanceof Date
          ? updated.rows[0].revokedAt.toISOString()
          : updated.rows[0].revokedAt,
      reasonCode,
      reason,
      revokedBy: "owner",
    });

    res.json({
      id: updated.rows[0].id,
      status: "revoked",
      revokedAt: updated.rows[0].revokedAt,
      revokeReason: updated.rows[0].revokeReason,
      revokeReasonCode: updated.rows[0].revokeReasonCode,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});

// 🔹 Owner: list my webhooks. Secret is intentionally redacted on read —
//    we only show "secretPrefix" so the owner can recognize the row.
qrightRouter.get("/webhooks", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const result = await pool.query(
      `SELECT "id", "url", "secret", "createdAt", "lastDeliveredAt", "lastFailedAt", "lastError"
       FROM "QRightWebhook"
       WHERE "ownerUserId" = $1
       ORDER BY "createdAt" DESC`,
      [auth.sub]
    );
    res.json({
      total: result.rowCount,
      items: result.rows.map(
        (r: {
          id: string;
          url: string;
          secret: string;
          createdAt: Date | string;
          lastDeliveredAt: Date | string | null;
          lastFailedAt: Date | string | null;
          lastError: string | null;
        }) => ({
          id: r.id,
          url: r.url,
          secretPrefix: r.secret.slice(0, 6),
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          lastDeliveredAt:
            r.lastDeliveredAt instanceof Date
              ? r.lastDeliveredAt.toISOString()
              : r.lastDeliveredAt,
          lastFailedAt:
            r.lastFailedAt instanceof Date ? r.lastFailedAt.toISOString() : r.lastFailedAt,
          lastError: r.lastError,
        })
      ),
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 Owner: register a webhook. Secret is generated server-side (32 hex chars)
//    and returned ONCE in the response — receivers store it to verify the
//    HMAC-SHA256 signature on incoming events. Subsequent /webhooks reads
//    only show secretPrefix; lose the secret → delete + re-create.
qrightRouter.post("/webhooks", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url required" });
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "url must be a valid absolute URL" });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return res.status(400).json({ error: "url must be http:// or https://" });
    }
    if (url.length > 500) {
      return res.status(400).json({ error: "url too long (max 500 chars)" });
    }

    // Cap webhooks per owner so a runaway integration can't fan out
    // hundreds of POSTs per revoke event.
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "QRightWebhook" WHERE "ownerUserId" = $1`,
      [auth.sub]
    );
    if ((count.rows[0]?.n || 0) >= 10) {
      return res.status(400).json({ error: "Webhook limit reached (10 per owner)" });
    }

    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(16).toString("hex");
    await pool.query(
      `INSERT INTO "QRightWebhook" ("id", "ownerUserId", "url", "secret")
       VALUES ($1, $2, $3, $4)`,
      [id, auth.sub, url, secret]
    );

    res.status(201).json({
      id,
      url,
      secret,
      createdAt: new Date().toISOString(),
      hint: "Store the secret now — it will not be shown again. Verify deliveries by recomputing HMAC-SHA256(secret, requestBody) and comparing against the X-AEVION-Signature header.",
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 Owner: delete a webhook. 404 if it doesn't belong to the caller —
//    we treat "not found" and "not yours" identically so a third party
//    can't probe webhook IDs.
qrightRouter.delete("/webhooks/:id", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const id = String(req.params.id);
    const result = await pool.query(
      `DELETE FROM "QRightWebhook" WHERE "id" = $1 AND "ownerUserId" = $2`,
      [id, auth.sub]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ id, deleted: true });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 PATCH /webhooks/:id — edit URL without re-creating (which would
//    rotate the secret and invalidate any HMAC verification on the
//    receiver's side). Only the URL is mutable; secret stays put. 404
//    masks "not yours" identically to "not found" so ids can't be probed.
qrightRouter.patch("/webhooks/:id", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const id = String(req.params.id);
    const url = String(req.body?.url || "").trim();
    if (!url || url.length > 500) {
      return res.status(400).json({ error: "url required (≤ 500 chars)" });
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "url must start with http:// or https://" });
    }

    const result = await pool.query(
      `UPDATE "QRightWebhook"
         SET "url" = $1
       WHERE "id" = $2 AND "ownerUserId" = $3
       RETURNING "id", "url"`,
      [url, id, auth.sub]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ id: result.rows[0].id, url: result.rows[0].url, updated: true });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /webhooks/:id/deliveries — list recent attempts. Owner-scoped.
//    Default 50, max 200. Returns the raw requestBody so the owner can
//    diff what they sent vs what the receiver expected (or feed it into
//    a manual signature check).
qrightRouter.get("/webhooks/:id/deliveries", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const id = String(req.params.id);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    // Ownership check via JOIN — we don't expose deliveries for someone
    // else's webhook even if the caller knows the webhookId.
    const own = await pool.query(
      `SELECT "id" FROM "QRightWebhook" WHERE "id" = $1 AND "ownerUserId" = $2 LIMIT 1`,
      [id, auth.sub]
    );
    if (own.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const result = await pool.query(
      `SELECT "id", "objectId", "eventType", "requestBody", "statusCode", "ok", "error", "deliveredAt", "isRetry"
       FROM "QRightWebhookDelivery"
       WHERE "webhookId" = $1
       ORDER BY "deliveredAt" DESC
       LIMIT $2`,
      [id, limit]
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      webhookId: id,
      total: result.rowCount,
      items: result.rows.map(
        (r: {
          id: string;
          objectId: string | null;
          eventType: string;
          requestBody: string;
          statusCode: number | null;
          ok: boolean;
          error: string | null;
          deliveredAt: Date | string;
          isRetry: boolean;
        }) => ({
          id: r.id,
          objectId: r.objectId,
          eventType: r.eventType,
          requestBody: r.requestBody,
          statusCode: r.statusCode,
          ok: r.ok,
          error: r.error,
          deliveredAt:
            r.deliveredAt instanceof Date ? r.deliveredAt.toISOString() : r.deliveredAt,
          isRetry: r.isRetry,
        })
      ),
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 POST /webhooks/:id/retry/:deliveryId — re-issue the same body the
//    original attempt used. Preserves HMAC signature semantics so
//    receivers using idempotency keys can dedup. Only the owner can retry.
qrightRouter.post("/webhooks/:id/retry/:deliveryId", async (req, res) => {
  try {
    await ensureQRightTable();
    const auth = verifyBearerOptional(req);
    if (!auth) return res.status(401).json({ error: "Bearer token required" });

    const webhookId = String(req.params.id);
    const deliveryId = String(req.params.deliveryId);

    // One JOIN to fetch both the (owner-scoped) webhook AND the original
    // delivery payload — saves a round-trip and keeps the ownership gate
    // tight (the WHERE filters on ownerUserId).
    const lookup = await pool.query(
      `SELECT w."id" AS "webhookId", w."url", w."secret",
              d."requestBody", d."eventType", d."objectId"
       FROM "QRightWebhook" w
       JOIN "QRightWebhookDelivery" d
         ON d."webhookId" = w."id"
       WHERE w."id" = $1 AND w."ownerUserId" = $2 AND d."id" = $3
       LIMIT 1`,
      [webhookId, auth.sub, deliveryId]
    );
    if (lookup.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = lookup.rows[0] as {
      webhookId: string;
      url: string;
      secret: string;
      requestBody: string;
      eventType: string;
      objectId: string | null;
    };

    const result = await attemptWebhookDelivery({
      webhookId: row.webhookId,
      url: row.url,
      secret: row.secret,
      body: row.requestBody,
      eventType: row.eventType,
      objectId: row.objectId,
      isRetry: true,
    });

    res.json({
      webhookId,
      retriedDeliveryId: deliveryId,
      ok: result.ok,
      statusCode: result.statusCode,
      error: result.error,
    });
  } catch (err: any) {
    captureQrightError(err, { route: "DB error" });
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 3 amplifier — index OG, sitemap, per-object RSS
// (Per-object OG is already provided by frontend/.../opengraph-image.tsx
//  so we don't duplicate it here.)
// ─────────────────────────────────────────────────────────────────────────

function qrEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 🔹 GET /og.svg — index card. Pulls live counters so a paste of /qright
//    reflects current state.
qrightRouter.get("/og.svg", embedRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const totals = await pool.query(
      `SELECT COUNT(*) AS "total", COUNT("revokedAt") AS "revoked" FROM "QRightObject"`
    );
    const t = totals.rows[0] as { total: string; revoked: string };
    const total = Number(t.total) || 0;
    const revoked = Number(t.revoked) || 0;
    const active = total - revoked;
    if (applyOgEtag(req, res, `qright-index-${total}-${active}-${revoked}`)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#0e7490"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0d9488"/>
      <stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QRIGHT</text>
    <text x="60" y="200" font-size="96" font-weight="900" letter-spacing="-2">${qrEsc(String(total))} registrations</text>
    <text x="60" y="252" font-size="32" font-weight="600" fill="#cbd5e1">Independent IP registry — provable, instant, ownerless.</text>
    <g transform="translate(60, 380)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <g>
        <rect width="220" height="80" rx="14" fill="#0d9488" fill-opacity="0.15" stroke="#0d9488" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#5eead4">${qrEsc(String(active))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#a5f3fc">ACTIVE</text>
      </g>
      <g transform="translate(240, 0)">
        <rect width="220" height="80" rx="14" fill="#dc2626" fill-opacity="0.15" stroke="#dc2626" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#fca5a5">${qrEsc(String(revoked))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#fecaca">REVOKED</text>
      </g>
    </g>
    <text x="60" y="585" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.tech / qright</text>
  </g>
</svg>`;

    res.send(svg);
  } catch (err: any) {
    captureQrightError(err, { route: "index og" });
    res.status(500).json({ error: "index og failed", details: err.message });
  }
});

// 🔹 GET /objects/:id/changelog.rss — RSS 2.0 of audit events for one
//    QRight object. Sourced from QRightAuditLog with targetId === id.
qrightRouter.get("/objects/:id/changelog.rss", embedRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();
    const id = String(req.params.id);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const selfUrl = `${proto}://${host}/api/qright/objects/${encodeURIComponent(id)}/changelog.rss`;
    const siteUrl = `${proto}://${host}/qright/object/${encodeURIComponent(id)}`;

    const objRow = await pool.query(
      `SELECT "title" FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );
    const objTitle = objRow.rows[0]?.title || id;

    const r = await pool.query(
      `SELECT "id","actor","action","payload","at"
       FROM "QRightAuditLog"
       WHERE "targetId" = $1
       ORDER BY "at" DESC
       LIMIT $2`,
      [id, limit]
    );

    const latestAt = r.rows[0]?.at;
    const latestMs = latestAt instanceof Date ? latestAt.getTime() : (latestAt ? new Date(latestAt).getTime() : 0);
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `qright-object-${id}-${r.rows.length}-${latestMs}`, { prefix: "rss" })) return;

    function describe(row: any): string {
      const p = row.payload || {};
      const reason = p.reason ? ` — ${p.reason}` : "";
      const actor = row.actor ? ` by ${row.actor}` : "";
      switch (row.action) {
        case "object.revoke":
        case "admin.revoke":
          return `Revoked${actor}${reason}`;
        case "object.create":
          return `Registered${actor}`;
        default:
          return `${row.action || "QRight event"}${actor}`;
      }
    }

    const items = r.rows
      .map((row: any) => {
        const at = row.at instanceof Date ? row.at : new Date(row.at);
        const pubDate = at.toUTCString();
        const summary = describe(row);
        const title = `${objTitle} — ${summary}`;
        const guid = `aevion-qright-${row.id}`;
        return `    <item>
      <title>${qrEsc(title)}</title>
      <link>${qrEsc(siteUrl)}</link>
      <guid isPermaLink="false">${qrEsc(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${qrEsc(summary)}</description>
    </item>`;
      })
      .join("\n");

    const lastBuild = r.rows[0]
      ? (r.rows[0].at instanceof Date ? r.rows[0].at : new Date(r.rows[0].at)).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEVION QRight · ${qrEsc(String(objTitle))} — events</title>
    <link>${qrEsc(siteUrl)}</link>
    <atom:link href="${qrEsc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Audit events for AEVION QRight object ${qrEsc(id)}.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.send(xml);
  } catch (err: any) {
    captureQrightError(err, { route: "object rss" });
    res.status(500).json({ error: "object rss failed", details: err.message });
  }
});

// 🔹 GET /sitemap.xml — sitemap for the QRight surface. Covers /qright,
//    /qright/transparency, and a page per non-revoked object.
qrightRouter.get("/sitemap.xml", embedRateLimit, async (req, res) => {
  try {
    await ensureQRightTable();
    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const origin = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);

    const r = await pool.query(
      `SELECT "id","createdAt"
       FROM "QRightObject"
       WHERE "revokedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 5000`
    );

    const rows = r.rows as any[];
    const latestSrc = rows[0]?.createdAt;
    const latestMs = latestSrc instanceof Date ? latestSrc.getTime() : (latestSrc ? new Date(latestSrc).getTime() : 0);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (applyEtag(req, res, `qright-${rows.length}-${latestMs}-${today}`, { prefix: "sitemap", maxAgeSec: 600 })) return;

    const urls: string[] = [];
    urls.push(`  <url>
    <loc>${qrEsc(origin)}/qright</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
    urls.push(`  <url>
    <loc>${qrEsc(origin)}/qright/transparency</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
    for (const row of rows) {
      const lastmodSrc = row.createdAt;
      const lastmod = lastmodSrc
        ? (lastmodSrc instanceof Date ? lastmodSrc.toISOString() : String(lastmodSrc)).slice(0, 10)
        : today;
      urls.push(`  <url>
    <loc>${qrEsc(origin)}/qright/object/${qrEsc(String(row.id))}</loc>
    <lastmod>${qrEsc(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.send(xml);
  } catch (err: any) {
    captureQrightError(err, { route: "sitemap" });
    res.status(500).json({ error: "sitemap failed", details: err.message });
  }
});
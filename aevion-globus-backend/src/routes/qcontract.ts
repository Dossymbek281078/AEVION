import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";

export const qcontractRouter = Router();

// ── Table bootstrap ──────────────────────────────────────────────────────────

let tablesReady = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qcontract_documents (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL,
        title         TEXT NOT NULL,
        content       TEXT NOT NULL,
        content_type  TEXT NOT NULL DEFAULT 'text',
        access_token  TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        max_views     INTEGER,
        expires_at    TIMESTAMPTZ,
        view_count    INTEGER NOT NULL DEFAULT 0,
        revoked_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qc_docs_owner ON qcontract_documents (owner_id);
      CREATE INDEX IF NOT EXISTS idx_qc_docs_token ON qcontract_documents (access_token);

      CREATE TABLE IF NOT EXISTS qcontract_views (
        id          TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        viewer_ip   TEXT,
        viewer_ua   TEXT,
        viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qc_views_doc ON qcontract_views (document_id, viewed_at DESC);
    `);
    tablesReady = true;
  } catch (err) {
    console.warn("[qcontract] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex");
}

function isExpired(row: { expires_at?: Date | null; max_views?: number | null; view_count: number; revoked_at?: Date | null }): boolean {
  if (row.revoked_at) return true;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return true;
  if (row.max_views != null && row.view_count >= row.max_views) return true;
  return false;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/qcontract/documents — create document (auth required)
qcontractRouter.post("/documents", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const {
    title,
    content,
    contentType = "text",
    password,
    maxViews,
    expiresAt,
  } = req.body as {
    title?: string;
    content?: string;
    contentType?: "text" | "url" | "html";
    password?: string;
    maxViews?: number;
    expiresAt?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title_required" });
  if (!content?.trim()) return res.status(400).json({ error: "content_required" });

  const id = randomUUID();
  const accessToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const passwordHash = password ? hashPassword(password) : null;
  const pool = getPool();

  await pool.query(
    `INSERT INTO qcontract_documents
       (id, owner_id, title, content, content_type, access_token, password_hash, max_views, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      auth.sub ?? auth.email ?? "unknown",
      title.trim(),
      content.trim(),
      contentType,
      accessToken,
      passwordHash,
      maxViews ?? null,
      expiresAt ?? null,
    ],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  res.status(201).json({
    id,
    accessToken,
    shareUrl: `${frontendBase}/qcontract/v/${accessToken}`,
  });
});

// GET /api/qcontract/documents — list my documents (auth required)
qcontractRouter.get("/documents", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";
  const result = await pool.query(
    `SELECT id, title, content_type, max_views, view_count, expires_at, revoked_at, created_at,
            (password_hash IS NOT NULL) as has_password,
            access_token
     FROM qcontract_documents
     WHERE owner_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [ownerId],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  res.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: result.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      contentType: r.content_type,
      maxViews: r.max_views,
      viewCount: r.view_count,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      hasPassword: r.has_password,
      expired: isExpired({ expires_at: r.expires_at, max_views: r.max_views, view_count: r.view_count, revoked_at: r.revoked_at }),
      shareUrl: `${frontendBase}/qcontract/v/${r.access_token}`,
      createdAt: r.created_at,
    })),
    total: result.rowCount ?? 0,
  });
});

// DELETE /api/qcontract/documents/:id — revoke (owner only)
qcontractRouter.delete("/documents/:id", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";
  const result = await pool.query(
    `UPDATE qcontract_documents SET revoked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND owner_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [req.params.id, ownerId],
  );

  if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_already_revoked" });
  res.json({ ok: true, revokedAt: new Date().toISOString() });
});

// GET /api/qcontract/documents/:id/log — view log (owner only)
qcontractRouter.get("/documents/:id/log", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";

  const doc = await pool.query(
    "SELECT id, title, view_count FROM qcontract_documents WHERE id = $1 AND owner_id = $2",
    [req.params.id, ownerId],
  );
  if (!doc.rows[0]) return res.status(404).json({ error: "not_found" });

  const views = await pool.query(
    "SELECT id, viewer_ip, viewer_ua, viewed_at FROM qcontract_views WHERE document_id = $1 ORDER BY viewed_at DESC LIMIT 100",
    [req.params.id],
  );

  res.json({
    documentId: req.params.id,
    title: doc.rows[0].title,
    viewCount: doc.rows[0].view_count,
    views: views.rows,
  });
});

// POST /api/qcontract/view/:token — record view + return content (public)
qcontractRouter.post("/view/:token", async (req, res) => {
  await ensureTables();
  const pool = getPool();
  const { password } = req.body as { password?: string };

  const result = await pool.query(
    `SELECT id, title, content, content_type, password_hash, max_views,
            view_count, expires_at, revoked_at
     FROM qcontract_documents WHERE access_token = $1`,
    [req.params.token],
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: "document_not_found" });

  if (isExpired(doc)) {
    return res.status(410).json({ error: "document_expired", title: doc.title });
  }

  if (doc.password_hash) {
    if (!password) return res.status(401).json({ error: "password_required", title: doc.title });
    if (hashPassword(password) !== doc.password_hash) {
      return res.status(403).json({ error: "wrong_password" });
    }
  }

  // Record view + increment count atomically
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
  const ua = req.headers["user-agent"] ?? null;
  await pool.query(
    `INSERT INTO qcontract_views (id, document_id, viewer_ip, viewer_ua) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), doc.id, ip, ua],
  );
  await pool.query(
    `UPDATE qcontract_documents SET view_count = view_count + 1, updated_at = NOW() WHERE id = $1`,
    [doc.id],
  );

  const newCount = doc.view_count + 1;
  const isLastView = doc.max_views != null && newCount >= doc.max_views;

  res.json({
    title: doc.title,
    content: doc.content,
    contentType: doc.content_type,
    viewCount: newCount,
    maxViews: doc.max_views,
    expiresAt: doc.expires_at,
    selfDestructed: isLastView,
  });
});

// GET /api/qcontract/view/:token — meta only (no content, no view recorded)
qcontractRouter.get("/view/:token", async (req, res) => {
  await ensureTables();
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, content_type, max_views, view_count, expires_at, revoked_at,
            (password_hash IS NOT NULL) as has_password
     FROM qcontract_documents WHERE access_token = $1`,
    [req.params.token],
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: "document_not_found" });

  res.json({
    id: doc.id,
    title: doc.title,
    contentType: doc.content_type,
    maxViews: doc.max_views,
    viewCount: doc.view_count,
    expiresAt: doc.expires_at,
    hasPassword: doc.has_password,
    expired: isExpired(doc),
  });
});

// GET /api/qcontract/stats — public aggregate counts
qcontractRouter.get("/stats", async (_req, res) => {
  await ensureTables();
  try {
    const pool = getPool();
    const [docs, views] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM qcontract_documents"),
      pool.query("SELECT COUNT(*) AS n FROM qcontract_views"),
    ]);
    res.json({
      totalDocuments: Number(docs.rows[0]?.n ?? 0),
      totalViews: Number(views.rows[0]?.n ?? 0),
    });
  } catch {
    res.json({ totalDocuments: 0, totalViews: 0 });
  }
});

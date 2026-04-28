import { Router } from "express";
import crypto from "crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";

export const qrightRouter = Router();

const pool = getPool();

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

  ensuredTable = true;
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
              q."createdAt", q."revokedAt", q."revokeReason",
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
      certificateId: string | null;
    };

    const createdAtMs =
      row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
    const revokedAtMs = row.revokedAt
      ? row.revokedAt instanceof Date
        ? row.revokedAt.getTime()
        : new Date(row.revokedAt).getTime()
      : 0;
    // ETag must change on revoke so cached badges flip without manual purge.
    const etag = `W/"qright-embed-${row.id}-${createdAtMs}-${revokedAtMs}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }

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
      certificateId: row.certificateId,
      verifyUrl: row.certificateId
        ? `/verify/${row.certificateId}`
        : `/qright/object/${row.id}`,
    });
  } catch (err: any) {
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
      `SELECT id, kind, "createdAt", "revokedAt"
       FROM "QRightObject" WHERE "id" = $1 LIMIT 1`,
      [id]
    );

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
    const etag = `W/"qright-badge-${row.id}-${createdAt.getTime()}-${revokedAtMs}-${theme}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }

    const dateLabel = createdAt.toISOString().slice(0, 10);

    if (row.revokedAt) {
      // Revoked: keep the badge so the third-party site doesn't 404, but
      // visibly flip it red — the integrity guarantee no longer holds.
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(svgShell("AEVION QRIGHT", `REVOKED · ${dateLabel}`, "#dc2626"));
    }

    const right = `${row.kind.toUpperCase()} · ${dateLabel}`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION QRIGHT", right, "#0d9488"));
  } catch (err: any) {
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
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
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
       SET "revokedAt" = NOW(), "revokeReason" = $2
       WHERE "id" = $1
       RETURNING id, "revokedAt", "revokeReason"`,
      [id, reason]
    );

    res.json({
      id: updated.rows[0].id,
      status: "revoked",
      revokedAt: updated.rows[0].revokedAt,
      revokeReason: updated.rows[0].revokeReason,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "DB error",
      code: err.code,
      name: err.name,
      details: err.message,
    });
  }
});
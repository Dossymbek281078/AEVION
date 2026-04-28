import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional, type JwtPayload } from "../lib/authJwt";
import { ensureQSignV2Tables } from "../lib/qsignV2/ensureTables";
import { canonicalJson, sha256Hex, CANONICALIZATION_SPEC } from "../lib/qsignV2/canonicalize";
import { resolveGeo, extractClientIp as _extractClientIpImpl } from "../lib/qsignV2/geo";
import {
  getActiveHmac,
  getActiveEd25519,
  resolveHmac,
  resolveEd25519,
  getKeyByKid,
  listKeys,
  getActiveKey,
} from "../lib/qsignV2/keyRegistry";
import type { QSignVerifyResult } from "../lib/qsignV2/types";
import { fireWebhooksFor } from "../lib/qsignV2/webhooks";

/* ───────── rate limits ─────────
 * Per-IP token-bucket style windows guarding the two expensive write paths.
 * Limits are deliberately generous for legitimate UI use but cheap to defend
 * against scripted abuse. Both respect x-forwarded-for via express trust proxy
 * when configured at the app level.
 */
const signLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    endpoint: "/sign",
    limit: "60 requests per minute per IP",
  },
});

const revokeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    endpoint: "/revoke/:id",
    limit: "10 requests per minute per IP",
  },
});

const rotateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit_exceeded",
    endpoint: "/keys/rotate",
    limit: "5 requests per minute per IP",
  },
});

/**
 * QSign v2 — Unique Digital Signature Platform
 *
 * Endpoints (this phase):
 *   POST   /api/qsign/v2/sign          auth required; returns persisted signature
 *   POST   /api/qsign/v2/verify        stateless verify by { payload, signature }
 *   GET    /api/qsign/v2/verify/:id    DB verify by signatureId
 *   GET    /api/qsign/v2/:id/public    public JSON view for shareable verify page
 *   GET    /api/qsign/v2/health        probe
 *
 * Independent of v1 (/api/qsign/sign|verify), pipeline.ts and planetCompliance.ts.
 */

export const qsignV2Router = Router();
const pool = getPool();

const ALGO_VERSION = "qsign-v2.0";

/* ───────── helpers ───────── */

function requireAuth(req: Request, res: Response): JwtPayload | null {
  const payload = verifyBearerOptional(req);
  if (!payload) {
    res.status(401).json({ error: "missing or invalid bearer token" });
    return null;
  }
  return payload;
}

function signHmac(secret: Buffer, canonical: string): string {
  return crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

function signEd25519Hex(privateKey: crypto.KeyObject, canonical: string): string {
  return crypto.sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("hex");
}

function verifyEd25519Hex(
  publicKeyHex: string,
  canonical: string,
  signatureHex: string,
): boolean {
  try {
    if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) return false;
    if (!/^[0-9a-fA-F]+$/.test(signatureHex)) return false;
    const raw = Buffer.from(publicKeyHex, "hex");
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, raw]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(canonical, "utf8"), publicKey, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

function constantTimeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/* ───────── Dilithium preview slot (post-quantum reservation) ─────────
 * Real ML-DSA (Dilithium) requires a WASM-bound PQClean impl which is on the
 * roadmap but out of scope for v2. To reserve the API surface and prevent
 * future breaking changes, every signature ships with a deterministic
 * SHA-512 fingerprint of (canonical || kid). It is NOT a cryptographic
 * signature — clients use it to (a) confirm the slot was emitted at sign
 * time and (b) round-trip integrity-check the canonical payload against the
 * server's view of it. v2.1 will replace `digest` with `signature` + add
 * `publicKey`, leaving the same JSON shape.
 */
const DILITHIUM_PREVIEW_KID = "qsign-dilithium-mldsa65-preview-v1";
const DILITHIUM_PREVIEW_NOTE =
  "Preview slot reserved for ML-DSA-65 (Dilithium-3) post-quantum signatures. The `digest` field is a deterministic SHA-512 fingerprint of canonical||kid — NOT a cryptographic signature. v2.1 will add real `signature` + `publicKey`.";

function dilithiumPreviewDigest(canonical: string): string {
  return crypto
    .createHash("sha512")
    .update(canonical, "utf8")
    .update("|", "utf8")
    .update(DILITHIUM_PREVIEW_KID, "utf8")
    .digest("hex");
}

type DilithiumPreviewBlock = {
  algo: "ML-DSA-65";
  kid: string;
  mode: "preview";
  digest: string;
  valid: boolean | null;
  note: string;
};

function dilithiumPreviewBlock(canonical: string, validOverride?: boolean | null): DilithiumPreviewBlock {
  return {
    algo: "ML-DSA-65",
    kid: DILITHIUM_PREVIEW_KID,
    mode: "preview",
    digest: dilithiumPreviewDigest(canonical),
    valid: validOverride === undefined ? true : validOverride,
    note: DILITHIUM_PREVIEW_NOTE,
  };
}

/**
 * For DB-backed verifies: row.signatureDilithium may be null (legacy rows pre-preview),
 * a hex digest (post-preview rows), or anything else. We re-derive the expected digest
 * from the stored canonical payload + kid and compare constant-time. Returns null when
 * the column is null (legacy), otherwise a block with valid:true|false.
 */
function dilithiumPreviewFromRow(row: any): DilithiumPreviewBlock | null {
  if (!row || typeof row.signatureDilithium !== "string" || !row.signatureDilithium) {
    return null;
  }
  const stored = row.signatureDilithium;
  const expected = dilithiumPreviewDigest(row.payloadCanonical);
  const valid = constantTimeEqHex(stored, expected);
  return {
    algo: "ML-DSA-65",
    kid: DILITHIUM_PREVIEW_KID,
    mode: "preview",
    digest: stored,
    valid,
    note: DILITHIUM_PREVIEW_NOTE,
  };
}

// Re-exported from lib/qsignV2/geo.ts so downstream routes can reuse the helper.
const extractClientIp = _extractClientIpImpl;

async function loadSignatureRow(id: string) {
  const r = (await pool.query(`SELECT * FROM "QSignSignature" WHERE "id" = $1`, [id])) as any;
  if (!r.rows.length) return null;
  return r.rows[0];
}

async function loadRevocation(signatureId: string) {
  const r = (await pool.query(
    `SELECT * FROM "QSignRevocation" WHERE "signatureId" = $1`,
    [signatureId],
  )) as any;
  if (!r.rows.length) return null;
  return r.rows[0];
}

/* ───────── health ───────── */

qsignV2Router.get("/health", async (_req, res) => {
  try {
    await ensureQSignV2Tables(pool);
    const hmac = await getActiveHmac();
    const ed = await getActiveEd25519();
    res.json({
      status: "ok",
      service: "qsign-v2",
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      activeKeys: {
        hmac: hmac.kid,
        ed25519: ed.kid,
      },
    });
  } catch (e: any) {
    res.status(500).json({ status: "error", error: e?.message || String(e) });
  }
});

/* ───────── GET /stats (public metrics) ─────────
 * Aggregates used by the Studio hero and investor-facing widgets.
 * Deliberately public (no auth) — exposes only counts and coarse geo labels,
 * never payloads or issuer identities.
 */

qsignV2Router.get("/stats", async (_req, res) => {
  try {
    await ensureQSignV2Tables(pool);

    const totalsQ = (await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN "revokedAt" IS NULL THEN 1 ELSE 0 END)::int AS active,
         SUM(CASE WHEN "revokedAt" IS NOT NULL THEN 1 ELSE 0 END)::int AS revoked,
         COUNT(DISTINCT "issuerUserId")::int AS unique_issuers,
         COUNT(DISTINCT "geoCountry") FILTER (WHERE "geoCountry" IS NOT NULL)::int AS unique_countries
       FROM "QSignSignature"`,
    )) as any;

    const last24Q = (await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM "QSignSignature"
       WHERE "createdAt" >= NOW() - INTERVAL '24 hours'`,
    )) as any;

    const countriesQ = (await pool.query(
      `SELECT "geoCountry" AS country, COUNT(*)::int AS n
       FROM "QSignSignature"
       WHERE "geoCountry" IS NOT NULL
       GROUP BY "geoCountry"
       ORDER BY n DESC
       LIMIT 10`,
    )) as any;

    const keysQ = (await pool.query(
      `SELECT "algo", "status", COUNT(*)::int AS n
       FROM "QSignKey"
       GROUP BY "algo", "status"`,
    )) as any;

    const keysByAlgo: Record<string, { active: number; retired: number }> = {
      "HMAC-SHA256": { active: 0, retired: 0 },
      Ed25519: { active: 0, retired: 0 },
    };
    for (const row of keysQ.rows || []) {
      if (!keysByAlgo[row.algo]) keysByAlgo[row.algo] = { active: 0, retired: 0 };
      if (row.status === "active") keysByAlgo[row.algo].active = row.n;
      else if (row.status === "retired") keysByAlgo[row.algo].retired = row.n;
    }

    const totals = totalsQ.rows?.[0] || {};
    res.json({
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      signatures: {
        total: totals.total ?? 0,
        active: totals.active ?? 0,
        revoked: totals.revoked ?? 0,
        last24h: last24Q.rows?.[0]?.n ?? 0,
      },
      issuers: {
        unique: totals.unique_issuers ?? 0,
      },
      geo: {
        uniqueCountries: totals.unique_countries ?? 0,
        topCountries: (countriesQ.rows || []).map((r: any) => ({
          country: r.country,
          count: r.n,
        })),
      },
      keys: keysByAlgo,
      asOf: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[qsign v2] /stats error", e);
    res.status(500).json({ error: "stats_failed", details: e?.message });
  }
});

/* ───────── GET /recent (public sanitized feed) ─────────
 * Returns a minimal, privacy-safe list of the most recent signatures for the
 * public feed on the Studio page. Does NOT leak payloads, signatures, or
 * issuer identities. Country is the only geo field exposed.
 *
 * Query:
 *   limit  1..20 (default 8)
 */

qsignV2Router.get("/recent", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);

    const rawLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 20
        ? Math.floor(rawLimit)
        : 8;

    const r = (await pool.query(
      `SELECT
         "id",
         "algoVersion",
         "hmacKid",
         "ed25519Kid",
         "createdAt",
         "revokedAt",
         "geoCountry"
       FROM "QSignSignature"
       ORDER BY "createdAt" DESC
       LIMIT $1`,
      [limit],
    )) as any;

    const items = (r.rows || []).map((row: any) => ({
      id: row.id,
      algoVersion: row.algoVersion,
      hmacKid: row.hmacKid,
      ed25519Kid: row.ed25519Kid,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      revoked: !!row.revokedAt,
      country: row.geoCountry ?? null,
      publicUrl: `/qsign/verify/${row.id}`,
    }));

    res.json({
      items,
      total: items.length,
      limit,
    });
  } catch (e: any) {
    console.error("[qsign v2] /recent error", e);
    res.status(500).json({ error: "recent_failed", details: e?.message });
  }
});

/* ───────── GET /audit (per-user event log) ─────────
 * Auth required. Returns sign + revoke events touching the caller — either as
 * issuer (sign events on their own signatures, revoke events the caller's
 * signatures received) or as actor (revokes the caller performed). Ordered
 * by event time DESC. Cursor-less; pagination via limit + offset.
 *
 * Query:
 *   limit  1..100 (default 50)
 *   offset 0..    (default 0)
 *   event  "sign" | "revoke" (optional filter)
 *
 * Use case: compliance export, customer-facing activity log, abuse detection.
 */

qsignV2Router.get("/audit", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    await ensureQSignV2Tables(pool);

    const rawLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100
        ? Math.floor(rawLimit)
        : 50;

    const rawOffset = Number(req.query.offset);
    const offset =
      Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

    const eventFilter =
      typeof req.query.event === "string" && (req.query.event === "sign" || req.query.event === "revoke")
        ? (req.query.event as "sign" | "revoke")
        : null;

    const includeSign = eventFilter === null || eventFilter === "sign";
    const includeRevoke = eventFilter === null || eventFilter === "revoke";

    const parts: string[] = [];
    const params: unknown[] = [auth.sub];

    if (includeSign) {
      parts.push(`
        SELECT
          'sign'::text AS event,
          s."id" AS "signatureId",
          NULL::text AS "revocationId",
          s."createdAt" AS at,
          s."hmacKid",
          s."ed25519Kid",
          s."payloadHash",
          s."geoCountry",
          NULL::text AS reason,
          NULL::text AS "causalSignatureId",
          NULL::text AS "revokerUserId",
          s."revokedAt"
        FROM "QSignSignature" s
        WHERE s."issuerUserId" = $1
      `);
    }

    if (includeRevoke) {
      parts.push(`
        SELECT
          'revoke'::text AS event,
          r."signatureId",
          r."id" AS "revocationId",
          r."revokedAt" AS at,
          s."hmacKid",
          s."ed25519Kid",
          s."payloadHash",
          s."geoCountry",
          r."reason",
          r."causalSignatureId",
          r."revokerUserId",
          s."revokedAt"
        FROM "QSignRevocation" r
        JOIN "QSignSignature" s ON s."id" = r."signatureId"
        WHERE s."issuerUserId" = $1 OR r."revokerUserId" = $1
      `);
    }

    if (parts.length === 0) {
      return res.json({ items: [], total: 0, limit, offset, event: eventFilter });
    }

    const unionSql = parts.join("\nUNION ALL\n");
    const sql = `
      WITH events AS (
        ${unionSql}
      )
      SELECT * FROM events
      ORDER BY at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const r = (await pool.query(sql, params)) as any;

    const items = (r.rows || []).map((row: any) => ({
      event: row.event,
      signatureId: row.signatureId,
      revocationId: row.revocationId,
      at: row.at ? new Date(row.at).toISOString() : null,
      hmacKid: row.hmacKid,
      ed25519Kid: row.ed25519Kid,
      payloadHash: row.payloadHash,
      country: row.geoCountry,
      reason: row.reason,
      causalSignatureId: row.causalSignatureId,
      revokerUserId: row.revokerUserId,
      isMine: row.event === "sign" || row.revokerUserId !== auth.sub,
      publicUrl: `/qsign/verify/${row.signatureId}`,
    }));

    res.json({
      items,
      total: items.length,
      limit,
      offset,
      event: eventFilter,
      asOf: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[qsign v2] /audit error", e);
    res.status(500).json({ error: "audit_failed", details: e?.message });
  }
});

/* ───────── POST /sign ───────── */

qsignV2Router.post("/sign", signLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    await ensureQSignV2Tables(pool);

    const body = req.body ?? {};
    const payload = body.payload !== undefined ? body.payload : body;
    if (payload === null || typeof payload !== "object") {
      return res.status(400).json({ error: "payload must be a JSON object or array" });
    }

    let canonical: string;
    let payloadHash: string;
    try {
      canonical = canonicalJson(payload);
      payloadHash = sha256Hex(canonical);
    } catch (e: any) {
      return res.status(400).json({ error: "canonicalization failed", details: e?.message });
    }

    const hmacKey = await getActiveHmac();
    const edKey = await getActiveEd25519();

    const signatureHmac = signHmac(hmacKey.secret, canonical);
    const signatureEd25519 = signEd25519Hex(edKey.privateKey, canonical);
    const dilithiumPreview = dilithiumPreviewBlock(canonical);

    // Geo anchoring: body.gps (explicit client GPS) takes priority; fallback to IP lookup.
    const geo = resolveGeo(body.gps, req);

    const id = crypto.randomUUID();
    await pool.query(
      `
      INSERT INTO "QSignSignature"
        ("id","hmacKid","ed25519Kid",
         "payloadCanonical","payloadHash",
         "signatureHmac","signatureEd25519","signatureDilithium",
         "algoVersion","issuerUserId","issuerEmail",
         "geoLat","geoLng","geoSource","geoCountry","geoCity")
      VALUES ($1,$2,$3, $4,$5, $6,$7,$8, $9,$10,$11, $12,$13,$14,$15,$16)
      `,
      [
        id,
        hmacKey.kid,
        edKey.kid,
        canonical,
        payloadHash,
        signatureHmac,
        signatureEd25519,
        dilithiumPreview.digest,
        ALGO_VERSION,
        auth.sub,
        auth.email,
        geo.lat,
        geo.lng,
        geo.source,
        geo.country,
        geo.city,
      ],
    );

    fireWebhooksFor(auth.sub, "sign", {
      id,
      payloadHash,
      hmacKid: hmacKey.kid,
      ed25519Kid: edKey.kid,
      issuerEmail: auth.email,
    });

    res.status(201).json({
      id,
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      payloadHash,
      payloadCanonical: canonical,
      hmac: {
        kid: hmacKey.kid,
        algo: "HMAC-SHA256",
        signature: signatureHmac,
      },
      ed25519: {
        kid: edKey.kid,
        algo: "Ed25519",
        signature: signatureEd25519,
        publicKey: edKey.publicKeyHex,
      },
      dilithium: dilithiumPreview,
      issuer: { userId: auth.sub, email: auth.email },
      geo: geo.source
        ? {
            source: geo.source,
            country: geo.country,
            city: geo.city,
            lat: geo.lat,
            lng: geo.lng,
          }
        : null,
      createdAt: new Date().toISOString(),
      verifyUrl: `/api/qsign/v2/verify/${id}`,
      publicUrl: `/qsign/verify/${id}`,
    });
  } catch (e: any) {
    console.error("[qsign v2] sign error", e);
    res.status(500).json({ error: "sign_failed", details: e?.message });
  }
});

/* ───────── POST /sign/batch (bulk) ─────────
 * Sign N payloads in one round trip — same auth + same active kids for every item.
 * Body: { items: [<payload1>, <payload2>, ...] }  OR  { items: [{ payload, gps? }, ...] }.
 * Returns: { results: [{ ok, id?, error? }, ...], total, succeeded, failed }.
 * Cap at 50 per call (to keep latency bounded and avoid abuse). Same rate limiter as /sign.
 */

const BATCH_MAX = 50;

qsignV2Router.post("/sign/batch", signLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  try {
    await ensureQSignV2Tables(pool);

    const body = req.body ?? {};
    const itemsRaw: unknown = Array.isArray(body) ? body : body.items;
    if (!Array.isArray(itemsRaw)) {
      return res.status(400).json({ error: "items must be an array of payloads" });
    }
    if (itemsRaw.length === 0) {
      return res.status(400).json({ error: "items must not be empty" });
    }
    if (itemsRaw.length > BATCH_MAX) {
      return res.status(400).json({
        error: "batch_too_large",
        max: BATCH_MAX,
        got: itemsRaw.length,
      });
    }

    const hmacKey = await getActiveHmac();
    const edKey = await getActiveEd25519();
    const fallbackGeo = resolveGeo(undefined, req);
    const results: Array<{ ok: boolean; id?: string; error?: string }> = [];

    for (let idx = 0; idx < itemsRaw.length; idx++) {
      const item = itemsRaw[idx];
      try {
        let payload: unknown;
        let gps: any = undefined;
        if (item && typeof item === "object" && !Array.isArray(item) && "payload" in (item as any)) {
          payload = (item as any).payload;
          gps = (item as any).gps;
        } else {
          payload = item;
        }
        if (payload === null || (typeof payload !== "object" && !Array.isArray(payload))) {
          results.push({ ok: false, error: "payload must be a JSON object or array" });
          continue;
        }

        const canonical = canonicalJson(payload);
        const payloadHash = sha256Hex(canonical);
        const signatureHmac = signHmac(hmacKey.secret, canonical);
        const signatureEd25519 = signEd25519Hex(edKey.privateKey, canonical);
        const dilithiumDigest = dilithiumPreviewDigest(canonical);

        const geo = gps !== undefined ? resolveGeo(gps, req) : fallbackGeo;
        const id = crypto.randomUUID();

        await pool.query(
          `
          INSERT INTO "QSignSignature"
            ("id","hmacKid","ed25519Kid",
             "payloadCanonical","payloadHash",
             "signatureHmac","signatureEd25519","signatureDilithium",
             "algoVersion","issuerUserId","issuerEmail",
             "geoLat","geoLng","geoSource","geoCountry","geoCity")
          VALUES ($1,$2,$3, $4,$5, $6,$7,$8, $9,$10,$11, $12,$13,$14,$15,$16)
          `,
          [
            id,
            hmacKey.kid,
            edKey.kid,
            canonical,
            payloadHash,
            signatureHmac,
            signatureEd25519,
            dilithiumDigest,
            ALGO_VERSION,
            auth.sub,
            auth.email,
            geo.lat,
            geo.lng,
            geo.source,
            geo.country,
            geo.city,
          ],
        );

        fireWebhooksFor(auth.sub, "sign", {
          id,
          payloadHash,
          hmacKid: hmacKey.kid,
          ed25519Kid: edKey.kid,
          issuerEmail: auth.email,
          batchIndex: idx,
        });

        results.push({ ok: true, id });
      } catch (e: any) {
        results.push({ ok: false, error: e?.message || "sign_failed" });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    res.status(succeeded === results.length ? 201 : 207).json({
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      hmacKid: hmacKey.kid,
      ed25519Kid: edKey.kid,
      algoVersion: ALGO_VERSION,
      results,
    });
  } catch (e: any) {
    console.error("[qsign v2] sign/batch error", e);
    res.status(500).json({ error: "batch_sign_failed", details: e?.message });
  }
});

/* ───────── POST /verify (stateless) ─────────
 * Client presents { payload, hmacKid, signatureHmac } and optionally
 * { ed25519Kid, signatureEd25519 } and we recompute. Does NOT require DB row.
 */

qsignV2Router.post("/verify", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);

    const { payload, hmacKid, signatureHmac, ed25519Kid, signatureEd25519 } = req.body || {};

    if (payload === undefined || typeof signatureHmac !== "string" || !signatureHmac) {
      return res.status(400).json({ error: "payload and signatureHmac are required" });
    }

    let canonical: string;
    let payloadHash: string;
    try {
      canonical = canonicalJson(payload);
      payloadHash = sha256Hex(canonical);
    } catch (e: any) {
      return res.status(400).json({ error: "canonicalization failed", details: e?.message });
    }

    const hmacRow = hmacKid ? await resolveHmac(hmacKid) : await getActiveHmac();
    const expectedHmac = signHmac(hmacRow.secret, canonical);
    const hmacValid = constantTimeEqHex(expectedHmac, signatureHmac);

    let edValid: boolean | null = null;
    let edKidOut: string | null = null;
    if (ed25519Kid && typeof signatureEd25519 === "string" && signatureEd25519) {
      const edRow = await getKeyByKid(ed25519Kid);
      if (edRow && edRow.algo === "Ed25519" && edRow.publicKey) {
        edValid = verifyEd25519Hex(edRow.publicKey, canonical, signatureEd25519);
        edKidOut = edRow.kid;
      } else {
        edValid = false;
        edKidOut = ed25519Kid;
      }
    }

    const valid = hmacValid && (edValid === null ? true : edValid);

    const dilithiumDigestIn =
      typeof req.body?.signatureDilithium === "string" ? req.body.signatureDilithium : null;
    const dilithiumExpected = dilithiumPreviewDigest(canonical);
    const dilithiumOut = dilithiumDigestIn
      ? {
          algo: "ML-DSA-65" as const,
          kid: DILITHIUM_PREVIEW_KID,
          mode: "preview" as const,
          digest: dilithiumDigestIn,
          valid: constantTimeEqHex(dilithiumDigestIn, dilithiumExpected),
          note: DILITHIUM_PREVIEW_NOTE,
        }
      : null;

    res.json({
      valid,
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      payloadHash,
      hmac: { kid: hmacRow.kid, valid: hmacValid },
      ed25519: { kid: edKidOut, valid: edValid },
      dilithium: dilithiumOut,
      stateless: true,
    });
  } catch (e: any) {
    console.error("[qsign v2] verify error", e);
    res.status(500).json({ error: "verify_failed", details: e?.message });
  }
});

/* ───────── GET /verify/:id (DB-backed) ───────── */

qsignV2Router.get("/verify/:id", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);

    const row = await loadSignatureRow(req.params.id);
    if (!row) return res.status(404).json({ error: "signature not found" });

    const hmacRow = await resolveHmac(row.hmacKid);
    const expectedHmac = signHmac(hmacRow.secret, row.payloadCanonical);
    const hmacValid = constantTimeEqHex(expectedHmac, row.signatureHmac);

    let edValid: boolean | null = null;
    if (row.ed25519Kid && row.signatureEd25519) {
      const edKey = await getKeyByKid(row.ed25519Kid);
      if (edKey && edKey.publicKey) {
        edValid = verifyEd25519Hex(edKey.publicKey, row.payloadCanonical, row.signatureEd25519);
      } else {
        edValid = false;
      }
    }

    const revocation = await loadRevocation(row.id);

    const revokedAtSrc = row.revokedAt || revocation?.revokedAt || null;
    const revoked = !!revokedAtSrc;
    const valid = hmacValid && (edValid === null ? true : edValid) && !revoked;

    const out: QSignVerifyResult = {
      valid,
      signatureId: row.id,
      algoVersion: row.algoVersion || ALGO_VERSION,
      hmac: { kid: row.hmacKid, valid: hmacValid },
      ed25519: { kid: row.ed25519Kid ?? null, valid: edValid },
      dilithium: dilithiumPreviewFromRow(row),
      revoked,
      revokedAt: revokedAtSrc ? new Date(revokedAtSrc).toISOString() : null,
      revocationReason: revocation?.reason ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      payloadHash: row.payloadHash,
      issuer: {
        userId: row.issuerUserId ?? null,
        email: row.issuerEmail ?? null,
      },
      geo:
        row.geoSource || row.geoLat !== null || row.geoCountry
          ? {
              source: row.geoSource ?? null,
              country: row.geoCountry ?? null,
              city: row.geoCity ?? null,
              lat: row.geoLat ?? null,
              lng: row.geoLng ?? null,
            }
          : null,
    };

    res.json(out);
  } catch (e: any) {
    console.error("[qsign v2] verify/:id error", e);
    res.status(500).json({ error: "verify_failed", details: e?.message });
  }
});

/* ───────── POST /revoke/:id ─────────
 * Add a revocation record and stamp revokedAt on the signature row.
 * The revoker must be the original issuer OR an admin. Revocation is immutable:
 * attempting to revoke an already-revoked signature returns 409 with existing record.
 *
 * Body:
 *   { reason: string (<= 500 chars),
 *     causalSignatureId?: string  // link to a newer signature that supersedes this one }
 */

qsignV2Router.post("/revoke/:id", revokeLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const causalSignatureId =
    typeof req.body?.causalSignatureId === "string" && req.body.causalSignatureId.trim()
      ? req.body.causalSignatureId.trim()
      : null;

  if (!reason) {
    return res.status(400).json({ error: "reason is required" });
  }
  if (reason.length > 500) {
    return res.status(400).json({ error: "reason must be <= 500 chars" });
  }

  try {
    await ensureQSignV2Tables(pool);

    const row = await loadSignatureRow(req.params.id);
    if (!row) return res.status(404).json({ error: "signature not found" });

    const isIssuer = row.issuerUserId && row.issuerUserId === auth.sub;
    const isAdmin = auth.role === "admin";
    if (!isIssuer && !isAdmin) {
      return res
        .status(403)
        .json({ error: "only the original issuer or an admin can revoke this signature" });
    }

    if (causalSignatureId) {
      const causal = await loadSignatureRow(causalSignatureId);
      if (!causal) {
        return res
          .status(400)
          .json({ error: `causalSignatureId '${causalSignatureId}' not found` });
      }
      if (causal.id === row.id) {
        return res.status(400).json({ error: "causalSignatureId must differ from :id" });
      }
    }

    const existing = await loadRevocation(row.id);
    if (existing) {
      return res.status(409).json({
        error: "signature already revoked",
        revocation: {
          id: existing.id,
          signatureId: existing.signatureId,
          reason: existing.reason,
          causalSignatureId: existing.causalSignatureId,
          revokerUserId: existing.revokerUserId,
          revokedAt: new Date(existing.revokedAt).toISOString(),
        },
      });
    }

    const now = new Date();
    const revocationId = crypto.randomUUID();

    await pool.query("BEGIN");
    try {
      await pool.query(
        `
        INSERT INTO "QSignRevocation"
          ("id","signatureId","reason","causalSignatureId","revokerUserId","revokedAt")
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [revocationId, row.id, reason, causalSignatureId, auth.sub, now],
      );
      await pool.query(`UPDATE "QSignSignature" SET "revokedAt" = $1 WHERE "id" = $2`, [
        now,
        row.id,
      ]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }

    // Fire webhook for the original sig issuer (not the revoker, who may be admin).
    fireWebhooksFor(row.issuerUserId, "revoke", {
      id: row.id,
      reason,
      causalSignatureId,
      revokerUserId: auth.sub,
      revokedAt: now.toISOString(),
    });

    res.status(201).json({
      revoked: true,
      signatureId: row.id,
      revocation: {
        id: revocationId,
        reason,
        causalSignatureId,
        revokerUserId: auth.sub,
        revokedAt: now.toISOString(),
      },
      notice:
        "Historical signatures remain cryptographically valid; verify endpoints will report valid=false due to revocation status.",
    });
  } catch (e: any) {
    console.error("[qsign v2] /revoke/:id error", e);
    res.status(500).json({ error: "revoke_failed", details: e?.message });
  }
});

/* ───────── webhooks CRUD ─────────
 * Per-user delivery of sign/revoke events. Owner-scoped only — webhooks
 * fire for events on the owner's own signatures (no admin "all-events" mode
 * yet). Body of POSTs gets HMAC-SHA256 signed with the per-webhook secret;
 * receivers verify via X-QSign-Signature header.
 */

qsignV2Router.get("/webhooks", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    await ensureQSignV2Tables(pool);
    const r = (await pool.query(
      `SELECT "id","url","events","active","createdAt","lastFiredAt","lastStatus","lastError"
       FROM "QSignWebhook" WHERE "ownerUserId" = $1 ORDER BY "createdAt" DESC`,
      [auth.sub],
    )) as any;
    res.json({
      total: r.rows.length,
      webhooks: r.rows.map((row: any) => ({
        id: row.id,
        url: row.url,
        events: row.events.split(",").map((s: string) => s.trim()),
        active: row.active,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        lastFiredAt: row.lastFiredAt ? new Date(row.lastFiredAt).toISOString() : null,
        lastStatus: row.lastStatus,
        lastError: row.lastError,
      })),
    });
  } catch (e: any) {
    console.error("[qsign v2] /webhooks list error", e);
    res.status(500).json({ error: "webhooks_list_failed", details: e?.message });
  }
});

qsignV2Router.post("/webhooks", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    await ensureQSignV2Tables(pool);
    const { url, events: eventsRaw } = req.body || {};
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: "url must be http(s)://" });
    }
    const events = Array.isArray(eventsRaw)
      ? eventsRaw.filter((e) => typeof e === "string")
      : typeof eventsRaw === "string"
        ? eventsRaw.split(",").map((s) => s.trim())
        : ["sign", "revoke"];
    const allowed = new Set(["sign", "revoke"]);
    const filtered = events.filter((e) => allowed.has(e));
    if (filtered.length === 0) {
      return res
        .status(400)
        .json({ error: "events must contain at least one of sign|revoke" });
    }

    // Existing-quota guard: 10 webhooks per user.
    const countR = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "QSignWebhook" WHERE "ownerUserId" = $1`,
      [auth.sub],
    )) as any;
    if (countR.rows[0]?.n >= 10) {
      return res.status(409).json({ error: "webhook_quota_exceeded", limit: 10 });
    }

    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO "QSignWebhook" ("id","ownerUserId","url","secret","events","active")
       VALUES ($1,$2,$3,$4,$5,TRUE)`,
      [id, auth.sub, url, secret, filtered.join(",")],
    );
    res.status(201).json({
      id,
      url,
      events: filtered,
      active: true,
      secret,
      notice:
        "Save the secret — it is shown ONCE and used to verify X-QSign-Signature on every delivery (HMAC-SHA256 over the raw JSON body).",
    });
  } catch (e: any) {
    console.error("[qsign v2] /webhooks create error", e);
    res.status(500).json({ error: "webhook_create_failed", details: e?.message });
  }
});

qsignV2Router.delete("/webhooks/:id", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    await ensureQSignV2Tables(pool);
    const r = (await pool.query(
      `DELETE FROM "QSignWebhook" WHERE "id" = $1 AND "ownerUserId" = $2`,
      [req.params.id, auth.sub],
    )) as any;
    if (r.rowCount === 0) {
      return res.status(404).json({ error: "webhook not found or not yours" });
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (e: any) {
    console.error("[qsign v2] /webhooks delete error", e);
    res.status(500).json({ error: "webhook_delete_failed", details: e?.message });
  }
});

/* ───────── GET /keys (JWKS-like registry) ───────── */

qsignV2Router.get("/keys", async (_req, res) => {
  try {
    await ensureQSignV2Tables(pool);
    const all = await listKeys();

    const items = all.map((k) => ({
      kid: k.kid,
      algo: k.algo,
      status: k.status,
      publicKey: k.algo === "Ed25519" ? k.publicKey : null,
      createdAt: k.createdAt.toISOString(),
      retiredAt: k.retiredAt ? k.retiredAt.toISOString() : null,
      notes: k.notes,
    }));

    const activeHmac = items.find((k) => k.algo === "HMAC-SHA256" && k.status === "active");
    const activeEd25519 = items.find((k) => k.algo === "Ed25519" && k.status === "active");

    res.json({
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      active: {
        hmac: activeHmac?.kid ?? null,
        ed25519: activeEd25519?.kid ?? null,
      },
      keys: items,
      total: items.length,
    });
  } catch (e: any) {
    console.error("[qsign v2] /keys error", e);
    res.status(500).json({ error: "keys_list_failed", details: e?.message });
  }
});

/* ───────── GET /keys/:kid (single key detail) ───────── */

qsignV2Router.get("/keys/:kid", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);
    const row = await getKeyByKid(req.params.kid);
    if (!row) return res.status(404).json({ error: "key not found" });
    res.json({
      kid: row.kid,
      algo: row.algo,
      status: row.status,
      publicKey: row.algo === "Ed25519" ? row.publicKey : null,
      createdAt: row.createdAt.toISOString(),
      retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
      notes: row.notes,
    });
  } catch (e: any) {
    res.status(500).json({ error: "key_lookup_failed", details: e?.message });
  }
});

/* ───────── POST /keys/rotate (admin) ─────────
 * Overlap window: the previous active key for this algo is moved to "retired"
 * (still valid for verifying historical signatures), a new row becomes "active"
 * (used for all new signings). Retired keys stay verifiable forever.
 *
 * Body:
 *   {
 *     algo: "HMAC-SHA256" | "Ed25519",
 *     kid?: string,          // defaults to algoPrefix-<timestamp>
 *     secretRef?: string,    // defaults to QSIGN_<ALGO>_<KID>
 *     publicKey?: string,    // Ed25519: optional, derived from env seed if absent
 *     notes?: string
 *   }
 */

qsignV2Router.post("/keys/rotate", rotateLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  if (auth.role !== "admin") {
    return res.status(403).json({
      error: "admin role required for key rotation",
      hint: 'Update the user row in "AEVIONUser" to set role=\'admin\'.',
    });
  }

  const algo = req.body?.algo as "HMAC-SHA256" | "Ed25519" | undefined;
  if (algo !== "HMAC-SHA256" && algo !== "Ed25519") {
    return res.status(400).json({ error: "algo must be 'HMAC-SHA256' or 'Ed25519'" });
  }

  const requestedKid = typeof req.body?.kid === "string" ? req.body.kid.trim() : "";
  const requestedSecretRef =
    typeof req.body?.secretRef === "string" ? req.body.secretRef.trim() : "";
  const requestedPublicKey =
    typeof req.body?.publicKey === "string" ? req.body.publicKey.trim().toLowerCase() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes : null;

  try {
    await ensureQSignV2Tables(pool);

    // Default kid naming: qsign-hmac-v<N> / qsign-ed25519-v<N>, N = count_of_existing + 1
    const algoPrefix = algo === "HMAC-SHA256" ? "qsign-hmac" : "qsign-ed25519";
    const countRes = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM "QSignKey" WHERE "algo" = $1`,
      [algo],
    )) as any;
    const nextN = (countRes.rows?.[0]?.n ?? 0) + 1;
    const kid = requestedKid || `${algoPrefix}-v${nextN}`;

    if (!/^[a-z0-9][a-z0-9\-]{2,63}$/i.test(kid)) {
      return res
        .status(400)
        .json({ error: "invalid kid (alphanumeric + hyphens, 3-64 chars)" });
    }

    // Conflict check
    const existing = await getKeyByKid(kid);
    if (existing) {
      return res
        .status(409)
        .json({ error: `kid '${kid}' already exists (status=${existing.status})` });
    }

    const secretRef =
      requestedSecretRef ||
      (algo === "HMAC-SHA256"
        ? `QSIGN_HMAC_${kid.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_SECRET`
        : `QSIGN_ED25519_${kid.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PRIVATE`);

    // Ed25519: require explicit publicKey if env seed isn't present (prevents silent ephemeral key).
    let publicKey: string | null = null;
    if (algo === "Ed25519") {
      const envSeed = process.env[secretRef];
      if (requestedPublicKey) {
        if (!/^[0-9a-f]{64}$/.test(requestedPublicKey)) {
          return res.status(400).json({ error: "publicKey must be 64-char hex" });
        }
        publicKey = requestedPublicKey;
      } else if (envSeed && /^[0-9a-fA-F]{64}$/.test(envSeed)) {
        publicKey = null; // will be lazily resolved + backfilled on first resolveEd25519()
      } else {
        return res.status(400).json({
          error:
            "Ed25519 rotation requires either body.publicKey OR env[secretRef] containing a 64-hex seed",
          secretRef,
        });
      }
    }

    const now = new Date();

    // Demote current active -> retired for this algo
    await pool.query(
      `UPDATE "QSignKey"
         SET "status" = 'retired', "retiredAt" = $1
       WHERE "algo" = $2 AND "status" = 'active'`,
      [now, algo],
    );

    // Insert new active
    const id = crypto.randomUUID();
    await pool.query(
      `
      INSERT INTO "QSignKey" ("id","kid","algo","publicKey","secretRef","status","notes")
      VALUES ($1,$2,$3,$4,$5,'active',$6)
      `,
      [id, kid, algo, publicKey, secretRef, notes],
    );

    const demoted = await getActiveKey(algo); // may return the new one
    const newRow = await getKeyByKid(kid);

    res.status(201).json({
      rotated: true,
      algo,
      newKey: newRow
        ? {
            kid: newRow.kid,
            algo: newRow.algo,
            status: newRow.status,
            publicKey: newRow.publicKey,
            secretRef: newRow.secretRef,
            createdAt: newRow.createdAt.toISOString(),
            notes: newRow.notes,
          }
        : null,
      active: demoted?.kid ?? kid,
      notice:
        "Previous active key (if any) is now 'retired' and remains valid for verification of historical signatures.",
    });
  } catch (e: any) {
    console.error("[qsign v2] /keys/rotate error", e);
    res.status(500).json({ error: "rotate_failed", details: e?.message });
  }
});

/* ───────── GET /:id/pdf (signed-document PDF stamp) ─────────
 * Renders the signature row as a self-contained PDF: status banner, payload preview,
 * algo + kid + truncated signatures, issuer, geo, QR code linking to the public verify
 * page. Intended for B2B distribution and investor demos — recipient can scan QR to
 * verify on-chain-style without trusting the sender. No secrets are leaked.
 *
 * QR target host order: ?host= query → QSIGN_PUBLIC_VERIFY_BASE_URL env →
 * X-Forwarded-Proto + X-Forwarded-Host headers → req.protocol + req.get('host'). The
 * QR encodes `<base>/qsign/verify/<id>` so a Vercel-served frontend renders the SSR page.
 */

qsignV2Router.get("/:id/pdf", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);
    const id = req.params.id;
    const reserved = new Set([
      "health",
      "verify",
      "keys",
      "revoke",
      "sign",
      "stats",
      "recent",
      "webhooks",
      "audit",
    ]);
    if (reserved.has(id)) {
      return res.status(404).json({ error: "not_found" });
    }

    const row = await loadSignatureRow(id);
    if (!row) return res.status(404).json({ error: "signature not found" });

    const hmacRow = await resolveHmac(row.hmacKid);
    const expectedHmac = signHmac(hmacRow.secret, row.payloadCanonical);
    const hmacValid = constantTimeEqHex(expectedHmac, row.signatureHmac);

    let edValid: boolean | null = null;
    let edPublicKey: string | null = null;
    if (row.ed25519Kid && row.signatureEd25519) {
      const edKey = await getKeyByKid(row.ed25519Kid);
      if (edKey && edKey.publicKey) {
        edPublicKey = edKey.publicKey;
        edValid = verifyEd25519Hex(edKey.publicKey, row.payloadCanonical, row.signatureEd25519);
      } else {
        edValid = false;
      }
    }

    const revocation = await loadRevocation(row.id);
    const revokedAtSrc = row.revokedAt || revocation?.revokedAt || null;
    const revoked = !!revokedAtSrc;
    const cryptoOk = hmacValid && (edValid === null ? true : edValid);
    const status: "valid" | "revoked" | "tampered" = revoked
      ? "revoked"
      : cryptoOk
        ? "valid"
        : "tampered";

    const fwdProto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0];
    const fwdHost = (req.headers["x-forwarded-host"] as string)?.split(",")[0];
    const queryHost = typeof req.query.host === "string" ? req.query.host : null;
    const envBase = process.env.QSIGN_PUBLIC_VERIFY_BASE_URL?.replace(/\/+$/, "") || null;
    const verifyBase =
      queryHost?.replace(/\/+$/, "") ||
      envBase ||
      `${fwdProto || req.protocol}://${fwdHost || req.get("host")}`;
    const verifyUrl = `${verifyBase}/qsign/verify/${row.id}`;

    const PDFDocument = require("pdfkit");
    const QRCode = require("qrcode");
    const qrPng: Buffer = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: "M",
      width: 280,
      margin: 1,
    });

    const doc = new PDFDocument({ size: "A4", margin: 48, info: {
      Title: `QSign v2 — Signature ${row.id.slice(0, 8)}`,
      Author: "AEVION QSign v2",
      Subject: "Verifiable digital signature",
      Keywords: "qsign,aevion,hmac,ed25519,rfc8785",
    }});

    const isDownload = req.query.download === "1" || req.query.download === "true";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="qsign-${row.id.slice(0, 8)}.pdf"`,
    );
    doc.pipe(res);

    const sanitizeHex = (raw: unknown): string | null => {
      if (typeof raw !== "string") return null;
      const v = raw.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
      if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
      return null;
    };
    const sanitizeText = (raw: unknown, maxLen: number): string | null => {
      if (typeof raw !== "string") return null;
      const cleaned = raw.replace(/[\x00-\x1f\x7f]/g, "").trim();
      if (!cleaned) return null;
      return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
    };

    const accent = sanitizeHex(req.query.accent) ?? "#14b8a6";
    const customTitle = sanitizeText(req.query.title, 60);
    const customSubtitle = sanitizeText(req.query.subtitle, 120);

    const COLOR_VALID = "#0a7d2c";
    const COLOR_REVOKED = "#a40000";
    const COLOR_TAMPERED = "#a64100";
    const COLOR_TEXT = "#11151c";
    const COLOR_MUTED = "#5b6573";
    const COLOR_LINE = "#cdd3dc";

    const statusLabel = status === "valid" ? "VALID" : status === "revoked" ? "REVOKED" : "TAMPERED";
    const statusColor =
      status === "valid" ? COLOR_VALID : status === "revoked" ? COLOR_REVOKED : COLOR_TAMPERED;

    // Accent stripe at top — brand without compromising status semantics.
    doc.rect(0, 0, doc.page.width, 6).fillColor(accent).fill();

    doc.fillColor(COLOR_TEXT).font("Helvetica-Bold").fontSize(20).text(
      customTitle ?? "AEVION QSign v2",
      48,
      48,
    );
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(10).fillColor(COLOR_MUTED).text(
      customSubtitle ??
        "Verifiable digital signature  ·  RFC 8785 (JCS) canonicalization  ·  HMAC-SHA256 + Ed25519",
    );

    doc.moveDown(0.8);
    const bannerY = doc.y;
    doc.roundedRect(48, bannerY, doc.page.width - 96, 38, 6).fillAndStroke(statusColor, statusColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text(statusLabel, 64, bannerY + 10);
    if (status === "revoked" && revocation?.reason) {
      doc.font("Helvetica").fontSize(9).text(
        `revoked: ${revocation.reason}`,
        160,
        bannerY + 14,
        { width: doc.page.width - 96 - 120 },
      );
    }
    doc.y = bannerY + 38;
    doc.moveDown(0.8);

    const labelValue = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_MUTED).text(label.toUpperCase(), { continued: false });
      doc.font("Helvetica").fontSize(11).fillColor(COLOR_TEXT).text(value);
      doc.moveDown(0.3);
    };

    labelValue("Signature ID", row.id);
    labelValue(
      "Created",
      row.createdAt ? new Date(row.createdAt).toISOString() : "—",
    );
    labelValue(
      "Issuer",
      row.issuerEmail || row.issuerUserId || "anonymous",
    );
    if (row.geoSource || row.geoCountry || row.geoCity) {
      const geoParts = [row.geoCountry, row.geoCity].filter(Boolean).join(" · ");
      labelValue(
        "Geo",
        `${geoParts || "—"}  (source: ${row.geoSource || "—"})`,
      );
    }

    doc.moveDown(0.4);
    doc.strokeColor(COLOR_LINE).lineWidth(0.5).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR_TEXT).text("Signed payload (canonical)");
    doc.moveDown(0.3);
    const payloadPretty = (() => {
      try {
        return JSON.stringify(JSON.parse(row.payloadCanonical), null, 2);
      } catch {
        return row.payloadCanonical;
      }
    })();
    const payloadShown = payloadPretty.length > 1500 ? payloadPretty.slice(0, 1500) + "\n…" : payloadPretty;
    doc.font("Courier").fontSize(8.5).fillColor(COLOR_TEXT).text(payloadShown, {
      width: doc.page.width - 96,
    });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_MUTED).text(
      `payloadHash (sha256): ${row.payloadHash}`,
    );

    doc.moveDown(0.8);
    doc.strokeColor(COLOR_LINE).lineWidth(0.5).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
    doc.moveDown(0.6);

    const truncate = (s: string | null | undefined, n = 40): string =>
      !s ? "—" : s.length <= n ? s : `${s.slice(0, n)}…`;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR_TEXT).text("Signatures");
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_MUTED).text("HMAC-SHA256");
    doc.font("Courier").fontSize(8.5).fillColor(COLOR_TEXT).text(
      `kid: ${row.hmacKid}\nsignature: ${truncate(row.signatureHmac, 80)}\nverify: ${hmacValid ? "✓" : "✗"}`,
    );
    doc.moveDown(0.4);

    if (row.ed25519Kid) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_MUTED).text("Ed25519");
      doc.font("Courier").fontSize(8.5).fillColor(COLOR_TEXT).text(
        `kid: ${row.ed25519Kid}\npublicKey: ${truncate(edPublicKey, 80)}\nsignature: ${truncate(row.signatureEd25519, 80)}\nverify: ${edValid === null ? "—" : edValid ? "✓" : "✗"}`,
      );
      doc.moveDown(0.4);
    }

    const dilithiumRow = dilithiumPreviewFromRow(row);
    if (dilithiumRow) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_MUTED).text(
        `ML-DSA-65 (Dilithium-3) — ${dilithiumRow.mode}`,
      );
      doc.font("Courier").fontSize(8.5).fillColor(COLOR_TEXT).text(
        `kid: ${dilithiumRow.kid}\ndigest: ${truncate(dilithiumRow.digest, 80)}\nverify: ${dilithiumRow.valid === null ? "—" : dilithiumRow.valid ? "✓" : "✗"}`,
      );
      doc.font("Helvetica-Oblique").fontSize(7).fillColor(COLOR_MUTED).text(
        "Preview slot — real PQ signature lands in v2.1.",
      );
      doc.moveDown(0.4);
    }

    const qrSize = 130;
    const qrX = doc.page.width - 48 - qrSize;
    const qrY = doc.page.height - 48 - qrSize - 30;
    doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED).text(
      "Scan to verify online",
      qrX,
      qrY + qrSize + 4,
      { width: qrSize, align: "center" },
    );

    doc.font("Helvetica").fontSize(8).fillColor(COLOR_MUTED).text(
      verifyUrl,
      48,
      doc.page.height - 36,
      { width: qrX - 48 - 12, ellipsis: true },
    );

    // Mandatory attribution when custom title is used — keeps trust chain intact.
    if (customTitle) {
      doc.font("Helvetica-Oblique").fontSize(7).fillColor(COLOR_MUTED).text(
        "Powered by AEVION QSign v2",
        48,
        doc.page.height - 22,
        { width: qrX - 48 - 12 },
      );
    }

    doc.end();
  } catch (e: any) {
    console.error("[qsign v2] :id/pdf error", e);
    if (!res.headersSent) {
      res.status(500).json({ error: "pdf_render_failed", details: e?.message });
    } else {
      res.end();
    }
  }
});

/* ───────── GET /:id/public (shareable, no secrets) ─────────
 * Intended for SSR consumption by /qsign/verify/[id] page. Exposes:
 *   - payload (decoded), payloadHash, canonicalization spec
 *   - signatures (hmac hex, ed25519 hex + public key)
 *   - verification result and revocation metadata
 * Does NOT expose: HMAC secret, Ed25519 private seed, issuer email if anonymous flag (future).
 */

qsignV2Router.get("/:id/public", async (req, res) => {
  try {
    await ensureQSignV2Tables(pool);
    const id = req.params.id;
    const reserved = new Set([
      "health",
      "verify",
      "keys",
      "revoke",
      "sign",
      "stats",
      "recent",
      "webhooks",
      "audit",
    ]);
    if (reserved.has(id)) {
      return res.status(404).json({ error: "not_found" });
    }

    const row = await loadSignatureRow(id);
    if (!row) return res.status(404).json({ error: "signature not found" });

    const hmacRow = await resolveHmac(row.hmacKid);
    const expectedHmac = signHmac(hmacRow.secret, row.payloadCanonical);
    const hmacValid = constantTimeEqHex(expectedHmac, row.signatureHmac);

    let edValid: boolean | null = null;
    let edPublicKey: string | null = null;
    if (row.ed25519Kid && row.signatureEd25519) {
      const edKey = await getKeyByKid(row.ed25519Kid);
      if (edKey && edKey.publicKey) {
        edPublicKey = edKey.publicKey;
        edValid = verifyEd25519Hex(edKey.publicKey, row.payloadCanonical, row.signatureEd25519);
      } else {
        edValid = false;
      }
    }

    const revocation = await loadRevocation(row.id);
    const revokedAtSrc = row.revokedAt || revocation?.revokedAt || null;
    const revoked = !!revokedAtSrc;
    const valid = hmacValid && (edValid === null ? true : edValid) && !revoked;

    let payloadDecoded: unknown = null;
    try {
      payloadDecoded = JSON.parse(row.payloadCanonical);
    } catch {
      payloadDecoded = null;
    }

    res.json({
      id: row.id,
      algoVersion: row.algoVersion || ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      valid,
      revoked,
      revokedAt: revokedAtSrc ? new Date(revokedAtSrc).toISOString() : null,
      revocationReason: revocation?.reason ?? null,
      payload: payloadDecoded,
      payloadCanonical: row.payloadCanonical,
      payloadHash: row.payloadHash,
      hmac: {
        kid: row.hmacKid,
        algo: "HMAC-SHA256",
        signature: row.signatureHmac,
        valid: hmacValid,
      },
      ed25519: row.ed25519Kid
        ? {
            kid: row.ed25519Kid,
            algo: "Ed25519",
            signature: row.signatureEd25519,
            publicKey: edPublicKey,
            valid: edValid,
          }
        : null,
      dilithium: dilithiumPreviewFromRow(row),
      issuer: {
        userId: row.issuerUserId ?? null,
        email: row.issuerEmail ?? null,
      },
      geo:
        row.geoSource || row.geoLat !== null || row.geoCountry
          ? {
              source: row.geoSource ?? null,
              country: row.geoCountry ?? null,
              city: row.geoCity ?? null,
              lat: row.geoLat ?? null,
              lng: row.geoLng ?? null,
            }
          : null,
    });
  } catch (e: any) {
    console.error("[qsign v2] :id/public error", e);
    res.status(500).json({ error: "public_view_failed", details: e?.message });
  }
});

// Placeholder — handler added in Phase 5 (geo anchoring can be fed via this util).
// Exported so future extensions can tap into client IP extraction without re-implementing.
export { extractClientIp };

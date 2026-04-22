import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional, type JwtPayload } from "../lib/authJwt";
import { ensureQSignV2Tables } from "../lib/qsignV2/ensureTables";
import { canonicalJson, sha256Hex, CANONICALIZATION_SPEC } from "../lib/qsignV2/canonicalize";
import {
  getActiveHmac,
  getActiveEd25519,
  resolveHmac,
  resolveEd25519,
  getKeyByKid,
} from "../lib/qsignV2/keyRegistry";
import type { QSignVerifyResult } from "../lib/qsignV2/types";

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

function extractClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

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

/* ───────── POST /sign ───────── */

qsignV2Router.post("/sign", async (req, res) => {
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

    const id = crypto.randomUUID();
    await pool.query(
      `
      INSERT INTO "QSignSignature"
        ("id","hmacKid","ed25519Kid",
         "payloadCanonical","payloadHash",
         "signatureHmac","signatureEd25519","signatureDilithium",
         "algoVersion","issuerUserId","issuerEmail")
      VALUES ($1,$2,$3, $4,$5, $6,$7,NULL, $8,$9,$10)
      `,
      [
        id,
        hmacKey.kid,
        edKey.kid,
        canonical,
        payloadHash,
        signatureHmac,
        signatureEd25519,
        ALGO_VERSION,
        auth.sub,
        auth.email,
      ],
    );

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
      dilithium: null,
      issuer: { userId: auth.sub, email: auth.email },
      createdAt: new Date().toISOString(),
      verifyUrl: `/api/qsign/v2/verify/${id}`,
      publicUrl: `/qsign/verify/${id}`,
    });
  } catch (e: any) {
    console.error("[qsign v2] sign error", e);
    res.status(500).json({ error: "sign_failed", details: e?.message });
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

    res.json({
      valid,
      algoVersion: ALGO_VERSION,
      canonicalization: CANONICALIZATION_SPEC,
      payloadHash,
      hmac: { kid: hmacRow.kid, valid: hmacValid },
      ed25519: { kid: edKidOut, valid: edValid },
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
    if (id === "health" || id === "verify" || id === "keys") {
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
      dilithium: null,
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

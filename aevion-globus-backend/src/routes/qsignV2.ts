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
  listKeys,
  getActiveKey,
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

qsignV2Router.post("/keys/rotate", async (req, res) => {
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

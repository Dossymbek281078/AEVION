import crypto from "crypto";
import type { PgPoolLike } from "../ensureUsersTable";

/**
 * QSign v2 — idempotent table bootstrap + seed of first key pair.
 *
 * Mirrors the pattern used by pipeline.ts / planetCompliance.ts so the backend
 * can boot cleanly even if `prisma db push` has not been run against the
 * target DB. Safe to call on every request path (guarded by module-local
 * boolean so the actual queries fire only once per process).
 *
 * Seeding:
 *   - First HMAC key: kid=qsign-hmac-v1, secretRef=QSIGN_HMAC_V1_SECRET
 *   - First Ed25519 key: kid=qsign-ed25519-v1, secretRef=QSIGN_ED25519_V1_PRIVATE
 * If the matching env var is missing the key is still seeded with a status of
 * 'active' — runtime resolution (keyRegistry.ts) will generate a dev-only
 * secret in-process and warn; in production (NODE_ENV=production) it throws.
 */

let ensured = false;

export const DEFAULT_HMAC_KID = "qsign-hmac-v1";
export const DEFAULT_ED25519_KID = "qsign-ed25519-v1";
export const DEFAULT_HMAC_SECRET_ENV = "QSIGN_HMAC_V1_SECRET";
export const DEFAULT_ED25519_PRIVATE_ENV = "QSIGN_ED25519_V1_PRIVATE";
export const DEFAULT_ED25519_PUBLIC_ENV = "QSIGN_ED25519_V1_PUBLIC";

export async function ensureQSignV2Tables(pool: PgPoolLike): Promise<void> {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QSignKey" (
      "id"         TEXT PRIMARY KEY,
      "kid"        TEXT NOT NULL UNIQUE,
      "algo"       TEXT NOT NULL,
      "publicKey"  TEXT,
      "secretRef"  TEXT NOT NULL,
      "status"     TEXT NOT NULL DEFAULT 'active',
      "notes"      TEXT,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "retiredAt"  TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QSignKey_status_idx" ON "QSignKey" ("status");`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QSignSignature" (
      "id"                 TEXT PRIMARY KEY,
      "hmacKid"            TEXT NOT NULL,
      "ed25519Kid"         TEXT,
      "payloadCanonical"   TEXT NOT NULL,
      "payloadHash"        TEXT NOT NULL,
      "signatureHmac"      TEXT NOT NULL,
      "signatureEd25519"   TEXT,
      "signatureDilithium" TEXT,
      "algoVersion"        TEXT NOT NULL DEFAULT 'qsign-v2.0',
      "issuerUserId"       TEXT,
      "issuerEmail"        TEXT,
      "geoLat"             DOUBLE PRECISION,
      "geoLng"             DOUBLE PRECISION,
      "geoSource"          TEXT,
      "geoCountry"         TEXT,
      "geoCity"            TEXT,
      "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt"          TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QSignSignature_payloadHash_idx" ON "QSignSignature" ("payloadHash");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QSignSignature_issuerUserId_idx" ON "QSignSignature" ("issuerUserId");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QSignSignature_createdAt_idx" ON "QSignSignature" ("createdAt");`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QSignRevocation" (
      "id"                TEXT PRIMARY KEY,
      "signatureId"       TEXT NOT NULL UNIQUE,
      "reason"            TEXT NOT NULL,
      "causalSignatureId" TEXT,
      "revokerUserId"     TEXT,
      "revokedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  /* Seed default keys if absent ---------------------------------------- */
  await pool.query(
    `
    INSERT INTO "QSignKey" ("id","kid","algo","publicKey","secretRef","status","notes")
    VALUES ($1, $2, 'HMAC-SHA256', NULL, $3, 'active',
      'Default HMAC-SHA256 key (QSign v2 MVP). Secret resolved from env[secretRef].')
    ON CONFLICT ("kid") DO NOTHING
    `,
    [crypto.randomUUID(), DEFAULT_HMAC_KID, DEFAULT_HMAC_SECRET_ENV],
  );

  // Ed25519 — we need a public key up-front; if env has a private key we derive
  // the public key from it, otherwise we seed with a row that has NULL publicKey
  // and keyRegistry.ts will populate it lazily on first sign.
  const seededEd25519 = await deriveEd25519PublicFromEnv();
  await pool.query(
    `
    INSERT INTO "QSignKey" ("id","kid","algo","publicKey","secretRef","status","notes")
    VALUES ($1, $2, 'Ed25519', $3, $4, 'active',
      'Default Ed25519 key (QSign v2 MVP). Private key in env[secretRef]; public key hex in column.')
    ON CONFLICT ("kid") DO NOTHING
    `,
    [crypto.randomUUID(), DEFAULT_ED25519_KID, seededEd25519, DEFAULT_ED25519_PRIVATE_ENV],
  );

  ensured = true;
}

/**
 * If QSIGN_ED25519_V1_PRIVATE is set (hex-encoded raw private seed, 32 bytes),
 * derive the matching public key on boot. Otherwise return null and let
 * keyRegistry.ts generate a dev-only pair later.
 */
async function deriveEd25519PublicFromEnv(): Promise<string | null> {
  const privHex = process.env[DEFAULT_ED25519_PRIVATE_ENV];
  const pubHex = process.env[DEFAULT_ED25519_PUBLIC_ENV];
  if (pubHex && /^[0-9a-fA-F]{64}$/.test(pubHex)) return pubHex.toLowerCase();
  if (!privHex) return null;

  try {
    const { privateKey } = ed25519FromRawSeedHex(privHex);
    const publicKeyDer = crypto
      .createPublicKey(privateKey)
      .export({ format: "der", type: "spki" });
    // Raw public key = last 32 bytes of the SPKI DER for Ed25519.
    const raw = publicKeyDer.slice(publicKeyDer.length - 32);
    return raw.toString("hex");
  } catch {
    return null;
  }
}

function ed25519FromRawSeedHex(hex: string): { privateKey: crypto.KeyObject } {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ed25519 private seed must be 64-char hex");
  }
  const seed = Buffer.from(hex, "hex");
  // Build PKCS#8 DER envelope for a raw Ed25519 seed.
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([pkcs8Prefix, seed]);
  const privateKey = crypto.createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs8",
  });
  return { privateKey };
}

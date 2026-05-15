import crypto from "crypto";
import { getPool } from "../dbPool";
import {
  ensureQSignV2Tables,
  DEFAULT_HMAC_KID,
  DEFAULT_ED25519_KID,
  DEFAULT_HMAC_SECRET_ENV,
  DEFAULT_ED25519_PRIVATE_ENV,
  DEFAULT_ED25519_PUBLIC_ENV,
} from "./ensureTables";
import type { QSignKeyRow, QSignAlgo } from "./types";

/**
 * Key material registry for QSign v2.
 *
 * The QSignKey table stores metadata + `secretRef` (name of the env var that
 * holds the actual secret / private key). This module resolves that reference
 * at runtime and caches the resolved material in process memory.
 *
 * Security notes:
 *   - HMAC secret is NEVER exposed via any public endpoint.
 *   - Ed25519 public key IS exposed via /api/qsign/v2/keys (JWKS-like).
 *   - In production (NODE_ENV=production) we throw if an env var is missing
 *     to prevent silent use of ephemeral dev keys.
 *   - In development we generate ephemeral material on first use and log a
 *     clear warning. This material resets on restart by design.
 */

const pool = getPool();

type ResolvedHmac = { kid: string; algo: "HMAC-SHA256"; secret: Buffer };
type ResolvedEd25519 = {
  kid: string;
  algo: "Ed25519";
  privateKey: crypto.KeyObject;
  publicKeyHex: string;
};

const hmacCache = new Map<string, ResolvedHmac>();
const ed25519Cache = new Map<string, ResolvedEd25519>();

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function rowFromDb(r: any): QSignKeyRow {
  return {
    id: r.id,
    kid: r.kid,
    algo: r.algo as QSignAlgo,
    publicKey: r.publicKey ?? null,
    secretRef: r.secretRef,
    status: r.status,
    notes: r.notes ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
    retiredAt: r.retiredAt ? new Date(r.retiredAt) : null,
  };
}

export async function listKeys(filter?: { status?: "active" | "retired" }): Promise<QSignKeyRow[]> {
  await ensureQSignV2Tables(pool);
  const rows = filter?.status
    ? ((await pool.query(
        `SELECT * FROM "QSignKey" WHERE "status" = $1 ORDER BY "createdAt" ASC`,
        [filter.status],
      )) as any).rows
    : ((await pool.query(`SELECT * FROM "QSignKey" ORDER BY "createdAt" ASC`)) as any).rows;
  return rows.map(rowFromDb);
}

export async function getKeyByKid(kid: string): Promise<QSignKeyRow | null> {
  await ensureQSignV2Tables(pool);
  const res = (await pool.query(`SELECT * FROM "QSignKey" WHERE "kid" = $1`, [kid])) as any;
  if (!res.rows.length) return null;
  return rowFromDb(res.rows[0]);
}

export async function getActiveKey(algo: QSignAlgo): Promise<QSignKeyRow | null> {
  await ensureQSignV2Tables(pool);
  const res = (await pool.query(
    `SELECT * FROM "QSignKey"
       WHERE "algo" = $1 AND "status" = 'active'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
    [algo],
  )) as any;
  if (!res.rows.length) return null;
  return rowFromDb(res.rows[0]);
}

/* ───────── HMAC ───────── */

export async function resolveHmac(kid: string): Promise<ResolvedHmac> {
  const cached = hmacCache.get(kid);
  if (cached) return cached;

  const row = await getKeyByKid(kid);
  if (!row) throw new Error(`qsign/keyRegistry: unknown kid '${kid}'`);
  if (row.algo !== "HMAC-SHA256") {
    throw new Error(`qsign/keyRegistry: kid '${kid}' is not HMAC-SHA256`);
  }

  const secretEnv = process.env[row.secretRef];
  let secret: Buffer;

  if (secretEnv && secretEnv.length >= 16) {
    secret = Buffer.from(secretEnv, "utf8");
  } else if (isProd()) {
    throw new Error(
      `qsign/keyRegistry: env '${row.secretRef}' missing or too short (prod requires >=16 chars)`,
    );
  } else {
    // DEV fallback: deterministic-per-process ephemeral secret. Restart rotates.
    const ephemeral = `dev-ephemeral-${kid}-${crypto.randomBytes(16).toString("hex")}`;
    console.warn(
      `[qsign] DEV: env '${row.secretRef}' missing; using ephemeral HMAC secret for kid=${kid}`,
    );
    process.env[row.secretRef] = ephemeral;
    secret = Buffer.from(ephemeral, "utf8");
  }

  const resolved: ResolvedHmac = { kid: row.kid, algo: "HMAC-SHA256", secret };
  hmacCache.set(kid, resolved);
  return resolved;
}

/* ───────── Ed25519 ───────── */

function buildEd25519PrivateFromSeedHex(hex: string): crypto.KeyObject {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("qsign/keyRegistry: ed25519 seed must be 64-char hex");
  }
  const seed = Buffer.from(hex, "hex");
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([pkcs8Prefix, seed]);
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

function ed25519PublicHex(privateKey: crypto.KeyObject): string {
  const spkiDer = crypto
    .createPublicKey(privateKey)
    .export({ format: "der", type: "spki" }) as Buffer;
  // Raw Ed25519 public key = last 32 bytes of SPKI DER envelope.
  return spkiDer.subarray(spkiDer.length - 32).toString("hex");
}

export async function resolveEd25519(kid: string): Promise<ResolvedEd25519> {
  const cached = ed25519Cache.get(kid);
  if (cached) return cached;

  const row = await getKeyByKid(kid);
  if (!row) throw new Error(`qsign/keyRegistry: unknown kid '${kid}'`);
  if (row.algo !== "Ed25519") {
    throw new Error(`qsign/keyRegistry: kid '${kid}' is not Ed25519`);
  }

  const privHex = process.env[row.secretRef];
  let privateKey: crypto.KeyObject;

  if (privHex && /^[0-9a-fA-F]{64}$/.test(privHex)) {
    privateKey = buildEd25519PrivateFromSeedHex(privHex);
  } else if (isProd()) {
    throw new Error(
      `qsign/keyRegistry: env '${row.secretRef}' missing or invalid ed25519 seed (prod requires 64-hex)`,
    );
  } else {
    // DEV fallback: generate ephemeral pair, stash seed in env so next resolve is stable.
    console.warn(
      `[qsign] DEV: env '${row.secretRef}' missing; generating ephemeral Ed25519 pair for kid=${kid}`,
    );
    const { publicKey: pubObj, privateKey: privObj } = crypto.generateKeyPairSync("ed25519");
    const pkcs8 = privObj.export({ format: "der", type: "pkcs8" }) as Buffer;
    const seed = pkcs8.subarray(pkcs8.length - 32);
    process.env[row.secretRef] = seed.toString("hex");
    privateKey = privObj;
    // ensure publicKey column matches what we derive below
    const pubHex = (pubObj.export({ format: "der", type: "spki" }) as Buffer)
      .subarray(-32)
      .toString("hex");
    await pool.query(`UPDATE "QSignKey" SET "publicKey" = $1 WHERE "kid" = $2`, [pubHex, row.kid]);
  }

  const publicKeyHex = ed25519PublicHex(privateKey);

  // Keep DB public key in sync (covers the case where seed was provided via env
  // but the row was seeded with NULL publicKey).
  if (!row.publicKey || row.publicKey.toLowerCase() !== publicKeyHex) {
    await pool.query(`UPDATE "QSignKey" SET "publicKey" = $1 WHERE "kid" = $2`, [
      publicKeyHex,
      row.kid,
    ]);
  }

  const resolved: ResolvedEd25519 = {
    kid: row.kid,
    algo: "Ed25519",
    privateKey,
    publicKeyHex,
  };
  ed25519Cache.set(kid, resolved);
  return resolved;
}

/* ───────── Helpers used by sign/verify routes ───────── */

export async function getActiveHmac(): Promise<ResolvedHmac> {
  const row = await getActiveKey("HMAC-SHA256");
  const kid = row?.kid ?? DEFAULT_HMAC_KID;
  return resolveHmac(kid);
}

export async function getActiveEd25519(): Promise<ResolvedEd25519> {
  const row = await getActiveKey("Ed25519");
  const kid = row?.kid ?? DEFAULT_ED25519_KID;
  return resolveEd25519(kid);
}

/** Internal: for tests / debug paths only. Never expose via HTTP. */
export function _clearCaches(): void {
  hmacCache.clear();
  ed25519Cache.clear();
}

export const KEY_REGISTRY_DEFAULTS = {
  DEFAULT_HMAC_KID,
  DEFAULT_ED25519_KID,
  DEFAULT_HMAC_SECRET_ENV,
  DEFAULT_ED25519_PRIVATE_ENV,
  DEFAULT_ED25519_PUBLIC_ENV,
};

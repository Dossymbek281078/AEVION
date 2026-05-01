import crypto from "crypto";
import { QRightError } from "../lib/errors/QRightError";

export const SHAMIR_THRESHOLD = 2;
export const SHAMIR_SHARDS = 3;
export const ED25519_PRIV_KEY_BYTES = 32;

/**
 * Current HMAC key version. Signatures created NOW are stamped with this
 * version; older records keep their original version and are verified
 * against the matching _V{N} env secret. Bump this (and add a matching
 * env secret) to rotate.
 *
 * Controlled by env `HMAC_KEY_VERSION` (default 1). Applies to both shard
 * authentication and QSign certificate HMACs — they share the version
 * counter so rotation happens atomically.
 */
export const HMAC_KEY_VERSION: number = (() => {
  const raw = process.env.HMAC_KEY_VERSION;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new QRightError(
      "INTERNAL_ERROR",
      500,
      `HMAC_KEY_VERSION must be a positive integer (got: ${raw})`,
    );
  }
  return n;
})();

const REQUIRED_HMAC_SECRET_BYTES = 32;
const MIN_QSIGN_SECRET_LENGTH = 16;

// Keyed by version number. Populated lazily on first access.
const cachedShardSecrets = new Map<number, Buffer>();
const cachedQSignSecrets = new Map<number, string>();

/**
 * Env naming convention:
 *   - Version 1 (legacy + current-if-not-rotated): `SHARD_HMAC_SECRET`
 *     AND/OR `SHARD_HMAC_SECRET_V1` (both accepted; V1 wins if both set).
 *   - Version N > 1: `SHARD_HMAC_SECRET_V{N}` (required).
 * Same scheme for `QSIGN_SECRET` / `QSIGN_SECRET_V{N}`.
 *
 * Why two names for V1: lets existing deployments rotate without
 * renaming their original env var first.
 */
function readShardSecretRaw(version: number): string | undefined {
  const vKey = `SHARD_HMAC_SECRET_V${version}`;
  const vRaw = process.env[vKey];
  if (vRaw && vRaw.trim().length > 0) return vRaw;
  if (version === 1) {
    const legacy = process.env.SHARD_HMAC_SECRET;
    if (legacy && legacy.trim().length > 0) return legacy;
  }
  return undefined;
}

function readQSignSecretRaw(version: number): string | undefined {
  const vKey = `QSIGN_SECRET_V${version}`;
  const vRaw = process.env[vKey];
  if (vRaw && vRaw.trim().length > 0) return vRaw;
  if (version === 1) {
    const legacy = process.env.QSIGN_SECRET;
    if (legacy && legacy.trim().length > 0) return legacy;
  }
  return undefined;
}

/**
 * Returns the shard HMAC secret for a specific version. Throws if that
 * version is not configured — callers verifying old records must not
 * silently fall through to current-version secrets (that would let an
 * attacker downgrade verification).
 */
export function getShardHmacSecret(version: number = HMAC_KEY_VERSION): Buffer {
  const cached = cachedShardSecrets.get(version);
  if (cached) return cached;

  const raw = readShardSecretRaw(version);
  if (!raw) {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      `SHARD_HMAC_SECRET_V${version} env is not set` +
        (version === 1 ? " (and no legacy SHARD_HMAC_SECRET)" : ""),
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      `SHARD_HMAC_SECRET_V${version} is not valid base64`,
    );
  }

  if (buf.length !== REQUIRED_HMAC_SECRET_BYTES) {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      `SHARD_HMAC_SECRET_V${version} must be ${REQUIRED_HMAC_SECRET_BYTES} bytes (got ${buf.length})`,
    );
  }

  cachedShardSecrets.set(version, buf);
  return buf;
}

/**
 * Returns the QSign HMAC secret (ASCII string, min 16 chars) for a
 * specific version. Same throw-rather-than-fallback semantics as
 * `getShardHmacSecret`.
 */
export function getQSignSecret(version: number = HMAC_KEY_VERSION): string {
  const cached = cachedQSignSecrets.get(version);
  if (cached !== undefined) return cached;

  const raw = readQSignSecretRaw(version);
  if (!raw) {
    throw new QRightError(
      "MISSING_QSIGN_SECRET",
      500,
      `QSIGN_SECRET_V${version} env is not set` +
        (version === 1 ? " (and no legacy QSIGN_SECRET)" : ""),
    );
  }
  if (raw.length < MIN_QSIGN_SECRET_LENGTH) {
    throw new QRightError(
      "MISSING_QSIGN_SECRET",
      500,
      `QSIGN_SECRET_V${version} must be at least ${MIN_QSIGN_SECRET_LENGTH} characters`,
    );
  }

  cachedQSignSecrets.set(version, raw);
  return raw;
}

/**
 * Introspection helper for /api/pipeline/hmac-versions. Returns which
 * versions are configured right now, which is current, and how many
 * records in the DB use each (that last part is filled in by the route).
 */
export function listAvailableHmacVersions(): {
  current: number;
  shardVersions: number[];
  qsignVersions: number[];
} {
  const shardVersions: number[] = [];
  const qsignVersions: number[] = [];
  for (let v = 1; v <= 999; v++) {
    if (readShardSecretRaw(v)) shardVersions.push(v);
    if (readQSignSecretRaw(v)) qsignVersions.push(v);
  }
  return {
    current: HMAC_KEY_VERSION,
    shardVersions,
    qsignVersions,
  };
}

/** Test-only helper to reset cached secrets between test runs. */
export function __resetConfigCache(): void {
  cachedShardSecrets.clear();
  cachedQSignSecrets.clear();
}

export function areDemoEndpointsEnabled(): boolean {
  const v = (process.env.ENABLE_DEMO_ENDPOINTS || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

import crypto from "crypto";
import { QRightError } from "../lib/errors/QRightError";

export const SHAMIR_THRESHOLD = 2;
export const SHAMIR_SHARDS = 3;
export const HMAC_KEY_VERSION = 1;
export const ED25519_PRIV_KEY_BYTES = 32;

const REQUIRED_HMAC_SECRET_BYTES = 32;
const MIN_QSIGN_SECRET_LENGTH = 16;

let cachedSecret: Buffer | null = null;
let cachedQSignSecret: string | null = null;

export function getShardHmacSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const raw = process.env.SHARD_HMAC_SECRET;
  if (!raw || raw.trim().length === 0) {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      "SHARD_HMAC_SECRET env is not set",
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      "SHARD_HMAC_SECRET is not valid base64",
    );
  }

  if (buf.length !== REQUIRED_HMAC_SECRET_BYTES) {
    throw new QRightError(
      "MISSING_SHARD_HMAC_SECRET",
      500,
      `SHARD_HMAC_SECRET must be ${REQUIRED_HMAC_SECRET_BYTES} bytes (got ${buf.length})`,
    );
  }

  cachedSecret = buf;
  return cachedSecret;
}

export function getQSignSecret(): string {
  if (cachedQSignSecret !== null) return cachedQSignSecret;

  const raw = process.env.QSIGN_SECRET;
  if (!raw || raw.trim().length === 0) {
    throw new QRightError(
      "MISSING_QSIGN_SECRET",
      500,
      "QSIGN_SECRET env is not set",
    );
  }
  if (raw.length < MIN_QSIGN_SECRET_LENGTH) {
    throw new QRightError(
      "MISSING_QSIGN_SECRET",
      500,
      `QSIGN_SECRET must be at least ${MIN_QSIGN_SECRET_LENGTH} characters`,
    );
  }

  cachedQSignSecret = raw;
  return cachedQSignSecret;
}

/** Test-only helper to reset cached secrets between test runs. */
export function __resetConfigCache(): void {
  cachedSecret = null;
  cachedQSignSecret = null;
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

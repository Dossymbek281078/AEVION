/**
 * QPayNet — application-layer at-rest encryption for sensitive secrets
 * (currently webhook notify_secret; extend to merchant key seeds, KYC docs).
 *
 * Why app-layer instead of pgcrypto:
 *   - Works on any Postgres (Railway free tier doesn't always allow CREATE EXTENSION).
 *   - Key never leaves the app; DBAs with read access can't extract HMAC secrets.
 *   - No migration required to enable: existing plaintext rows decrypt as-is,
 *     new writes encrypt when QPAYNET_ENCRYPTION_KEY is set.
 *
 * Format: `enc:v1:<base64(iv|tag|ciphertext)>`
 *   - iv  = 12 random bytes (AES-GCM)
 *   - tag = 16 bytes (authentication tag)
 *   - ciphertext = the secret bytes
 *
 * Anything not starting with `enc:v1:` is returned as-is (back-compat:
 * legacy plaintext rows continue to work; rotate by re-issuing the secret).
 *
 * Key rotation strategy (future):
 *   - Add `enc:v2:` prefix with new key.
 *   - Read paths try v2 first, fall back to v1, fall back to plaintext.
 *   - Background job re-encrypts v1 rows to v2 over a rolling window.
 *   - Drop v1 key after window completes.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const PREFIX = "enc:v1:";
const ALG = "aes-256-gcm";

let cachedKey: Buffer | null | undefined;

/**
 * Resolves the symmetric key from QPAYNET_ENCRYPTION_KEY env. Accepts either:
 *   - 64-char hex (raw 32 bytes)
 *   - any other length: hashed with SHA-256 → 32 bytes (passphrase mode)
 * Returns null when the env var is unset (encryption disabled, plaintext OK).
 */
function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.QPAYNET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
  } else {
    // Passphrase mode: derive a 32-byte key. This is fine for an in-app
    // symmetric key — we're not protecting against weak-passphrase brute-force,
    // we're protecting against a leaked DB dump where the attacker doesn't
    // also have access to the env. SHA-256 is sufficient.
    cachedKey = createHash("sha256").update(raw).digest();
  }
  return cachedKey;
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

/**
 * Encrypt a secret for storage. Returns plaintext unchanged when
 * QPAYNET_ENCRYPTION_KEY is not configured (back-compat).
 */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * Decrypt on read. If the stored value lacks the `enc:v1:` prefix, returns
 * it unchanged — legacy plaintext rows pass through transparently. If the
 * value IS encrypted but the key is missing, throws (loud failure beats
 * silent tampering).
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  if (!key) {
    throw new Error("QPayNet: encrypted row found but QPAYNET_ENCRYPTION_KEY is unset — check env");
  }
  const blob = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (blob.length < 28) {
    throw new Error("QPayNet: encrypted blob too short (corrupt?)");
  }
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

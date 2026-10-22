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
 * 🔴 Ротация ключа (22.10.2026, утечка переменных Railway — QPAYNET_ENCRYPTION_KEY считается
 * засвеченным). До этого дня смена ключа теряла все зашифрованные строки: decryptSecret знал
 * один ключ, а «enc:v1:» не говорит, каким ключом шифровали. Теперь:
 *   - QPAYNET_ENCRYPTION_KEY       — текущий ключ: им шифруются новые записи.
 *   - QPAYNET_ENCRYPTION_KEY_PREV  — прежние ключи (через запятую, старший первым): ими только
 *                                    расшифровывают. AES-GCM с чужим ключом не проходит проверку
 *                                    тега, поэтому перебор ключей безопасен и однозначен.
 *   - needsEncryption(stored) = true и для строки, которая открывается ТОЛЬКО прежним ключом —
 *     существующие места ленивой миграции (qpaynet.ts: «прочитал → перешифровал») переводят её на
 *     текущий ключ при первом касании; остальные добивает POST /api/qpaynet/admin/reencrypt.
 *   - Когда reencrypt докладывает «под прежним ключом 0», PREV можно убрать из окружения.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const PREFIX = "enc:v1:";
const ALG = "aes-256-gcm";

let cachedKey: Buffer | null | undefined;
let cachedPrev: { raw: string | undefined; keys: Buffer[] } | null = null;

function deriveKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // Passphrase mode: derive a 32-byte key. This is fine for an in-app
  // symmetric key — we're not protecting against weak-passphrase brute-force,
  // we're protecting against a leaked DB dump where the attacker doesn't
  // also have access to the env. SHA-256 is sufficient.
  return createHash("sha256").update(raw).digest();
}

/**
 * Resolves the symmetric key from QPAYNET_ENCRYPTION_KEY env. Accepts either:
 *   - 64-char hex (raw 32 bytes)
 *   - any other length: hashed with SHA-256 → 32 bytes (passphrase mode)
 * Returns null when the env var is unset (encryption disabled, plaintext OK).
 */
function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.QPAYNET_ENCRYPTION_KEY?.trim();
  cachedKey = raw ? deriveKey(raw) : null;
  return cachedKey;
}

/** Prior keys from QPAYNET_ENCRYPTION_KEY_PREV (comma-separated); decrypt-only. */
function getPrevKeys(): Buffer[] {
  const raw = process.env.QPAYNET_ENCRYPTION_KEY_PREV;
  if (cachedPrev && cachedPrev.raw === raw) return cachedPrev.keys;
  const keys = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(deriveKey);
  cachedPrev = { raw, keys };
  return keys;
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

/** How many prior (decrypt-only) keys QPAYNET_ENCRYPTION_KEY_PREV currently lists. */
export function prevKeyCount(): number {
  return getPrevKeys().length;
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

function decryptWith(key: Buffer, blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Which key opens the stored value: "current", "prev" (opened only by a prior key from
 * QPAYNET_ENCRYPTION_KEY_PREV — must be re-encrypted), "plain" (not encrypted), or throws when
 * no configured key opens it (loud failure beats silent tampering / a wrong key in env).
 */
export function openSecret(stored: string): { plaintext: string; key: "current" | "prev" | "plain" } {
  if (!stored.startsWith(PREFIX)) return { plaintext: stored, key: "plain" };
  const key = getKey();
  const prev = getPrevKeys();
  if (!key && prev.length === 0) {
    throw new Error("QPayNet: encrypted row found but QPAYNET_ENCRYPTION_KEY is unset — check env");
  }
  const blob = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (blob.length < 28) {
    throw new Error("QPayNet: encrypted blob too short (corrupt?)");
  }
  if (key) {
    try {
      return { plaintext: decryptWith(key, blob), key: "current" };
    } catch {
      /* not the current key — try prior keys below */
    }
  }
  for (const p of prev) {
    try {
      return { plaintext: decryptWith(p, blob), key: "prev" };
    } catch {
      /* next prior key */
    }
  }
  throw new Error(
    `QPayNet: encrypted row opens with none of the configured keys (current${prev.length ? ` + ${prev.length} prev` : ""}) — wrong QPAYNET_ENCRYPTION_KEY or missing QPAYNET_ENCRYPTION_KEY_PREV`,
  );
}

/**
 * Decrypt on read. If the stored value lacks the `enc:v1:` prefix, returns
 * it unchanged — legacy plaintext rows pass through transparently. If the
 * value IS encrypted but no configured key opens it, throws (loud failure beats
 * silent tampering).
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  return openSecret(stored).plaintext;
}

/**
 * True if the value should be (re-)written under the CURRENT key:
 *   - non-null plaintext while encryption is enabled, or
 *   - an encrypted value that opens only with a prior key (QPAYNET_ENCRYPTION_KEY_PREV).
 *
 * Use at read sites: if needsEncryption() → write back encryptSecret(decrypted).
 * This implements lazy migration: rows added before QPAYNET_ENCRYPTION_KEY
 * existed — and rows encrypted under a rotated-out key — get migrated as
 * they're touched, no big-bang script needed.
 */
export function needsEncryption(stored: string | null | undefined): boolean {
  if (stored === null || stored === undefined || stored === "") return false;
  if (!isEncryptionEnabled()) return false;
  if (!stored.startsWith(PREFIX)) return true;
  try {
    return openSecret(stored).key === "prev";
  } catch {
    // Не открывается ни одним ключом — перешифровать нечего; decryptSecret на этом месте бросит
    // громко, здесь молчать можно: ответ «не нужно» верен.
    return false;
  }
}

/** Test-only: forget cached keys so env changes between cases take effect. */
export function __resetQpaynetCryptoCache(): void {
  cachedKey = undefined;
  cachedPrev = null;
}

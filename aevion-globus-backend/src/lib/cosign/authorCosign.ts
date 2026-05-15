import crypto from "crypto";

/**
 * Author co-signing: the user's browser holds an Ed25519 keypair (generated
 * client-side, never sent to the server). On /protect, the client signs
 * the canonical content hash with the author's private key and sends
 * { authorPublicKey, authorSignature } along with the form. The server
 * verifies before persisting and rejects on mismatch.
 *
 * Threat model: AEVION's Ed25519 key + HMAC secret are server-side. If a
 * future breach exposes them, attacker can forge new certificates with
 * arbitrary fields. The author's keypair is independent and held only by
 * the user — forging a cert that matches a specific user's identity then
 * additionally requires that user's private key, which AEVION never sees.
 *
 * The trade-off the user accepts: they MUST back up their key file. If
 * they lose it, they cannot prove new claims under that identity (old
 * certificates remain verifiable forever — the public key is persisted
 * on each row).
 */

const ED25519_PUBKEY_BYTES = 32;
const ED25519_SIG_BYTES = 64;
// X.509 SubjectPublicKeyInfo prefix for raw Ed25519 public keys (RFC 8410).
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type AuthorKeyAlgo = "ed25519";

export interface CosignInput {
  /** Raw 32-byte Ed25519 public key, base64-encoded. */
  authorPublicKey: string;
  /** Raw 64-byte Ed25519 signature over `contentHash`, base64-encoded. */
  authorSignature: string;
}

export interface CosignVerified extends CosignInput {
  authorKeyAlgo: AuthorKeyAlgo;
  /** First 16 hex chars of the SHA-256 of the public key — for display. */
  authorKeyFingerprint: string;
}

export type CosignVerifyError =
  | "MISSING_PUBLIC_KEY"
  | "MISSING_SIGNATURE"
  | "MALFORMED_PUBLIC_KEY"
  | "MALFORMED_SIGNATURE"
  | "SIGNATURE_MISMATCH";

export class CosignError extends Error {
  constructor(public readonly code: CosignVerifyError, message: string) {
    super(message);
    this.name = "CosignError";
  }
}

function decodeBase64Strict(value: string, expectedBytes: number): Buffer {
  const buf = Buffer.from(value, "base64");
  if (buf.length !== expectedBytes) {
    throw new Error(`expected ${expectedBytes} bytes, got ${buf.length}`);
  }
  // Re-encode to ensure no whitespace / non-canonical input was accepted.
  const reencoded = buf.toString("base64");
  if (reencoded.replace(/=+$/, "") !== value.replace(/=+$/, "")) {
    throw new Error("non-canonical base64");
  }
  return buf;
}

export function fingerprintPublicKey(rawPublicKey: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(rawPublicKey)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Verify the author's signature on `contentHash`. The signed message is
 * the UTF-8 bytes of the hex-encoded content hash — same string that
 * appears in the certificate. The client must sign that exact string.
 *
 * Returns the canonical (re-encoded) cosign payload to persist. Throws
 * CosignError on any failure; callers map to HTTP 400.
 */
export function verifyAuthorCosign(
  input: CosignInput,
  contentHash: string,
): CosignVerified {
  if (!input.authorPublicKey || typeof input.authorPublicKey !== "string") {
    throw new CosignError(
      "MISSING_PUBLIC_KEY",
      "authorPublicKey is required when author co-signing is used",
    );
  }
  if (!input.authorSignature || typeof input.authorSignature !== "string") {
    throw new CosignError(
      "MISSING_SIGNATURE",
      "authorSignature is required when author co-signing is used",
    );
  }

  let rawPub: Buffer;
  try {
    rawPub = decodeBase64Strict(input.authorPublicKey, ED25519_PUBKEY_BYTES);
  } catch (err) {
    throw new CosignError(
      "MALFORMED_PUBLIC_KEY",
      `authorPublicKey must be ${ED25519_PUBKEY_BYTES}-byte raw Ed25519 in base64: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  let rawSig: Buffer;
  try {
    rawSig = decodeBase64Strict(input.authorSignature, ED25519_SIG_BYTES);
  } catch (err) {
    throw new CosignError(
      "MALFORMED_SIGNATURE",
      `authorSignature must be ${ED25519_SIG_BYTES}-byte raw Ed25519 in base64: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Wrap the raw 32-byte public key into an SPKI envelope so Node's
  // crypto.createPublicKey can ingest it. Ed25519 SPKI is exactly:
  //   30 2a 30 05 06 03 2b 65 70 03 21 00 || rawPub
  const spki = Buffer.concat([SPKI_ED25519_PREFIX, rawPub]);
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      key: spki,
      format: "der",
      type: "spki",
    });
  } catch (err) {
    throw new CosignError(
      "MALFORMED_PUBLIC_KEY",
      `authorPublicKey could not be parsed as Ed25519 SPKI: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const ok = crypto.verify(
    null,
    Buffer.from(contentHash, "utf8"),
    publicKey,
    rawSig,
  );
  if (!ok) {
    throw new CosignError(
      "SIGNATURE_MISMATCH",
      "authorSignature does not validate against authorPublicKey for this contentHash",
    );
  }

  return {
    authorPublicKey: rawPub.toString("base64"),
    authorSignature: rawSig.toString("base64"),
    authorKeyAlgo: "ed25519",
    authorKeyFingerprint: fingerprintPublicKey(rawPub),
  };
}

/**
 * Re-verify a stored cosign payload during /verify. Returns true if the
 * signature still validates against the persisted publicKey + the
 * (recomputed canonical) contentHash. Returns false on any tampering;
 * returns null if the row predates co-signing (no pubkey stored).
 */
export function reverifyAuthorCosign(
  storedPublicKey: string | null | undefined,
  storedSignature: string | null | undefined,
  contentHash: string,
): { present: false } | { present: true; valid: boolean; fingerprint: string } {
  if (!storedPublicKey || !storedSignature) {
    return { present: false };
  }
  try {
    const verified = verifyAuthorCosign(
      { authorPublicKey: storedPublicKey, authorSignature: storedSignature },
      contentHash,
    );
    return {
      present: true,
      valid: true,
      fingerprint: verified.authorKeyFingerprint,
    };
  } catch (err) {
    if (err instanceof CosignError) {
      // For display purposes, still surface a fingerprint when we have a
      // parseable public key — the user wants to see WHICH key failed.
      let fp = "";
      try {
        const rawPub = Buffer.from(storedPublicKey, "base64");
        if (rawPub.length === ED25519_PUBKEY_BYTES) {
          fp = fingerprintPublicKey(rawPub);
        }
      } catch {
        /* ignore — fp stays empty */
      }
      return { present: true, valid: false, fingerprint: fp };
    }
    throw err;
  }
}

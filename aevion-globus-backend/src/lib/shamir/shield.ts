import crypto from "crypto";
import secrets from "secrets.js-grempe";
import { QRightError } from "../errors/QRightError";
import {
  ED25519_PRIV_KEY_BYTES,
  HMAC_KEY_VERSION,
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
  getShardHmacSecret,
  timingSafeEqualHex,
} from "../../config/qright";

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

export interface AuthenticatedShard {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
  location: string;
  createdAt: string;
  lastVerified: string;
}

export interface ShieldKeypair {
  publicKeySpkiHex: string;
  publicKeyRawHex: string;
  shards: AuthenticatedShard[];
}

const SHARD_LOCATIONS = ["Author Vault", "AEVION Platform", "Witness Node"];

function computeShardHmac(
  index: number,
  sssShare: string,
  shieldId: string,
  hmacKeyVersion: number,
): string {
  const secret = getShardHmacSecret();
  const payload = [
    String(index),
    sssShare,
    shieldId,
    String(hmacKeyVersion),
  ].join("|");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function generateEphemeralEd25519(): {
  privateKeyRaw: Buffer;
  publicKeySpkiHex: string;
  publicKeyRawHex: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  if (pkcs8.length !== ED25519_PKCS8_PREFIX.length + ED25519_PRIV_KEY_BYTES) {
    throw new QRightError(
      "RECONSTRUCTION_FAILED",
      500,
      "unexpected pkcs8 length",
    );
  }
  const privateKeyRaw = Buffer.from(
    pkcs8.subarray(ED25519_PKCS8_PREFIX.length),
  );
  pkcs8.fill(0);

  const publicKeySpki = publicKey.export({
    type: "spki",
    format: "der",
  }) as Buffer;
  const publicKeySpkiHex = publicKeySpki.toString("hex");

  const jwk = publicKey.export({ format: "jwk" }) as { x?: string };
  if (!jwk.x) {
    throw new QRightError(
      "RECONSTRUCTION_FAILED",
      500,
      "failed to extract ed25519 public key raw bytes",
    );
  }
  const publicKeyRawHex = Buffer.from(jwk.x, "base64url").toString("hex");

  return { privateKeyRaw, publicKeySpkiHex, publicKeyRawHex };
}

export function splitAndAuthenticate(
  privateKeyRaw: Buffer,
  shieldId: string,
): AuthenticatedShard[] {
  if (privateKeyRaw.length !== ED25519_PRIV_KEY_BYTES) {
    throw new QRightError(
      "RECONSTRUCTION_FAILED",
      500,
      `private key must be ${ED25519_PRIV_KEY_BYTES} bytes`,
    );
  }

  const secretHex = privateKeyRaw.toString("hex");
  const rawShares = secrets.share(secretHex, SHAMIR_SHARDS, SHAMIR_THRESHOLD);

  const now = new Date().toISOString();
  const shards: AuthenticatedShard[] = rawShares.map((sssShare, i) => {
    const index = i + 1;
    const hmac = computeShardHmac(
      index,
      sssShare,
      shieldId,
      HMAC_KEY_VERSION,
    );
    return {
      index,
      sssShare,
      hmac,
      hmacKeyVersion: HMAC_KEY_VERSION,
      location: SHARD_LOCATIONS[i % SHARD_LOCATIONS.length],
      createdAt: now,
      lastVerified: now,
    };
  });

  return shards;
}

export function verifyShardHmac(
  shard: Pick<
    AuthenticatedShard,
    "index" | "sssShare" | "hmac" | "hmacKeyVersion"
  >,
  shieldId: string,
): boolean {
  if (shard.hmacKeyVersion !== HMAC_KEY_VERSION) return false;
  const expected = computeShardHmac(
    shard.index,
    shard.sssShare,
    shieldId,
    shard.hmacKeyVersion,
  );
  return timingSafeEqualHex(expected, shard.hmac);
}

export interface CombineResult {
  ok: boolean;
  reason?:
    | "INVALID_HMAC"
    | "INSUFFICIENT_SHARDS"
    | "DUPLICATE_SHARD_INDEX"
    | "INVALID_SHARD_FORMAT"
    | "RECONSTRUCTION_FAILED";
}

export function combineAndVerify(
  shards: Array<
    Pick<
      AuthenticatedShard,
      "index" | "sssShare" | "hmac" | "hmacKeyVersion"
    >
  >,
  shieldId: string,
  expectedPublicKeySpkiHex: string,
): CombineResult {
  if (!Array.isArray(shards) || shards.length < SHAMIR_THRESHOLD) {
    return { ok: false, reason: "INSUFFICIENT_SHARDS" };
  }

  const seenIndices = new Set<number>();
  for (const s of shards) {
    if (
      typeof s.index !== "number" ||
      typeof s.sssShare !== "string" ||
      typeof s.hmac !== "string" ||
      typeof s.hmacKeyVersion !== "number"
    ) {
      return { ok: false, reason: "INVALID_SHARD_FORMAT" };
    }
    if (seenIndices.has(s.index)) {
      return { ok: false, reason: "DUPLICATE_SHARD_INDEX" };
    }
    seenIndices.add(s.index);
  }

  for (const s of shards) {
    if (!verifyShardHmac(s, shieldId)) {
      return { ok: false, reason: "INVALID_HMAC" };
    }
  }

  let combinedHex: string;
  try {
    combinedHex = secrets.combine(shards.map((s) => s.sssShare));
  } catch {
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }

  if (!/^[0-9a-fA-F]+$/.test(combinedHex)) {
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }
  if (combinedHex.length !== ED25519_PRIV_KEY_BYTES * 2) {
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }

  const combinedBuf = Buffer.from(combinedHex, "hex");
  const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, combinedBuf]);

  let privateKeyObj: crypto.KeyObject;
  try {
    privateKeyObj = crypto.createPrivateKey({
      key: pkcs8,
      format: "der",
      type: "pkcs8",
    });
  } catch {
    combinedBuf.fill(0);
    pkcs8.fill(0);
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }

  const testMessage = Buffer.from(
    `qright-reconstruct-probe:${shieldId}`,
    "utf8",
  );
  let signature: Buffer;
  try {
    signature = crypto.sign(null, testMessage, privateKeyObj);
  } catch {
    combinedBuf.fill(0);
    pkcs8.fill(0);
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  } finally {
    combinedBuf.fill(0);
    pkcs8.fill(0);
  }

  let publicKeyObj: crypto.KeyObject;
  try {
    publicKeyObj = crypto.createPublicKey({
      key: Buffer.from(expectedPublicKeySpkiHex, "hex"),
      format: "der",
      type: "spki",
    });
  } catch {
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }

  const verified = crypto.verify(null, testMessage, publicKeyObj, signature);
  if (!verified) {
    return { ok: false, reason: "RECONSTRUCTION_FAILED" };
  }

  return { ok: true };
}

export function wipeBuffer(buf: Buffer | null | undefined): void {
  if (!buf) return;
  try {
    buf.fill(0);
  } catch {
    // noop
  }
}

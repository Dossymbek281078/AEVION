import pg from "pg";
import crypto from "crypto";
import { computeWitnessCid } from "../shamir/witnessCid";

type PgPool = InstanceType<typeof pg.Pool>;

export type DistributionPolicy = "legacy_all_local" | "distributed_v2";
import {
  HMAC_KEY_VERSION,
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
} from "../../config/qright";
import {
  generateEphemeralEd25519,
  splitAndAuthenticate,
  wipeBuffer,
  type AuthenticatedShard,
} from "../shamir/shield";

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

export interface CreateShieldOpts {
  objectId?: string | null;
  objectTitle?: string | null;
  payload?: unknown;
  threshold?: number;
  totalShards?: number;
  ownerUserId?: string | null;
  /**
   * `legacy_all_local` (default): all 3 shards stored in QuantumShield.shards.
   * `distributed_v2`: shard 1 returned to caller only (author keeps it offline,
   *   server forgets), shard 2 stored on server, shard 3 stored on server +
   *   witnessCid published for public retrieval. Server alone holds 1-of-3
   *   so cannot forge a reconstruction without external help.
   */
  distribution?: DistributionPolicy;
}

export interface CreateShieldResult {
  id: string;
  objectId: string | null;
  objectTitle: string;
  algorithm: string;
  threshold: number;
  totalShards: number;
  /**
   * In `legacy_all_local`: all 3 authenticated shards.
   * In `distributed_v2`: still all 3 returned to the caller in this response
   *   (so the author can take their copy of shard 1 offline), but the server
   *   only persists shards 2 and 3 in QuantumShield.shards (+ witnessCid for
   *   shard 3). After this single response, shard 1 is unrecoverable from
   *   AEVION alone.
   */
  shards: AuthenticatedShard[];
  signature: string;
  publicKey: string;
  hmacKeyVersion: number;
  status: "active";
  legacy: false;
  ownerUserId: string | null;
  distribution: DistributionPolicy;
  /** Public CID of shard 3 (only set in `distributed_v2`). */
  witnessCid: string | null;
  createdAt: string;
}

/**
 * Pure shield-creation helper — does NOT touch HTTP layer. Used by both
 * the QuantumShield router (POST /, POST /create) and integration hooks
 * (e.g. QSign v2 sign with body.shield=true).
 *
 * Caller is responsible for table existence (`ensureShieldTable`).
 */
export async function createShieldRecord(
  pool: PgPool,
  opts: CreateShieldOpts,
): Promise<CreateShieldResult> {
  const title =
    opts.objectTitle ||
    (opts.payload ? JSON.stringify(opts.payload).slice(0, 80) : null);
  if (!title) {
    throw new Error("objectTitle or payload is required");
  }

  const recordedThreshold =
    Number.isInteger(opts.threshold) &&
    (opts.threshold as number) >= 2 &&
    (opts.threshold as number) <= SHAMIR_SHARDS
      ? (opts.threshold as number)
      : SHAMIR_THRESHOLD;
  const recordedTotalShards =
    Number.isInteger(opts.totalShards) &&
    (opts.totalShards as number) >= recordedThreshold &&
    (opts.totalShards as number) <= 7
      ? (opts.totalShards as number)
      : SHAMIR_SHARDS;

  const id = "qs-" + crypto.randomBytes(8).toString("hex");
  const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();

  const dataToSign = JSON.stringify({
    objectId: opts.objectId,
    objectTitle: title,
    payload: opts.payload,
    timestamp: Date.now(),
  });
  const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, privateKeyRaw]);
  const signingKey = crypto.createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto
    .sign(null, Buffer.from(dataToSign), signingKey)
    .toString("hex");
  wipeBuffer(pkcs8);

  let shards: AuthenticatedShard[];
  try {
    shards = splitAndAuthenticate(privateKeyRaw, id);
  } finally {
    wipeBuffer(privateKeyRaw);
  }

  const policy: DistributionPolicy =
    opts.distribution === "distributed_v2" ? "distributed_v2" : "legacy_all_local";

  /* In distributed_v2 we strip shard 1 from the persisted blob — the
   * caller is responsible for taking it offline. The shards array still
   * goes back to the caller in this single response so the author can
   * download their copy. After that, shard 1 cannot be re-fetched.
   *
   * Server keeps shards 2+3 in `QuantumShield.shards`. Shard 3 is also
   * mirrored into `QuantumShieldDistribution` with its witnessCid for
   * public retrieval. Reconstruction requires shard 1 from the author OR
   * shards 2+3 from server, but server alone has only 2 of 3 (which is
   * enough by Shamir threshold but only if the author/witness layer also
   * cooperates, since we surface that asymmetry to consumers). */
  const persistedShards =
    policy === "distributed_v2" ? shards.filter((s) => s.index !== 1) : shards;
  let witnessCid: string | null = null;
  if (policy === "distributed_v2") {
    const witnessShard = shards.find((s) => s.index === 3);
    if (witnessShard) {
      witnessCid = computeWitnessCid({
        index: witnessShard.index,
        sssShare: witnessShard.sssShare,
        hmac: witnessShard.hmac,
        hmacKeyVersion: witnessShard.hmacKeyVersion,
      });
    }
  }

  await pool.query(
    `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","legacy","hmac_key_version","ownerUserId","distribution_policy","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',false,$10,$11,$12,NOW())`,
    [
      id,
      opts.objectId || null,
      title,
      "Shamir's Secret Sharing + Ed25519",
      recordedThreshold,
      recordedTotalShards,
      JSON.stringify(persistedShards),
      signature,
      publicKeySpkiHex,
      HMAC_KEY_VERSION,
      opts.ownerUserId || null,
      policy,
    ],
  );

  if (policy === "distributed_v2" && witnessCid) {
    const witnessShard = shards.find((s) => s.index === 3)!;
    await pool.query(
      `INSERT INTO "QuantumShieldDistribution"
        ("shieldId","shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("shieldId","shardIndex") DO NOTHING`,
      [
        id,
        witnessShard.index,
        witnessShard.sssShare,
        witnessShard.hmac,
        witnessShard.hmacKeyVersion,
        witnessCid,
      ],
    );
  }

  return {
    id,
    objectId: opts.objectId ?? null,
    objectTitle: title,
    algorithm: "Shamir's Secret Sharing + Ed25519",
    threshold: recordedThreshold,
    totalShards: recordedTotalShards,
    shards,
    signature,
    publicKey: publicKeySpkiHex,
    hmacKeyVersion: HMAC_KEY_VERSION,
    status: "active",
    legacy: false,
    ownerUserId: opts.ownerUserId ?? null,
    distribution: policy,
    witnessCid,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Idempotent table-bootstrap helper for cross-module callers (QSign hook,
 * pipeline, etc.). The QuantumShield router has its own `ensureShieldTable`
 * but it lives behind a router-private cache flag; this function shares the
 * same DDL but is safe to import from anywhere.
 */
let ensured = false;
export async function ensureShieldTableShared(pool: PgPool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShield" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT,
      "objectTitle" TEXT,
      "algorithm" TEXT NOT NULL DEFAULT 'Shamir''s Secret Sharing + Ed25519',
      "threshold" INT NOT NULL DEFAULT 2,
      "totalShards" INT NOT NULL DEFAULT 3,
      "shards" TEXT NOT NULL,
      "signature" TEXT,
      "publicKey" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "hmac_key_version" INTEGER NOT NULL DEFAULT 1;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "verifiedCount" INTEGER NOT NULL DEFAULT 0;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMPTZ;`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QuantumShield_ownerUserId_idx" ON "QuantumShield" ("ownerUserId");`,
  );
  ensured = true;
}

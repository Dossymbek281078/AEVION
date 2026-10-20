"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShieldRecord = createShieldRecord;
exports.ensureShieldTableShared = ensureShieldTableShared;
const crypto_1 = __importDefault(require("crypto"));
const witnessCid_1 = require("../shamir/witnessCid");
const qright_1 = require("../../config/qright");
const shield_1 = require("../shamir/shield");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
/**
 * Pure shield-creation helper — does NOT touch HTTP layer. Used by both
 * the QuantumShield router (POST /, POST /create) and integration hooks
 * (e.g. QSign v2 sign with body.shield=true).
 *
 * Caller is responsible for table existence (`ensureShieldTable`).
 */
async function createShieldRecord(pool, opts) {
    const title = opts.objectTitle ||
        (opts.payload ? JSON.stringify(opts.payload).slice(0, 80) : null);
    if (!title) {
        throw new Error("objectTitle or payload is required");
    }
    const recordedThreshold = Number.isInteger(opts.threshold) &&
        opts.threshold >= 2 &&
        opts.threshold <= qright_1.SHAMIR_SHARDS
        ? opts.threshold
        : qright_1.SHAMIR_THRESHOLD;
    const recordedTotalShards = Number.isInteger(opts.totalShards) &&
        opts.totalShards >= recordedThreshold &&
        opts.totalShards <= 7
        ? opts.totalShards
        : qright_1.SHAMIR_SHARDS;
    const id = "qs-" + crypto_1.default.randomBytes(8).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = (0, shield_1.generateEphemeralEd25519)();
    const dataToSign = JSON.stringify({
        objectId: opts.objectId,
        objectTitle: title,
        payload: opts.payload,
        timestamp: Date.now(),
    });
    const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, privateKeyRaw]);
    const signingKey = crypto_1.default.createPrivateKey({
        key: pkcs8,
        format: "der",
        type: "pkcs8",
    });
    const signature = crypto_1.default
        .sign(null, Buffer.from(dataToSign), signingKey)
        .toString("hex");
    (0, shield_1.wipeBuffer)(pkcs8);
    let shards;
    try {
        shards = (0, shield_1.splitAndAuthenticate)(privateKeyRaw, id);
    }
    finally {
        (0, shield_1.wipeBuffer)(privateKeyRaw);
    }
    const policy = opts.distribution === "distributed_v2" ? "distributed_v2" : "legacy_all_local";
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
    const persistedShards = policy === "distributed_v2" ? shards.filter((s) => s.index !== 1) : shards;
    let witnessCid = null;
    if (policy === "distributed_v2") {
        const witnessShard = shards.find((s) => s.index === 3);
        if (witnessShard) {
            witnessCid = (0, witnessCid_1.computeWitnessCid)({
                index: witnessShard.index,
                sssShare: witnessShard.sssShare,
                hmac: witnessShard.hmac,
                hmacKeyVersion: witnessShard.hmacKeyVersion,
            });
        }
    }
    await pool.query(`INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","legacy","hmac_key_version","ownerUserId","distribution_policy","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',false,$10,$11,$12,NOW())`, [
        id,
        opts.objectId || null,
        title,
        "Shamir's Secret Sharing + Ed25519",
        recordedThreshold,
        recordedTotalShards,
        JSON.stringify(persistedShards),
        signature,
        publicKeySpkiHex,
        qright_1.HMAC_KEY_VERSION,
        opts.ownerUserId || null,
        policy,
    ]);
    if (policy === "distributed_v2" && witnessCid) {
        const witnessShard = shards.find((s) => s.index === 3);
        await pool.query(`INSERT INTO "QuantumShieldDistribution"
        ("shieldId","shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("shieldId","shardIndex") DO NOTHING`, [
            id,
            witnessShard.index,
            witnessShard.sssShare,
            witnessShard.hmac,
            witnessShard.hmacKeyVersion,
            witnessCid,
        ]);
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
        hmacKeyVersion: qright_1.HMAC_KEY_VERSION,
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
async function ensureShieldTableShared(pool) {
    if (ensured)
        return;
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
    await pool.query(`ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;`);
    await pool.query(`ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "hmac_key_version" INTEGER NOT NULL DEFAULT 1;`);
    await pool.query(`ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`);
    await pool.query(`ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "verifiedCount" INTEGER NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMPTZ;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QuantumShield_ownerUserId_idx" ON "QuantumShield" ("ownerUserId");`);
    ensured = true;
}

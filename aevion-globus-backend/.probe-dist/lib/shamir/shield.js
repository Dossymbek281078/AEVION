"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEphemeralEd25519 = generateEphemeralEd25519;
exports.splitAndAuthenticate = splitAndAuthenticate;
exports.verifyShardHmac = verifyShardHmac;
exports.combineAndVerify = combineAndVerify;
exports.wipeBuffer = wipeBuffer;
const crypto_1 = __importDefault(require("crypto"));
const secrets_js_grempe_1 = __importDefault(require("secrets.js-grempe"));
const QRightError_1 = require("../errors/QRightError");
const qright_1 = require("../../config/qright");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SHARD_LOCATIONS = ["Author Vault", "AEVION Platform", "Witness Node"];
function computeShardHmac(index, sssShare, shieldId, hmacKeyVersion) {
    // getShardHmacSecret(version) throws if the version is not configured —
    // that correctly bubbles up as a 500 / caller decides what to do.
    const secret = (0, qright_1.getShardHmacSecret)(hmacKeyVersion);
    const payload = [
        String(index),
        sssShare,
        shieldId,
        String(hmacKeyVersion),
    ].join("|");
    return crypto_1.default.createHmac("sha256", secret).update(payload).digest("hex");
}
function generateEphemeralEd25519() {
    const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync("ed25519");
    const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
    if (pkcs8.length !== ED25519_PKCS8_PREFIX.length + qright_1.ED25519_PRIV_KEY_BYTES) {
        throw new QRightError_1.QRightError("RECONSTRUCTION_FAILED", 500, "unexpected pkcs8 length");
    }
    const privateKeyRaw = Buffer.from(pkcs8.subarray(ED25519_PKCS8_PREFIX.length));
    pkcs8.fill(0);
    const publicKeySpki = publicKey.export({
        type: "spki",
        format: "der",
    });
    const publicKeySpkiHex = publicKeySpki.toString("hex");
    const jwk = publicKey.export({ format: "jwk" });
    if (!jwk.x) {
        throw new QRightError_1.QRightError("RECONSTRUCTION_FAILED", 500, "failed to extract ed25519 public key raw bytes");
    }
    const publicKeyRawHex = Buffer.from(jwk.x, "base64url").toString("hex");
    return { privateKeyRaw, publicKeySpkiHex, publicKeyRawHex };
}
function splitAndAuthenticate(privateKeyRaw, shieldId) {
    if (privateKeyRaw.length !== qright_1.ED25519_PRIV_KEY_BYTES) {
        throw new QRightError_1.QRightError("RECONSTRUCTION_FAILED", 500, `private key must be ${qright_1.ED25519_PRIV_KEY_BYTES} bytes`);
    }
    const secretHex = privateKeyRaw.toString("hex");
    const rawShares = secrets_js_grempe_1.default.share(secretHex, qright_1.SHAMIR_SHARDS, qright_1.SHAMIR_THRESHOLD);
    const now = new Date().toISOString();
    const shards = rawShares.map((sssShare, i) => {
        const index = i + 1;
        const hmac = computeShardHmac(index, sssShare, shieldId, qright_1.HMAC_KEY_VERSION);
        return {
            index,
            sssShare,
            hmac,
            hmacKeyVersion: qright_1.HMAC_KEY_VERSION,
            location: SHARD_LOCATIONS[i % SHARD_LOCATIONS.length],
            createdAt: now,
            lastVerified: now,
        };
    });
    return shards;
}
function verifyShardHmac(shard, shieldId) {
    // Verify against the secret for THIS shard's own version, not the
    // current one. That's what makes rotation work: a v1 shard remains
    // verifiable under SHARD_HMAC_SECRET_V1 even after we rotate to v2.
    let expected;
    try {
        expected = computeShardHmac(shard.index, shard.sssShare, shieldId, shard.hmacKeyVersion);
    }
    catch {
        // Unknown version = secret not configured on this deployment.
        // Don't leak whether the version exists or not — just fail closed.
        return false;
    }
    return (0, qright_1.timingSafeEqualHex)(expected, shard.hmac);
}
function combineAndVerify(shards, shieldId, expectedPublicKeySpkiHex) {
    if (!Array.isArray(shards) || shards.length < qright_1.SHAMIR_THRESHOLD) {
        return { ok: false, reason: "INSUFFICIENT_SHARDS" };
    }
    const seenIndices = new Set();
    for (const s of shards) {
        if (typeof s.index !== "number" ||
            typeof s.sssShare !== "string" ||
            typeof s.hmac !== "string" ||
            typeof s.hmacKeyVersion !== "number") {
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
    let combinedHex;
    try {
        combinedHex = secrets_js_grempe_1.default.combine(shards.map((s) => s.sssShare));
    }
    catch {
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    if (!/^[0-9a-fA-F]+$/.test(combinedHex)) {
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    if (combinedHex.length !== qright_1.ED25519_PRIV_KEY_BYTES * 2) {
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    const combinedBuf = Buffer.from(combinedHex, "hex");
    const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, combinedBuf]);
    let privateKeyObj;
    try {
        privateKeyObj = crypto_1.default.createPrivateKey({
            key: pkcs8,
            format: "der",
            type: "pkcs8",
        });
    }
    catch {
        combinedBuf.fill(0);
        pkcs8.fill(0);
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    const testMessage = Buffer.from(`qright-reconstruct-probe:${shieldId}`, "utf8");
    let signature;
    try {
        signature = crypto_1.default.sign(null, testMessage, privateKeyObj);
    }
    catch {
        combinedBuf.fill(0);
        pkcs8.fill(0);
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    finally {
        combinedBuf.fill(0);
        pkcs8.fill(0);
    }
    let publicKeyObj;
    try {
        publicKeyObj = crypto_1.default.createPublicKey({
            key: Buffer.from(expectedPublicKeySpkiHex, "hex"),
            format: "der",
            type: "spki",
        });
    }
    catch {
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    const verified = crypto_1.default.verify(null, testMessage, publicKeyObj, signature);
    if (!verified) {
        return { ok: false, reason: "RECONSTRUCTION_FAILED" };
    }
    return { ok: true };
}
function wipeBuffer(buf) {
    if (!buf)
        return;
    try {
        buf.fill(0);
    }
    catch {
        // noop
    }
}

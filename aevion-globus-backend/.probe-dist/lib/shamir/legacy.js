"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._legacyGenerateShards = _legacyGenerateShards;
const crypto_1 = __importDefault(require("crypto"));
/**
 * @deprecated Fake "Shamir" from pre-v2 era. These are independent SHA-256
 * derivations, NOT real secret-sharing — no threshold reconstruction possible.
 * Kept for reference and legacy-record detection only. Do not call from new code.
 * Use `splitAndAuthenticate` in `lib/shamir/shield.ts` instead.
 */
function _legacyGenerateShards(data, total) {
    const shards = [];
    const now = new Date().toISOString();
    for (let i = 0; i < total; i++) {
        const shardId = crypto_1.default.randomBytes(16).toString("hex");
        const shardData = crypto_1.default
            .createHash("sha256")
            .update(data + ":shard:" + i + ":" + shardId)
            .digest("hex");
        shards.push({
            index: i + 1,
            id: shardId,
            data: shardData,
            location: ["Author Vault", "AEVION Platform", "Witness Node"][i % 3],
            status: "active",
            createdAt: now,
            lastVerified: now,
        });
    }
    return shards;
}

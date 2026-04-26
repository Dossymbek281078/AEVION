import crypto from "crypto";

/**
 * @deprecated Fake "Shamir" from pre-v2 era. These are independent SHA-256
 * derivations, NOT real secret-sharing — no threshold reconstruction possible.
 * Kept for reference and legacy-record detection only. Do not call from new code.
 * Use `splitAndAuthenticate` in `lib/shamir/shield.ts` instead.
 */
export function _legacyGenerateShards(
  data: string,
  total: number,
): Array<{
  index: number;
  id: string;
  data: string;
  location: string;
  status: string;
  createdAt: string;
  lastVerified: string;
}> {
  const shards = [];
  const now = new Date().toISOString();
  for (let i = 0; i < total; i++) {
    const shardId = crypto.randomBytes(16).toString("hex");
    const shardData = crypto
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

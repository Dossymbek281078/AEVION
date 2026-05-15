import { describe, test, expect, beforeAll, vi } from "vitest";
import crypto from "crypto";

beforeAll(() => {
  process.env.SHARD_HMAC_SECRET = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex",
  ).toString("base64");
});

import {
  createShieldRecord,
  ensureShieldTableShared,
} from "../src/lib/qshield/createRecord";
import { combineAndVerify } from "../src/lib/shamir/shield";
import { computeWitnessCid } from "../src/lib/shamir/witnessCid";

/**
 * Stub Pool: records every query but does not actually need a DB. The
 * createRecord helper only does INSERT statements + single SELECT-less
 * writes — perfectly fine to mock with vi.fn().
 */
function makePoolStub() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    return { rows: [] };
  });
  return { pool: { query } as any, queries };
}

describe("createShieldRecord — pure helper", () => {
  test("generates valid 2-of-3 SSS that combineAndVerify accepts", async () => {
    const { pool } = makePoolStub();
    const result = await createShieldRecord(pool, {
      objectTitle: "test",
      payload: { hello: "vitest" },
      ownerUserId: "u-123",
    });

    expect(result.shards).toHaveLength(3);
    expect(result.threshold).toBe(2);
    expect(result.totalShards).toBe(3);
    expect(result.distribution).toBe("legacy_all_local");
    expect(result.witnessCid).toBeNull();
    expect(result.ownerUserId).toBe("u-123");

    // The shards combine back to a key that signs and verifies under the
    // returned publicKey — strongest end-to-end check we can do.
    const verdict = combineAndVerify(
      result.shards as Parameters<typeof combineAndVerify>[0],
      result.id,
      result.publicKey,
    );
    expect(verdict.ok).toBe(true);
  });

  test("distributed_v2: persisted shards exclude index 1 + witnessCid is set", async () => {
    const { pool, queries } = makePoolStub();
    const result = await createShieldRecord(pool, {
      objectTitle: "distributed test",
      payload: { d: true },
      distribution: "distributed_v2",
      ownerUserId: "u-456",
    });

    expect(result.distribution).toBe("distributed_v2");
    expect(result.witnessCid).toBeTruthy();
    expect(result.shards).toHaveLength(3); // caller still gets all 3

    const insertQuery = queries.find((q) => q.sql.includes("INSERT INTO \"QuantumShield\""));
    expect(insertQuery).toBeTruthy();
    // shards column is the 7th param ($7)
    const persistedShards = JSON.parse(insertQuery!.params[6] as string);
    const persistedIndices = persistedShards.map((s: { index: number }) => s.index).sort();
    // Server only stores 2 + 3 — author keeps shard 1 offline.
    expect(persistedIndices).toEqual([2, 3]);

    const witnessInsert = queries.find((q) =>
      q.sql.includes("INSERT INTO \"QuantumShieldDistribution\""),
    );
    expect(witnessInsert).toBeTruthy();

    // CID is reproducible from the public shard 3 contents.
    const shard3 = result.shards.find((s) => s.index === 3)!;
    const reCid = computeWitnessCid({
      index: shard3.index,
      sssShare: shard3.sssShare,
      hmac: shard3.hmac,
      hmacKeyVersion: shard3.hmacKeyVersion,
    });
    expect(reCid).toBe(result.witnessCid);
  });

  test("rejects when neither objectTitle nor payload supplied", async () => {
    const { pool } = makePoolStub();
    await expect(
      createShieldRecord(pool, {
        ownerUserId: null,
      }),
    ).rejects.toThrow(/objectTitle or payload/);
  });

  test("ID is namespaced 'qs-<8-byte-hex>' and unique across calls", async () => {
    const { pool } = makePoolStub();
    const a = await createShieldRecord(pool, { objectTitle: "a", payload: 1 });
    const b = await createShieldRecord(pool, { objectTitle: "b", payload: 2 });
    expect(a.id).toMatch(/^qs-[0-9a-f]{16}$/);
    expect(b.id).toMatch(/^qs-[0-9a-f]{16}$/);
    expect(a.id).not.toBe(b.id);
  });

  test("threshold/totalShards are clamped within bounds", async () => {
    const { pool } = makePoolStub();
    const a = await createShieldRecord(pool, {
      objectTitle: "clamp",
      payload: 0,
      threshold: 999, // out of range → falls back to default
      totalShards: 999,
    });
    expect(a.threshold).toBe(2);
    expect(a.totalShards).toBe(3);
  });

  test("ensureShieldTableShared issues all required DDL statements", async () => {
    const { pool, queries } = makePoolStub();
    await ensureShieldTableShared(pool);
    const sqls = queries.map((q) => q.sql).join("\n");
    expect(sqls).toMatch(/CREATE TABLE IF NOT EXISTS "QuantumShield"/);
    expect(sqls).toMatch(/ADD COLUMN IF NOT EXISTS "ownerUserId"/);
    expect(sqls).toMatch(/CREATE INDEX IF NOT EXISTS "QuantumShield_ownerUserId_idx"/);
  });

  test("two consecutive calls produce different shards even for same payload", async () => {
    const { pool } = makePoolStub();
    const payload = { stable: "input" };
    const a = await createShieldRecord(pool, { objectTitle: "x", payload });
    const b = await createShieldRecord(pool, { objectTitle: "x", payload });
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.shards[0].sssShare).not.toBe(b.shards[0].sssShare);
  });
});

describe("HMAC tamper detection on shards (smoke check via verifyShardHmac)", () => {
  test("flipping a single byte in sssShare invalidates the HMAC", async () => {
    const { pool } = makePoolStub();
    const result = await createShieldRecord(pool, {
      objectTitle: "tamper",
      payload: { x: 1 },
    });
    const shard = result.shards[0];
    const tampered = {
      ...shard,
      sssShare: shard.sssShare.replace(/.$/, (c) => (c === "0" ? "1" : "0")),
    };
    // Reconstruction must reject — combineAndVerify checks every HMAC up-front.
    const verdict = combineAndVerify(
      [tampered, result.shards[1], result.shards[2]] as Parameters<typeof combineAndVerify>[0],
      result.id,
      result.publicKey,
    );
    expect(verdict.ok).toBe(false);
  });
});

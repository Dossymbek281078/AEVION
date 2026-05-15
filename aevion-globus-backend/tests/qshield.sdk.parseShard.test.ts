import { describe, test, expect } from "vitest";
import { parseShardSource } from "../sdk/qshield-client/index";

describe("@aevion/qshield-client parseShardSource", () => {
  const validShard = {
    index: 1,
    sssShare: "abc",
    hmac: "def",
    hmacKeyVersion: 1,
  };

  test("accepts a single shard object", () => {
    const out = parseShardSource(validShard);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(validShard);
  });

  test("accepts an array of shard objects", () => {
    const out = parseShardSource([validShard, { ...validShard, index: 2 }]);
    expect(out).toHaveLength(2);
  });

  test("accepts a bundle { shards: [...] } from Download All", () => {
    const out = parseShardSource({ shieldId: "qs-x", shards: [validShard, { ...validShard, index: 2 }] });
    expect(out).toHaveLength(2);
  });

  test("accepts a per-shard download { shieldId, shard, ... }", () => {
    const out = parseShardSource({ shieldId: "qs-x", shard: validShard, downloadedAt: "now" });
    expect(out).toHaveLength(1);
  });

  test("rejects shapes that don't match", () => {
    expect(parseShardSource(null)).toEqual([]);
    expect(parseShardSource(undefined)).toEqual([]);
    expect(parseShardSource(42)).toEqual([]);
    expect(parseShardSource("string")).toEqual([]);
    expect(parseShardSource({ random: "thing" })).toEqual([]);
    expect(parseShardSource({ index: "not-a-number", sssShare: "x", hmac: "y", hmacKeyVersion: 1 })).toEqual([]);
  });

  test("filters invalid items out of arrays", () => {
    const mixed = [
      validShard,
      { invalid: true },
      { ...validShard, index: 2 },
      null,
    ];
    expect(parseShardSource(mixed)).toHaveLength(2);
  });
});

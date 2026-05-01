import { describe, it, expect } from "vitest";
import { computeWitnessCid } from "../src/lib/shamir/witnessCid";

const baseShard = {
  index: 3,
  sssShare: "deadbeefcafebabe".repeat(4),
  hmac: "a".repeat(64),
  hmacKeyVersion: 1,
};

describe("computeWitnessCid", () => {
  it("is deterministic — same shard → same CID", () => {
    expect(computeWitnessCid(baseShard)).toBe(computeWitnessCid(baseShard));
  });

  it("produces a CID v1 multibase-prefixed string starting with 'b'", () => {
    const cid = computeWitnessCid(baseShard);
    expect(cid.startsWith("b")).toBe(true);
    expect(cid.length).toBeGreaterThan(50);
  });

  it("uses lowercase base32 alphabet (RFC 4648, no padding)", () => {
    const cid = computeWitnessCid(baseShard);
    expect(cid.slice(1)).toMatch(/^[a-z2-7]+$/);
  });

  it("changes CID when any shard field changes", () => {
    const original = computeWitnessCid(baseShard);
    expect(computeWitnessCid({ ...baseShard, index: 2 })).not.toBe(original);
    expect(computeWitnessCid({ ...baseShard, sssShare: "00" + baseShard.sssShare.slice(2) })).not.toBe(original);
    expect(computeWitnessCid({ ...baseShard, hmac: "b" + baseShard.hmac.slice(1) })).not.toBe(original);
    expect(computeWitnessCid({ ...baseShard, hmacKeyVersion: 2 })).not.toBe(original);
  });

  it("key order in input object doesn't affect CID (canonicalized)", () => {
    const a = { index: 3, sssShare: "x", hmac: "y", hmacKeyVersion: 1 };
    const b = { hmacKeyVersion: 1, hmac: "y", sssShare: "x", index: 3 };
    expect(computeWitnessCid(a)).toBe(computeWitnessCid(b));
  });
});

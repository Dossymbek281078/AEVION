import { describe, test, expect, beforeAll } from "vitest";
import crypto from "crypto";

beforeAll(() => {
  // 32 bytes base64 = 44 chars
  process.env.SHARD_HMAC_SECRET = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex",
  ).toString("base64");
});

import {
  combineAndVerify,
  generateEphemeralEd25519,
  splitAndAuthenticate,
  verifyShardHmac,
  wipeBuffer,
} from "../src/lib/shamir/shield";
import {
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
} from "../src/config/qright";

describe("Shamir SSS shield", () => {
  test("splitAndAuthenticate produces exactly SHAMIR_SHARDS shards with valid HMAC", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    expect(shards.length).toBe(SHAMIR_SHARDS);
    for (const s of shards) {
      expect(s.hmacKeyVersion).toBe(1);
      expect(typeof s.sssShare).toBe("string");
      expect(s.sssShare.length).toBeGreaterThan(0);
      expect(verifyShardHmac(s, shieldId)).toBe(true);
    }

    const indices = shards.map((s) => s.index).sort();
    expect(indices).toEqual([1, 2, 3]);
  });

  test("combineAndVerify succeeds with all 3 shards", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    const result = combineAndVerify(shards, shieldId, publicKeySpkiHex);
    expect(result.ok).toBe(true);
  });

  test("combineAndVerify succeeds with exactly threshold (2) shards", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    // Any 2 out of 3 should reconstruct
    const subsets = [
      [shards[0], shards[1]],
      [shards[0], shards[2]],
      [shards[1], shards[2]],
    ];

    for (const subset of subsets) {
      expect(subset.length).toBe(SHAMIR_THRESHOLD);
      const result = combineAndVerify(subset, shieldId, publicKeySpkiHex);
      expect(result.ok).toBe(true);
    }
  });

  test("combineAndVerify fails with only 1 shard (below threshold)", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    const result = combineAndVerify([shards[0]], shieldId, publicKeySpkiHex);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_SHARDS");
  });

  test("combineAndVerify rejects a shard with tampered HMAC before combine", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    // Flip one character of the HMAC of shard 0
    const flipped = {
      ...shards[0],
      hmac:
        shards[0].hmac.slice(0, -1) +
        (shards[0].hmac.slice(-1) === "0" ? "1" : "0"),
    };

    const result = combineAndVerify(
      [flipped, shards[1]],
      shieldId,
      publicKeySpkiHex,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_HMAC");
  });

  test("combineAndVerify rejects tampered sssShare (HMAC no longer matches)", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    const orig = shards[1].sssShare;
    const tampered = {
      ...shards[1],
      sssShare: orig.slice(0, -1) + (orig.slice(-1) === "0" ? "1" : "0"),
    };

    const result = combineAndVerify(
      [shards[0], tampered],
      shieldId,
      publicKeySpkiHex,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_HMAC");
  });

  test("combineAndVerify rejects shards from a different shield (shieldId binding)", () => {
    const shieldIdA = "qs-test-A-" + crypto.randomBytes(4).toString("hex");
    const shieldIdB = "qs-test-B-" + crypto.randomBytes(4).toString("hex");

    const a = generateEphemeralEd25519();
    const shardsA = splitAndAuthenticate(a.privateKeyRaw, shieldIdA);
    wipeBuffer(a.privateKeyRaw);

    // Attempt to verify shardsA as if they belonged to shieldIdB
    const result = combineAndVerify(shardsA, shieldIdB, a.publicKeySpkiHex);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_HMAC");
  });

  test("combineAndVerify rejects shards whose combined key doesn't match public key", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const a = generateEphemeralEd25519();
    const b = generateEphemeralEd25519();

    const shardsA = splitAndAuthenticate(a.privateKeyRaw, shieldId);
    wipeBuffer(a.privateKeyRaw);
    wipeBuffer(b.privateKeyRaw);

    // Shards are from keypair A but we claim public key B — must fail on signature verify
    const result = combineAndVerify(shardsA, shieldId, b.publicKeySpkiHex);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("RECONSTRUCTION_FAILED");
  });

  test("combineAndVerify rejects duplicate shard indices", () => {
    const shieldId = "qs-test-" + crypto.randomBytes(4).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();
    const shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    wipeBuffer(privateKeyRaw);

    const result = combineAndVerify(
      [shards[0], shards[0]],
      shieldId,
      publicKeySpkiHex,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("DUPLICATE_SHARD_INDEX");
  });
});

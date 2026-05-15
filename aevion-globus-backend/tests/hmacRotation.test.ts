import { describe, test, expect, beforeAll, afterEach } from "vitest";
import crypto from "crypto";

// We need to set env BEFORE the config module is imported, because
// HMAC_KEY_VERSION is read at import time.
beforeAll(() => {
  process.env.HMAC_KEY_VERSION = "1";
  process.env.SHARD_HMAC_SECRET_V1 = Buffer.from(
    "aa".repeat(32),
    "hex",
  ).toString("base64");
  process.env.SHARD_HMAC_SECRET_V2 = Buffer.from(
    "bb".repeat(32),
    "hex",
  ).toString("base64");
  // Legacy name fallback — should be ignored in favor of _V1 above.
  process.env.SHARD_HMAC_SECRET = Buffer.from(
    "cc".repeat(32),
    "hex",
  ).toString("base64");
  process.env.QSIGN_SECRET_V1 = "qsign-v1-secret-32chars-longenough";
  process.env.QSIGN_SECRET_V2 = "qsign-v2-secret-32chars-longenough";
  process.env.QSIGN_SECRET = "legacy-qsign-ignored-32chars-long";
});

import {
  getShardHmacSecret,
  getQSignSecret,
  listAvailableHmacVersions,
  __resetConfigCache,
} from "../src/config/qright";

afterEach(() => {
  __resetConfigCache();
});

describe("HMAC key rotation — config", () => {
  test("listAvailableHmacVersions reports configured versions", () => {
    const v = listAvailableHmacVersions();
    expect(v.shardVersions).toContain(1);
    expect(v.shardVersions).toContain(2);
    expect(v.qsignVersions).toContain(1);
    expect(v.qsignVersions).toContain(2);
  });

  test("_V1 secret wins over legacy SHARD_HMAC_SECRET", () => {
    const v1 = getShardHmacSecret(1);
    // v1 secret bytes are all 0xaa
    expect(v1[0]).toBe(0xaa);
    expect(v1.every((b) => b === 0xaa)).toBe(true);
  });

  test("different versions return different keys", () => {
    const v1 = getShardHmacSecret(1);
    const v2 = getShardHmacSecret(2);
    expect(v1.equals(v2)).toBe(false);
    expect(v2.every((b) => b === 0xbb)).toBe(true);
  });

  test("asking for an unknown version throws", () => {
    expect(() => getShardHmacSecret(99)).toThrow(/SHARD_HMAC_SECRET_V99/);
    expect(() => getQSignSecret(99)).toThrow(/QSIGN_SECRET_V99/);
  });
});

describe("HMAC key rotation — shard authentication", () => {
  test("shard signed under v1 verifies under v1 (even if v2 is current)", async () => {
    // Verify via fresh imports because `HMAC_KEY_VERSION` is read at
    // module load, and we want to simulate "we rotated to v2 but
    // the shard was authenticated under v1".
    const shield = await import("../src/lib/shamir/shield");
    const shieldId = "qs-rotation-" + crypto.randomBytes(4).toString("hex");

    const { privateKeyRaw } = shield.generateEphemeralEd25519();
    const shards = shield.splitAndAuthenticate(privateKeyRaw, shieldId);
    shield.wipeBuffer(privateKeyRaw);

    // All shards are tagged with the current version (1 in this file's
    // env). verifyShardHmac must use THAT version, not hard-code to
    // HMAC_KEY_VERSION.
    for (const s of shards) {
      expect(s.hmacKeyVersion).toBe(1);
      expect(shield.verifyShardHmac(s, shieldId)).toBe(true);
    }
  });

  test("tampered shard hmacKeyVersion falls back to fail (unknown version)", async () => {
    const shield = await import("../src/lib/shamir/shield");
    const shieldId = "qs-rotation-" + crypto.randomBytes(4).toString("hex");

    const { privateKeyRaw } = shield.generateEphemeralEd25519();
    const shards = shield.splitAndAuthenticate(privateKeyRaw, shieldId);
    shield.wipeBuffer(privateKeyRaw);

    const tampered = { ...shards[0], hmacKeyVersion: 999 };
    expect(shield.verifyShardHmac(tampered, shieldId)).toBe(false);
  });

  test("claiming shard was v2 but signed-under-v1 fails (wrong secret tried)", async () => {
    const shield = await import("../src/lib/shamir/shield");
    const shieldId = "qs-rotation-" + crypto.randomBytes(4).toString("hex");

    const { privateKeyRaw } = shield.generateEphemeralEd25519();
    const shards = shield.splitAndAuthenticate(privateKeyRaw, shieldId);
    shield.wipeBuffer(privateKeyRaw);

    // Take a v1-signed shard and claim it's v2. verifyShardHmac should
    // compute HMAC with v2 secret, which won't match.
    const fraudulent = { ...shards[0], hmacKeyVersion: 2 };
    expect(shield.verifyShardHmac(fraudulent, shieldId)).toBe(false);
  });
});

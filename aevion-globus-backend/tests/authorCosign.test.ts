import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  CosignError,
  reverifyAuthorCosign,
  verifyAuthorCosign,
  fingerprintPublicKey,
} from "../src/lib/cosign/authorCosign";

/**
 * Helper: deterministically build a (rawPub, rawPriv) Ed25519 keypair the
 * way a browser client would (32-byte seed → key). Returns base64-encoded
 * raw public key and a signer closure.
 */
function fakeBrowserKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  // Extract raw 32-byte public key from Node's SPKI export.
  const spki = publicKey.export({ format: "der", type: "spki" });
  const rawPub = spki.subarray(spki.length - 32);
  return {
    rawPubBase64: rawPub.toString("base64"),
    sign: (message: string): string =>
      crypto
        .sign(null, Buffer.from(message, "utf8"), privateKey)
        .toString("base64"),
  };
}

describe("authorCosign", () => {
  it("accepts a valid co-signature on contentHash", () => {
    const { rawPubBase64, sign } = fakeBrowserKeypair();
    const contentHash = "a".repeat(64);
    const sig = sign(contentHash);

    const result = verifyAuthorCosign(
      { authorPublicKey: rawPubBase64, authorSignature: sig },
      contentHash,
    );
    expect(result.authorPublicKey).toBe(rawPubBase64);
    expect(result.authorSignature).toBe(sig);
    expect(result.authorKeyAlgo).toBe("ed25519");
    expect(result.authorKeyFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("rejects a tampered signature", () => {
    const { rawPubBase64, sign } = fakeBrowserKeypair();
    const contentHash = "b".repeat(64);
    const goodSig = Buffer.from(sign(contentHash), "base64");
    // Flip one byte
    goodSig[0] ^= 0x01;
    const badSig = goodSig.toString("base64");

    expect(() =>
      verifyAuthorCosign(
        { authorPublicKey: rawPubBase64, authorSignature: badSig },
        contentHash,
      ),
    ).toThrowError(CosignError);
  });

  it("rejects when contentHash is changed (tamper-evident binding)", () => {
    const { rawPubBase64, sign } = fakeBrowserKeypair();
    const originalHash = "c".repeat(64);
    const sig = sign(originalHash);

    expect(() =>
      verifyAuthorCosign(
        { authorPublicKey: rawPubBase64, authorSignature: sig },
        // Different hash — even if attacker tries to attach a valid sig
        // to a different cert, verify must fail.
        "d".repeat(64),
      ),
    ).toThrowError(/SIGNATURE_MISMATCH|does not validate/);
  });

  it("rejects malformed public key (wrong length)", () => {
    expect(() =>
      verifyAuthorCosign(
        {
          authorPublicKey: Buffer.alloc(31).toString("base64"),
          authorSignature: Buffer.alloc(64).toString("base64"),
        },
        "e".repeat(64),
      ),
    ).toThrowError(/MALFORMED_PUBLIC_KEY|expected 32 bytes/);
  });

  it("rejects malformed signature (wrong length)", () => {
    const { rawPubBase64 } = fakeBrowserKeypair();
    expect(() =>
      verifyAuthorCosign(
        {
          authorPublicKey: rawPubBase64,
          authorSignature: Buffer.alloc(63).toString("base64"),
        },
        "f".repeat(64),
      ),
    ).toThrowError(/MALFORMED_SIGNATURE|expected 64 bytes/);
  });

  it("rejects when authorSignature is empty/missing", () => {
    const { rawPubBase64 } = fakeBrowserKeypair();
    let caught: unknown;
    try {
      verifyAuthorCosign(
        { authorPublicKey: rawPubBase64, authorSignature: "" },
        "1".repeat(64),
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CosignError);
    expect((caught as CosignError).code).toBe("MISSING_SIGNATURE");
  });

  it("reverifyAuthorCosign returns present:false for legacy rows", () => {
    const r = reverifyAuthorCosign(null, null, "9".repeat(64));
    expect(r).toEqual({ present: false });
  });

  it("reverifyAuthorCosign returns valid:true for intact records", () => {
    const { rawPubBase64, sign } = fakeBrowserKeypair();
    const contentHash = "2".repeat(64);
    const sig = sign(contentHash);

    const r = reverifyAuthorCosign(rawPubBase64, sig, contentHash);
    expect(r).toEqual({
      present: true,
      valid: true,
      fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });

  it("reverifyAuthorCosign returns valid:false (with fingerprint) when contentHash drifted", () => {
    const { rawPubBase64, sign } = fakeBrowserKeypair();
    const sig = sign("3".repeat(64));

    // Stored row says contentHash X but verify recomputes Y — sig must
    // fail because it was made over X. Surfacing the fingerprint lets
    // the UI tell the user WHICH author key fell out of sync.
    const r = reverifyAuthorCosign(rawPubBase64, sig, "4".repeat(64));
    expect(r.present).toBe(true);
    if (r.present) {
      expect(r.valid).toBe(false);
      expect(r.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("fingerprint is deterministic and 16 hex chars", () => {
    const pub = Buffer.alloc(32, 0xab);
    const fp1 = fingerprintPublicKey(pub);
    const fp2 = fingerprintPublicKey(pub);
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{16}$/);
  });
});

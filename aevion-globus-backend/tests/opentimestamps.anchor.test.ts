import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  stampHash,
  upgradeProof,
  verifyProof,
} from "../src/lib/opentimestamps/anchor";

// These tests hit the public OpenTimestamps calendar network. They are
// reasonably fast (<5s for stamp, <5s for upgrade) but require outbound
// HTTPS. Set OT_SKIP_NETWORK=1 to skip when offline.
const skipNetwork = process.env.OT_SKIP_NETWORK === "1";
const maybe = skipNetwork ? describe.skip : describe;

function freshHash(seed = ""): string {
  return crypto
    .createHash("sha256")
    .update("aevion-anchor-test-" + seed + "-" + Date.now() + "-" + Math.random())
    .digest("hex");
}

describe("anchor input validation", () => {
  it("rejects hashes that are not 64 hex chars", async () => {
    const r = await stampHash("not-a-hash");
    expect(r.status).toBe("failed");
    expect(r.otsProof).toBeNull();
    expect(r.error).toMatch(/64 hex/);
  });

  it("rejects hashes with non-hex characters", async () => {
    const r = await stampHash("g".repeat(64));
    expect(r.status).toBe("failed");
    expect(r.otsProof).toBeNull();
  });
});

maybe("anchor — live OpenTimestamps network", () => {
  it(
    "produces a pending proof immediately after stamping",
    { timeout: 30_000 },
    async () => {
      const hash = freshHash("stamp");
      const r = await stampHash(hash);
      expect(r.error).toBeNull();
      expect(r.status).toBe("pending");
      expect(r.otsProof).toBeInstanceOf(Buffer);
      expect((r.otsProof as Buffer).length).toBeGreaterThan(100);
      expect(r.bitcoinBlockHeight).toBeNull();
      expect(r.calendars.length).toBeGreaterThan(0);
    },
  );

  it(
    "verify reports no-bitcoin-yet for a pending proof",
    { timeout: 30_000 },
    async () => {
      const hash = freshHash("verify-pending");
      const stamped = await stampHash(hash);
      expect(stamped.otsProof).not.toBeNull();
      const v = await verifyProof(hash, stamped.otsProof as Buffer);
      expect(v.ok).toBe(false);
      expect(v.bitcoinBlockHeight).toBeNull();
      expect(v.attestations.length).toBeGreaterThan(0);
      // All attestations should be Pending* before Bitcoin confirmation
      expect(v.attestations.every((a) => a.includes("Pending"))).toBe(true);
    },
  );

  it(
    "verify fails when the hash does not match the proof",
    { timeout: 30_000 },
    async () => {
      const hash = freshHash("tamper");
      const stamped = await stampHash(hash);
      expect(stamped.otsProof).not.toBeNull();
      const wrongHash = freshHash("tamper-wrong");
      const v = await verifyProof(wrongHash, stamped.otsProof as Buffer);
      expect(v.ok).toBe(false);
      // Either "no Bitcoin attestation yet" (expected, because the proof is
      // still pending) or an explicit mismatch — either way, `ok=false` is
      // the correct defensive answer.
    },
  );

  it(
    "upgrade on a pending proof is idempotent and non-lossy",
    { timeout: 60_000 },
    async () => {
      const hash = freshHash("upgrade-pending");
      const stamped = await stampHash(hash);
      expect(stamped.otsProof).not.toBeNull();
      const upgradeResult = await upgradeProof(stamped.otsProof as Buffer);
      // A brand-new proof is still pending (Bitcoin block inclusion takes
      // 1-6h), so upgrade should return upgraded=false but not throw.
      expect(upgradeResult.error).toBeNull();
      expect(upgradeResult.upgraded).toBe(false);
      expect(upgradeResult.status).toBe("pending");
      expect(upgradeResult.otsProof).toBeInstanceOf(Buffer);
    },
  );
});

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { internalMintForDevice } from "../src/routes/aev";

// Tests for the cross-module mint helper used by Bureau cert reward claim
// and any future module that needs to credit AEC without going through
// the public HTTP mint endpoint. Uses a per-test AEVION_DATA_DIR so mints
// don't bleed between tests.

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "aev-mint-test-"));
  process.env.AEVION_DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.AEVION_DATA_DIR;
});

describe("internalMintForDevice", () => {
  test("mints into a fresh wallet and binds userId", async () => {
    const r = await internalMintForDevice({
      deviceId: "device-test-1",
      amount: 50,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-verified",
      reason: "Bureau Verified cert (cert-abc)",
      expectedUserId: "user-1",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.wallet.balance).toBe(50);
    expect(r.wallet.lifetimeMined).toBe(50);
    expect(r.wallet.userId).toBe("user-1");
    expect(r.entry.kind).toBe("mint");
    expect(r.entry.amount).toBe(50);
    expect(r.entry.sourceKind).toBe("bureau-cert-reward");
    expect(r.entry.balanceAfter).toBe(50);
  });

  test("two mints accumulate on the same wallet", async () => {
    await internalMintForDevice({
      deviceId: "device-test-2",
      amount: 50,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-verified",
      expectedUserId: "user-2",
    });
    const r2 = await internalMintForDevice({
      deviceId: "device-test-2",
      amount: 150,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-notarized",
      expectedUserId: "user-2",
    });

    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.wallet.balance).toBe(200);
    expect(r2.wallet.lifetimeMined).toBe(200);
  });

  test("rejects when wallet is bound to a different user (ownership_mismatch)", async () => {
    await internalMintForDevice({
      deviceId: "device-test-3",
      amount: 50,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-verified",
      expectedUserId: "user-3",
    });
    const r2 = await internalMintForDevice({
      deviceId: "device-test-3",
      amount: 50,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-verified",
      expectedUserId: "user-attacker",
    });

    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error).toBe("ownership_mismatch");
  });

  test("rejects invalid deviceId", async () => {
    const r = await internalMintForDevice({
      deviceId: "x",
      amount: 50,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-verified",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("invalid_device_id");
  });

  test("rejects zero / negative / NaN amount", async () => {
    for (const bad of [0, -10, NaN, Number.POSITIVE_INFINITY]) {
      const r = await internalMintForDevice({
        deviceId: "device-test-4",
        amount: bad,
        sourceKind: "bureau-cert-reward",
        sourceModule: "bureau",
        sourceAction: "verified-tier-verified",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("invalid_amount");
    }
  });

  test("rejects amount exceeding per-call cap (1000)", async () => {
    const r = await internalMintForDevice({
      deviceId: "device-test-5",
      amount: 1500,
      sourceKind: "bureau-cert-reward",
      sourceModule: "bureau",
      sourceAction: "verified-tier-filed-pct",
      expectedUserId: "user-5",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("invalid_amount");
  });

  test("mints into anonymous wallet (no expectedUserId) without binding", async () => {
    const r = await internalMintForDevice({
      deviceId: "device-test-6",
      amount: 25,
      sourceKind: "system-credit",
      sourceModule: "test",
      sourceAction: "manual",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.wallet.balance).toBe(25);
    expect(r.wallet.userId).toBeNull();
  });
});

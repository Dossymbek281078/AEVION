import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Tests for the cross-module credit helper used by the QRight royalty,
// CyberChess prize, and Planet certification webhooks to credit a real
// QTrade account instead of only recording a ledger entry (see #639/#660).
//
// qtrade.ts caches its loaded-from-disk state in module-level `loaded` /
// `accounts` / `operations` variables for the lifetime of the process (no
// per-call re-read like aev.ts's wallet store), so — unlike
// aevInternalMint.test.ts — a fresh AEVION_DATA_DIR per test wouldn't
// actually isolate anything after the first call. Instead: one shared data
// dir for the whole file, and a unique owner email per test.

let dataDir: string;

beforeAll(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "qtrade-credit-test-"));
  process.env.AEVION_DATA_DIR = dataDir;
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.AEVION_DATA_DIR;
});

function uniqueOwner(): string {
  return `credit-test-${randomUUID()}@example.com`;
}

describe("internalCreditAccount", () => {
  test("auto-provisions a fresh account and credits it", async () => {
    const { internalCreditAccount } = await import("../src/routes/qtrade");
    const owner = uniqueOwner();
    const r = await internalCreditAccount({ owner, amount: 7.25, memo: "test credit" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.balance).toBe(7.25);
    expect(r.accountId).toBeTruthy();
    expect(r.operationId).toBeTruthy();
  });

  test("second credit to the same owner accumulates on the same account", async () => {
    const { internalCreditAccount } = await import("../src/routes/qtrade");
    const owner = uniqueOwner();

    const first = await internalCreditAccount({ owner, amount: 10 });
    const second = await internalCreditAccount({ owner, amount: 5 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.accountId).toBe(first.accountId);
    expect(second.balance).toBe(15);
  });

  test("owner matching is case-insensitive", async () => {
    const { internalCreditAccount } = await import("../src/routes/qtrade");
    const owner = uniqueOwner();

    const first = await internalCreditAccount({ owner, amount: 3 });
    const second = await internalCreditAccount({ owner: owner.toUpperCase(), amount: 2 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.accountId).toBe(first.accountId);
    expect(second.balance).toBe(5);
  });

  test("rejects zero / negative / NaN amount", async () => {
    const { internalCreditAccount } = await import("../src/routes/qtrade");
    for (const bad of [0, -10, NaN, Number.POSITIVE_INFINITY]) {
      const r = await internalCreditAccount({ owner: uniqueOwner(), amount: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("invalid amount");
    }
  });

  test("rejects empty owner", async () => {
    const { internalCreditAccount } = await import("../src/routes/qtrade");
    const r = await internalCreditAccount({ owner: "   ", amount: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("owner required");
  });
});

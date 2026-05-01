import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createSharedPreset,
  listPublicSharedPresets,
  getSharedPreset,
  importSharedPreset,
  deleteSharedPreset,
} from "../src/services/qcoreai/store";

describe("QCoreSharedPreset (in-memory)", () => {
  test("createSharedPreset normalizes name + defaults strategy + isPublic=true", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const p = await createSharedPreset({
      ownerUserId: owner,
      name: "  Investor pitch  ",
      description: "Sequential with Sonnet writer + Haiku critic",
      // unknown strategy falls back to sequential
      strategy: "weird",
      overrides: { writer: { provider: "anthropic", model: "claude-sonnet-4-20250514" } },
    });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("Investor pitch");
    expect(p.strategy).toBe("sequential");
    expect(p.isPublic).toBe(true);
    expect(p.importCount).toBe(0);
    expect(p.ownerUserId).toBe(owner);
  });

  test("createSharedPreset rejects empty name", async () => {
    await expect(
      createSharedPreset({ ownerUserId: "u", name: "   " })
    ).rejects.toThrow(/name required/i);
  });

  test("listPublicSharedPresets sorts by importCount desc + filters by q", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const a = await createSharedPreset({ ownerUserId: u, name: "Investor brief" });
    const b = await createSharedPreset({ ownerUserId: u, name: "Bug triage" });
    const c = await createSharedPreset({ ownerUserId: u, name: "Code review", isPublic: false });

    // bump a's import count twice
    await importSharedPreset(a.id);
    await importSharedPreset(a.id);
    await importSharedPreset(b.id);

    const all = await listPublicSharedPresets();
    expect(all.find((p) => p.id === a.id)?.importCount).toBe(2);
    expect(all.find((p) => p.id === b.id)?.importCount).toBe(1);
    // Private c should not appear
    expect(all.find((p) => p.id === c.id)).toBeUndefined();
    // Sorted: a (2) before b (1)
    const idxA = all.findIndex((p) => p.id === a.id);
    const idxB = all.findIndex((p) => p.id === b.id);
    expect(idxA).toBeLessThan(idxB);

    // q filter
    const filtered = await listPublicSharedPresets("triage");
    expect(filtered.some((p) => p.id === b.id)).toBe(true);
    expect(filtered.some((p) => p.id === a.id)).toBe(false);
  });

  test("importSharedPreset increments importCount; returns null on private/missing", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const p = await createSharedPreset({ ownerUserId: u, name: "Public preset", isPublic: true });
    const priv = await createSharedPreset({ ownerUserId: u, name: "Private", isPublic: false });

    const r1 = await importSharedPreset(p.id);
    expect(r1?.importCount).toBe(1);
    const r2 = await importSharedPreset(p.id);
    expect(r2?.importCount).toBe(2);

    expect(await importSharedPreset(priv.id)).toBeNull();
    expect(await importSharedPreset("does-not-exist")).toBeNull();
  });

  test("deleteSharedPreset is owner-only", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const p = await createSharedPreset({ ownerUserId: owner, name: "Mine" });

    expect(await deleteSharedPreset(p.id, stranger)).toBe(false);
    expect(await getSharedPreset(p.id)).not.toBeNull();

    expect(await deleteSharedPreset(p.id, owner)).toBe(true);
    expect(await getSharedPreset(p.id)).toBeNull();
    // Idempotent: second delete returns false
    expect(await deleteSharedPreset(p.id, owner)).toBe(false);
  });

  test("getSharedPreset returns the row regardless of isPublic flag (gate is at route layer)", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const priv = await createSharedPreset({ ownerUserId: u, name: "Private one", isPublic: false });
    const fetched = await getSharedPreset(priv.id);
    expect(fetched?.id).toBe(priv.id);
    expect(fetched?.isPublic).toBe(false);
  });
});

import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createPipeline,
  listPipelines,
  listPublicPipelines,
  getPipeline,
  updatePipeline,
  deletePipeline,
  usePipeline,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

const STEPS = [{ role: "analyst" }, { role: "writer" }, { role: "critic" }];

describe("QCorePipeline (in-memory)", () => {
  test("createPipeline stores all fields", async () => {
    const owner = uid();
    const p = await createPipeline({ ownerUserId: owner, name: "Research chain", steps: STEPS, isPublic: false });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("Research chain");
    expect(p.steps).toHaveLength(3);
    expect(p.isPublic).toBe(false);
    expect(p.useCount).toBe(0);
  });

  test("listPipelines returns only owner's", async () => {
    const a = uid(), b = uid();
    await createPipeline({ ownerUserId: a, name: "A pipeline", steps: STEPS });
    await createPipeline({ ownerUserId: b, name: "B pipeline", steps: STEPS });
    const listA = await listPipelines(a);
    expect(listA.every((p) => p.ownerUserId === a)).toBe(true);
  });

  test("listPublicPipelines only shows isPublic=true", async () => {
    const owner = uid();
    const pub = await createPipeline({ ownerUserId: owner, name: "Public one", steps: STEPS, isPublic: true });
    await createPipeline({ ownerUserId: owner, name: "Private one", steps: STEPS, isPublic: false });
    const list = await listPublicPipelines();
    expect(list.some((p) => p.id === pub.id)).toBe(true);
    expect(list.every((p) => p.isPublic)).toBe(true);
  });

  test("updatePipeline is owner-only", async () => {
    const owner = uid(), other = uid();
    const p = await createPipeline({ ownerUserId: owner, name: "Original", steps: STEPS });
    const updated = await updatePipeline(p.id, owner, { name: "Updated" });
    expect(updated?.name).toBe("Updated");
    const denied = await updatePipeline(p.id, other, { name: "Hacked" });
    expect(denied).toBeNull();
  });

  test("deletePipeline is owner-only and idempotent", async () => {
    const owner = uid(), other = uid();
    const p = await createPipeline({ ownerUserId: owner, name: "To delete", steps: STEPS });
    expect(await deletePipeline(p.id, other)).toBe(false);
    expect(await deletePipeline(p.id, owner)).toBe(true);
    expect(await deletePipeline(p.id, owner)).toBe(false);
  });

  test("usePipeline increments useCount", async () => {
    const owner = uid();
    const p = await createPipeline({ ownerUserId: owner, name: "Popular", steps: STEPS, isPublic: true });
    expect(p.useCount).toBe(0);
    const u1 = await usePipeline(p.id);
    expect(u1?.useCount).toBe(1);
    const u2 = await usePipeline(p.id);
    expect(u2?.useCount).toBe(2);
  });

  test("listPublicPipelines filters by query", async () => {
    const owner = uid();
    await createPipeline({ ownerUserId: owner, name: "Deep research chain", steps: STEPS, isPublic: true });
    await createPipeline({ ownerUserId: owner, name: "Code review chain", steps: STEPS, isPublic: true });
    const filtered = await listPublicPipelines("research");
    expect(filtered.some((p) => p.name.includes("research"))).toBe(true);
    expect(filtered.some((p) => p.name === "Code review chain")).toBe(false);
  });
});

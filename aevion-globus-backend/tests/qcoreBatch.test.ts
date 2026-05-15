import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createBatch,
  getBatch,
  listBatches,
  updateBatchProgress,
  listBatchRuns,
  createSession,
  createRun,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("QCoreBatch (in-memory)", () => {
  test("createBatch stores all fields with correct defaults", async () => {
    const owner = uid();
    const b = await createBatch({
      ownerUserId: owner,
      strategy: "parallel",
      inputs: ["prompt A", "prompt B", "prompt C"],
    });
    expect(b.id).toBeTruthy();
    expect(b.ownerUserId).toBe(owner);
    expect(b.strategy).toBe("parallel");
    expect(b.totalRuns).toBe(3);
    expect(b.completedRuns).toBe(0);
    expect(b.failedRuns).toBe(0);
    expect(b.totalCostUsd).toBe(0);
    expect(b.status).toBe("running");
    expect(b.completedAt).toBeNull();
    expect(b.inputs).toEqual(["prompt A", "prompt B", "prompt C"]);
  });

  test("getBatch returns the row or null for missing id", async () => {
    const owner = uid();
    const b = await createBatch({ ownerUserId: owner, inputs: ["x"] });
    expect((await getBatch(b.id))?.id).toBe(b.id);
    expect(await getBatch("missing")).toBeNull();
  });

  test("listBatches returns only the owner's batches", async () => {
    const a = uid();
    const b = uid();
    await createBatch({ ownerUserId: a, inputs: ["A1"] });
    await createBatch({ ownerUserId: a, inputs: ["A2"] });
    await createBatch({ ownerUserId: b, inputs: ["B1"] });
    const listA = await listBatches(a);
    expect(listA.every((row) => row.ownerUserId === a)).toBe(true);
    expect(listA).toHaveLength(2);
  });

  test("updateBatchProgress accumulates deltas and marks done when all complete", async () => {
    const owner = uid();
    const b = await createBatch({ ownerUserId: owner, inputs: ["p1", "p2", "p3"] });

    await updateBatchProgress(b.id, { completedDelta: 1, costDelta: 0.01 });
    let cur = await getBatch(b.id);
    expect(cur?.completedRuns).toBe(1);
    expect(cur?.status).toBe("running");

    await updateBatchProgress(b.id, { completedDelta: 1, costDelta: 0.02 });
    await updateBatchProgress(b.id, { completedDelta: 1, costDelta: 0.005 });
    cur = await getBatch(b.id);
    expect(cur?.status).toBe("done");
    expect(cur?.completedAt).toBeTruthy();
    expect(cur?.totalCostUsd).toBeCloseTo(0.035);
  });

  test("updateBatchProgress with all failures sets status=error", async () => {
    const owner = uid();
    const b = await createBatch({ ownerUserId: owner, inputs: ["p1", "p2"] });
    await updateBatchProgress(b.id, { failedDelta: 1 });
    await updateBatchProgress(b.id, { failedDelta: 1 });
    const cur = await getBatch(b.id);
    expect(cur?.status).toBe("error");
  });

  test("listBatchRuns returns runs linked to the batch", async () => {
    const owner = uid();
    const b = await createBatch({ ownerUserId: owner, inputs: ["x", "y"] });
    const sess = await createSession({ userId: owner });
    const r1 = await createRun({ sessionId: sess.id, userInput: "x", batchId: b.id });
    const r2 = await createRun({ sessionId: sess.id, userInput: "y", batchId: b.id });
    // Unrelated run
    await createRun({ sessionId: sess.id, userInput: "z" });

    const runs = await listBatchRuns(b.id);
    expect(runs.map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(runs.every((r) => r.batchId === b.id)).toBe(true);
  });
});

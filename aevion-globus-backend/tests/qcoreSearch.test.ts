import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  searchQCore,
  setFollowUpFrom,
  createSession,
  createRun,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("V31 search + follow-up (in-memory fallback)", () => {
  test("searchQCore returns empty when DB is not ready", async () => {
    const user = uid();
    const results = await searchQCore(user, "anything", 10);
    // In-memory fallback returns [] because pool.query is mocked to reject.
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  test("setFollowUpFrom is a no-op when DB not ready (no throw)", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run1 = await createRun({ sessionId: sess.id, userInput: "original" });
    const run2 = await createRun({ sessionId: sess.id, userInput: "follow-up" });
    await expect(setFollowUpFrom(run2.id, run1.id)).resolves.toBeUndefined();
  });

  test("createRun accepts parentRunId and threadId", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const parent = await createRun({ sessionId: sess.id, userInput: "parent" });
    const child = await createRun({
      sessionId: sess.id,
      userInput: "child",
      parentRunId: parent.id,
      threadId: parent.id,
    });
    expect(child.parentRunId).toBe(parent.id);
    expect(child.threadId).toBe(parent.id);
  });
});

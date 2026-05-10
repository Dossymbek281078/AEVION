import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createPromptChain,
  listPromptChains,
  getPromptChain,
  deletePromptChain,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("V51 — Prompt chains (in-memory fallback)", () => {

  test("createPromptChain stores chain correctly", async () => {
    const userId = uid();
    const chain = await createPromptChain({
      userId,
      name: "My Test Chain",
      description: "A test chain",
      steps: [
        { inputTemplate: "Analyze: {prev_output}", strategy: "sequential" },
        { inputTemplate: "Summarize the analysis", strategy: "sequential", useOutputOf: 0 },
      ],
      isPublic: false,
    });

    expect(chain.id).toBeTruthy();
    expect(chain.userId).toBe(userId);
    expect(chain.name).toBe("My Test Chain");
    expect(chain.description).toBe("A test chain");
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0].inputTemplate).toBe("Analyze: {prev_output}");
    expect(chain.steps[1].useOutputOf).toBe(0);
    expect(chain.isPublic).toBe(false);
    expect(chain.runCount).toBe(0);
    expect(typeof chain.createdAt).toBe("string");
  });

  test("listPromptChains filters by userId", async () => {
    const userA = uid();
    const userB = uid();

    await createPromptChain({ userId: userA, name: "Chain A1", steps: [{ inputTemplate: "Prompt A1" }] });
    await createPromptChain({ userId: userA, name: "Chain A2", steps: [{ inputTemplate: "Prompt A2" }] });
    await createPromptChain({ userId: userB, name: "Chain B1", steps: [{ inputTemplate: "Prompt B1" }] });

    const aChains = await listPromptChains(userA);
    const bChains = await listPromptChains(userB);

    // userA chains: all should belong to userA
    for (const c of aChains) {
      expect(c.userId).toBe(userA);
    }
    // userB chains: only userB's
    for (const c of bChains) {
      expect(c.userId).toBe(userB);
    }

    const aNames = aChains.map((c) => c.name);
    expect(aNames).toContain("Chain A1");
    expect(aNames).toContain("Chain A2");
    expect(aNames).not.toContain("Chain B1");
  });

  test("deletePromptChain returns false for wrong user", async () => {
    const owner = uid();
    const other = uid();

    const chain = await createPromptChain({
      userId: owner,
      name: "Owner's Chain",
      steps: [{ inputTemplate: "Do something" }],
    });

    // Attempt to delete with a different userId
    const result = await deletePromptChain(chain.id, other);
    expect(result).toBe(false);

    // Original chain should still exist
    const stillExists = await getPromptChain(chain.id);
    expect(stillExists).not.toBeNull();
    expect(stillExists?.name).toBe("Owner's Chain");
  });

  test("getPromptChain returns null for missing id", async () => {
    const result = await getPromptChain("non-existent-id-12345");
    expect(result).toBeNull();
  });

});

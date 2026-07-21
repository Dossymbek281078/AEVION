import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createSession,
  createRun,
  insertMessage,
  getOpexSummary,
} from "../src/services/qcoreai/store";

describe("P2-5 — platform-wide OPEX summary (in-memory fallback)", () => {
  test("aggregates every user's calls per provider and model", async () => {
    const s1 = await createSession({ userId: "user-a", title: "A" });
    const s2 = await createSession({ userId: "user-b", title: "B" });
    const r1 = await createRun({ sessionId: s1.id, userInput: "q1" });
    const r2 = await createRun({ sessionId: s2.id, userInput: "q2" });

    await insertMessage({
      runId: r1.id, role: "agent", provider: "anthropic", model: "claude-sonnet-4-6",
      content: "x", tokensIn: 100, tokensOut: 200, costUsd: 0.01, ordering: 1,
    });
    await insertMessage({
      runId: r1.id, role: "agent", provider: "openai", model: "gpt-4o",
      content: "y", tokensIn: 50, tokensOut: 50, costUsd: 0.002, ordering: 2,
    });
    // Different user — must still be counted (platform-wide, unlike getAnalytics).
    await insertMessage({
      runId: r2.id, role: "agent", provider: "anthropic", model: "claude-sonnet-4-6",
      content: "z", tokensIn: 10, tokensOut: 20, costUsd: 0.001, ordering: 1,
    });
    // No provider — must be skipped entirely.
    await insertMessage({ runId: r2.id, role: "user", content: "hi", ordering: 2 });

    const opex = await getOpexSummary();

    expect(opex.source).toBe("memory");
    expect(opex.totals.calls).toBe(3);
    expect(opex.totals.tokensIn).toBe(160);
    expect(opex.totals.tokensOut).toBe(270);
    expect(opex.totals.costUsd).toBeCloseTo(0.013, 10);

    // Sorted by cost, anthropic first (0.011 vs 0.002).
    expect(opex.byProvider.map((p) => p.provider)).toEqual(["anthropic", "openai"]);
    const anthropic = opex.byProvider[0];
    expect(anthropic.calls).toBe(2);
    expect(anthropic.costUsd).toBeCloseTo(0.011, 10);

    const topModel = opex.byModel[0];
    expect(topModel.model).toBe("claude-sonnet-4-6");
    expect(topModel.tokens).toBe(330);
  });
});

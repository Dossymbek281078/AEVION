import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createAbTest,
  listAbTests,
  recordAbTestResult,
  deleteAbTest,
} from "../src/services/qcoreai/store";
import {
  setUserSetting,
  getUserSetting,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("V63 — A/B Testing (in-memory fallback)", () => {

  test("createAbTest stores with correct userId", async () => {
    const userId = uid();
    const test = await createAbTest({
      userId,
      name: "Test vs Control",
      promptA: "Write a haiku about the ocean",
      promptB: "Write a detailed essay about the ocean",
      strategy: "sequential",
    });

    expect(test.id).toBeTruthy();
    expect(test.userId).toBe(userId);
    expect(test.name).toBe("Test vs Control");
    expect(test.runsA).toBe(0);
    expect(test.runsB).toBe(0);
    expect(test.status).toBe("active");
  });

  test("listAbTests returns only user's tests", async () => {
    const userA = uid();
    const userB = uid();

    await createAbTest({ userId: userA, name: "Test A1", promptA: "Prompt A1a", promptB: "Prompt A1b" });
    await createAbTest({ userId: userA, name: "Test A2", promptA: "Prompt A2a", promptB: "Prompt A2b" });
    await createAbTest({ userId: userB, name: "Test B1", promptA: "Prompt B1a", promptB: "Prompt B1b" });

    const listA = await listAbTests(userA);
    const listB = await listAbTests(userB);

    const names = listA.map((t) => t.name);
    expect(names).toContain("Test A1");
    expect(names).toContain("Test A2");
    expect(names).not.toContain("Test B1");

    for (const t of listA) expect(t.userId).toBe(userA);
    for (const t of listB) expect(t.userId).toBe(userB);
  });

  test("recordAbTestResult updates avgCostA correctly", async () => {
    const userId = uid();
    const test = await createAbTest({
      userId,
      name: "Cost tracking test",
      promptA: "Short prompt",
      promptB: "Long prompt",
    });

    // Record two runs for variant A
    await recordAbTestResult(test.id, "a", 0.002, 0);
    await recordAbTestResult(test.id, "a", 0.004, 0);

    const list = await listAbTests(userId);
    const updated = list.find((t) => t.id === test.id)!;

    expect(updated.runsA).toBe(2);
    // avgCostA should be (0.002 + 0.004) / 2 = 0.003
    expect(Math.abs(updated.avgCostA - 0.003)).toBeLessThan(0.0001);
    // Variant B should be untouched
    expect(updated.runsB).toBe(0);
    expect(updated.avgCostB).toBe(0);
  });

  test("deleteAbTest returns false for wrong user", async () => {
    const owner = uid();
    const other = uid();

    const test = await createAbTest({ userId: owner, name: "Secret test", promptA: "A", promptB: "B" });
    const result = await deleteAbTest(test.id, other);
    expect(result).toBe(false);

    // Test should still exist for the owner
    const list = await listAbTests(owner);
    expect(list.some((t) => t.id === test.id)).toBe(true);
  });

});

describe("V64 — User Settings (in-memory fallback)", () => {

  test("setUserSetting stores and getUserSetting retrieves", async () => {
    const userId = uid();
    const value = { blockedWords: ["spam", "ads"], maxOutputLength: 4000 };

    await setUserSetting(userId, "content-filters", value);
    const retrieved = await getUserSetting(userId, "content-filters");

    expect(retrieved).toEqual(value);
    expect(retrieved.blockedWords).toContain("spam");
    expect(retrieved.maxOutputLength).toBe(4000);
  });

});

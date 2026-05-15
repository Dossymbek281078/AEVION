import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createBranch,
  listBranches,
  completeBranch,
} from "../src/services/qcoreai/store";
import {
  setUserSetting,
  getAllUserSettings,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }
function rid() { return "r-" + Math.random().toString(36).slice(2); }

describe("V67 — Conditional Run Branching (in-memory fallback)", () => {

  test("createBranch stores with parentRunId", async () => {
    const parentRunId = rid();
    const branch = await createBranch(
      parentRunId,
      "Try a debate approach instead",
      "What are the trade-offs of PostgreSQL vs DynamoDB?",
      "debate"
    );

    expect(branch.id).toBeTruthy();
    expect(branch.parentRunId).toBe(parentRunId);
    expect(branch.branchReason).toBe("Try a debate approach instead");
    expect(branch.alternativeInput).toContain("PostgreSQL");
    expect(branch.strategy).toBe("debate");
    expect(branch.status).toBe("pending");
    expect(branch.resultRunId).toBeNull();
  });

  test("listBranches filters by parentRunId", async () => {
    const parentA = rid();
    const parentB = rid();

    await createBranch(parentA, "Reason A1", "Input A1", "debate");
    await createBranch(parentA, "Reason A2", "Input A2", "sequential");
    await createBranch(parentB, "Reason B1", "Input B1", "parallel");

    const branchesA = await listBranches(parentA);
    const branchesB = await listBranches(parentB);

    expect(branchesA.length).toBeGreaterThanOrEqual(2);
    expect(branchesB.length).toBeGreaterThanOrEqual(1);

    for (const b of branchesA) expect(b.parentRunId).toBe(parentA);
    for (const b of branchesB) expect(b.parentRunId).toBe(parentB);

    const reasons = branchesA.map((b) => b.branchReason);
    expect(reasons).toContain("Reason A1");
    expect(reasons).toContain("Reason A2");
  });

  test("completeBranch updates resultRunId", async () => {
    const parentRunId = rid();
    const resultRunId = rid();

    const branch = await createBranch(
      parentRunId,
      "Complete me",
      "Alternative input for completion test",
      "parallel"
    );

    expect(branch.status).toBe("pending");
    expect(branch.resultRunId).toBeNull();

    const ok = await completeBranch(branch.id, resultRunId);
    expect(ok).toBe(true);

    // Verify via listBranches
    const branches = await listBranches(parentRunId);
    const updated = branches.find((b) => b.id === branch.id);
    expect(updated).toBeTruthy();
    expect(updated!.status).toBe("completed");
    expect(updated!.resultRunId).toBe(resultRunId);
  });

  test("getAllUserSettings returns merged settings", async () => {
    const userId = uid();

    await setUserSetting(userId, "routing_rules", [{ condition: "code_task", preferProvider: "anthropic", preferModel: "claude-sonnet-4-5" }]);
    await setUserSetting(userId, "theme", "dark");
    await setUserSetting(userId, "language", "en");

    const settings = await getAllUserSettings(userId);

    expect(settings).toHaveProperty("routing_rules");
    expect(settings).toHaveProperty("theme", "dark");
    expect(settings).toHaveProperty("language", "en");

    const rules = settings["routing_rules"];
    expect(Array.isArray(rules)).toBe(true);
    expect(rules[0].condition).toBe("code_task");
    expect(rules[0].preferProvider).toBe("anthropic");
  });

});

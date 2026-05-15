import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  addMemory,
  listMemories,
  deleteMemory,
  updateMemory,
  pinTemplate,
  createTemplate,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("V59 — AI Memory (in-memory fallback)", () => {

  test("addMemory stores with correct userId", async () => {
    const userId = uid();
    const mem = await addMemory(userId, "I prefer concise answers", { category: "preference", pinned: true });

    expect(mem.id).toBeTruthy();
    expect(mem.userId).toBe(userId);
    expect(mem.content).toBe("I prefer concise answers");
    expect(mem.category).toBe("preference");
    expect(mem.pinned).toBe(true);
  });

  test("listMemories filters by userId", async () => {
    const userA = uid();
    const userB = uid();

    await addMemory(userA, "User A fact 1");
    await addMemory(userA, "User A fact 2");
    await addMemory(userB, "User B fact");

    const listA = await listMemories(userA);
    const listB = await listMemories(userB);

    for (const m of listA) {
      expect(m.userId).toBe(userA);
    }
    const listAIds = listA.map((m) => m.content);
    expect(listAIds).toContain("User A fact 1");
    expect(listAIds).toContain("User A fact 2");
    expect(listAIds).not.toContain("User B fact");

    for (const m of listB) {
      expect(m.userId).toBe(userB);
    }
  });

  test("deleteMemory returns false for wrong user", async () => {
    const owner = uid();
    const other = uid();

    const mem = await addMemory(owner, "Secret memory");
    const result = await deleteMemory(mem.id, other);
    expect(result).toBe(false);

    // Memory should still exist for the owner
    const list = await listMemories(owner);
    expect(list.some((m) => m.id === mem.id)).toBe(true);
  });

  test("updateMemory returns null for wrong user", async () => {
    const owner = uid();
    const other = uid();

    const mem = await addMemory(owner, "Original content");
    const result = await updateMemory(mem.id, other, { content: "Hacked content" });
    expect(result).toBeNull();

    // Original should be unchanged
    const list = await listMemories(owner);
    const found = list.find((m) => m.id === mem.id);
    expect(found?.content).toBe("Original content");
  });

});

describe("V60 — Template pin (in-memory fallback)", () => {

  test("pinTemplate returns false for wrong user", async () => {
    const owner = uid();
    const other = uid();

    const tmpl = await createTemplate({
      ownerUserId: owner,
      name: "My Template",
      input: "test input",
      strategy: "sequential",
    });

    // Wrong user cannot pin
    const resultWrong = await pinTemplate(tmpl.id, other, true);
    expect(resultWrong).toBe(false);

    // Owner can pin
    const resultOwner = await pinTemplate(tmpl.id, owner, true);
    expect(resultOwner).toBe(true);
  });

});

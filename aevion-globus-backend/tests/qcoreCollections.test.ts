import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createCollection,
  listCollections,
  deleteCollection,
  createSnippet,
  assignSnippetToCollection,
  createSession,
  createRun,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("QCoreNotebookCollection (in-memory)", () => {
  test("createCollection stores fields", async () => {
    const owner = uid();
    const c = await createCollection({ ownerUserId: owner, name: "Research", description: "My research snippets", color: "#7c3aed" });
    expect(c.id).toBeTruthy();
    expect(c.ownerUserId).toBe(owner);
    expect(c.name).toBe("Research");
    expect(c.color).toBe("#7c3aed");
  });

  test("listCollections returns only owner's collections", async () => {
    const a = uid(), b = uid();
    await createCollection({ ownerUserId: a, name: "A1" });
    await createCollection({ ownerUserId: a, name: "A2" });
    await createCollection({ ownerUserId: b, name: "B1" });
    const listA = await listCollections(a);
    expect(listA.every((c) => c.ownerUserId === a)).toBe(true);
    expect(listA.some((c) => c.name === "A1")).toBe(true);
    expect(listA.some((c) => c.name === "B1")).toBe(false);
  });

  test("deleteCollection is owner-only", async () => {
    const owner = uid(), other = uid();
    const c = await createCollection({ ownerUserId: owner, name: "To delete" });
    expect(await deleteCollection(c.id, other)).toBe(false);
    expect((await listCollections(owner)).some((x) => x.id === c.id)).toBe(true);
    expect(await deleteCollection(c.id, owner)).toBe(true);
    expect((await listCollections(owner)).some((x) => x.id === c.id)).toBe(false);
  });

  test("assignSnippetToCollection links snippet to collection", async () => {
    const owner = uid();
    const coll = await createCollection({ ownerUserId: owner, name: "Test" });
    const sess = await createSession({ userId: owner });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const snippet = await createSnippet({ ownerUserId: owner, runId: run.id, content: "hello world" });
    const ok = await assignSnippetToCollection(snippet.id, coll.id, owner);
    expect(ok).toBe(true);
    // Unassign
    const ok2 = await assignSnippetToCollection(snippet.id, null, owner);
    expect(ok2).toBe(true);
  });
});

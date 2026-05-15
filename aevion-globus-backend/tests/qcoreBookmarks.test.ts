import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  bookmarkRun,
  unbookmarkRun,
  listBookmarks,
  isBookmarked,
  createSession,
  createRun,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("QCoreRunBookmark (in-memory)", () => {
  test("bookmarkRun creates bookmark with label", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const bk = await bookmarkRun(run.id, user, "My fav run");
    expect(bk.runId).toBe(run.id);
    expect(bk.userId).toBe(user);
    expect(bk.label).toBe("My fav run");
  });

  test("isBookmarked returns true after bookmark, false after unbookmark", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    expect(await isBookmarked(run.id, user)).toBe(false);
    await bookmarkRun(run.id, user);
    expect(await isBookmarked(run.id, user)).toBe(true);
    await unbookmarkRun(run.id, user);
    expect(await isBookmarked(run.id, user)).toBe(false);
  });

  test("listBookmarks returns only user's bookmarks", async () => {
    const a = uid(), b = uid();
    const sessA = await createSession({ userId: a });
    const sessB = await createSession({ userId: b });
    const runA = await createRun({ sessionId: sessA.id, userInput: "A" });
    const runB = await createRun({ sessionId: sessB.id, userInput: "B" });
    await bookmarkRun(runA.id, a);
    await bookmarkRun(runB.id, b);
    const listA = await listBookmarks(a);
    expect(listA.every((bk) => bk.userId === a)).toBe(true);
    expect(listA.some((bk) => bk.runId === runA.id)).toBe(true);
    expect(listA.some((bk) => bk.runId === runB.id)).toBe(false);
  });

  test("bookmarkRun upserts (no duplicate on re-bookmark)", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    await bookmarkRun(run.id, user, "first label");
    await bookmarkRun(run.id, user, "updated label");
    const list = await listBookmarks(user);
    const matching = list.filter((bk) => bk.runId === run.id);
    expect(matching).toHaveLength(1);
    expect(matching[0].label).toBe("updated label");
  });

  test("unbookmarkRun idempotent returns false on missing", async () => {
    const user = uid();
    expect(await unbookmarkRun("non-existent-run", user)).toBe(false);
  });
});

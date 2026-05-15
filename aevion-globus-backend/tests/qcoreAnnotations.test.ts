import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  listAnnotations,
  listAllAnnotations,
  createSession,
  createRun,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }

describe("QCoreAnnotation (in-memory fallback)", () => {
  test("createAnnotation stores a note on a run", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const ann = await createAnnotation(run.id, user, "final", 0, "Great answer!", "yellow");
    expect(ann.runId).toBe(run.id);
    expect(ann.userId).toBe(user);
    expect(ann.note).toBe("Great answer!");
    expect(ann.color).toBe("yellow");
    expect(ann.messageRole).toBe("final");
  });

  test("listAnnotations returns only annotations for that run + user", async () => {
    const user = uid();
    const other = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    await createAnnotation(run.id, user, "analyst", 0, "Note A");
    await createAnnotation(run.id, user, "writer", 1, "Note B");
    await createAnnotation(run.id, other, "critic", 0, "Other user note");
    const anns = await listAnnotations(run.id, user);
    expect(anns).toHaveLength(2);
    expect(anns.every((a) => a.userId === user)).toBe(true);
  });

  test("updateAnnotation changes note text", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const ann = await createAnnotation(run.id, user, "final", 0, "Old note");
    const updated = await updateAnnotation(ann.id, user, "New note", "green");
    expect(updated?.note).toBe("New note");
    expect(updated?.color).toBe("green");
  });

  test("updateAnnotation returns null for wrong user", async () => {
    const user = uid();
    const other = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const ann = await createAnnotation(run.id, user, "final", 0, "My note");
    const result = await updateAnnotation(ann.id, other, "Hacked note");
    expect(result).toBeNull();
  });

  test("deleteAnnotation removes the note", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const ann = await createAnnotation(run.id, user, "final", 0, "To delete");
    const ok = await deleteAnnotation(ann.id, user);
    expect(ok).toBe(true);
    const anns = await listAnnotations(run.id, user);
    expect(anns).toHaveLength(0);
  });

  test("deleteAnnotation returns false for wrong user", async () => {
    const user = uid();
    const other = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const ann = await createAnnotation(run.id, user, "final", 0, "Protected");
    const ok = await deleteAnnotation(ann.id, other);
    expect(ok).toBe(false);
  });

  test("listAllAnnotations returns across all runs for user", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run1 = await createRun({ sessionId: sess.id, userInput: "q1" });
    const run2 = await createRun({ sessionId: sess.id, userInput: "q2" });
    await createAnnotation(run1.id, user, "final", 0, "Ann 1");
    await createAnnotation(run2.id, user, "final", 0, "Ann 2");
    const all = await listAllAnnotations(user, 50);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.every((a) => a.userId === user)).toBe(true);
  });

  test("note text is truncated at 2000 chars", async () => {
    const user = uid();
    const sess = await createSession({ userId: user });
    const run = await createRun({ sessionId: sess.id, userInput: "test" });
    const longNote = "x".repeat(5000);
    const ann = await createAnnotation(run.id, user, "final", 0, longNote);
    expect(ann.note.length).toBe(2000);
  });
});

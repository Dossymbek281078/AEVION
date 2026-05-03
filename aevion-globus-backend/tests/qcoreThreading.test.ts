import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createSession,
  createRun,
  finishRun,
  getRun,
  getThread,
  buildThreadContext,
} from "../src/services/qcoreai/store";

async function mkSession(userId?: string) {
  return createSession({ userId: userId ?? "u-" + Math.random().toString(36).slice(2) });
}

describe("QCoreAI threading (in-memory)", () => {
  test("root run gets threadId = its own id, parentRunId = null", async () => {
    const sess = await mkSession();
    const run = await createRun({ sessionId: sess.id, userInput: "root question" });
    expect(run.parentRunId).toBeNull();
    expect(run.threadId).toBe(run.id);
  });

  test("reply run links parentRunId and inherits threadId", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "root" });
    const reply = await createRun({
      sessionId: sess.id,
      userInput: "follow-up",
      parentRunId: root.id,
      threadId: root.threadId,
    });
    expect(reply.parentRunId).toBe(root.id);
    expect(reply.threadId).toBe(root.id);
  });

  test("getThread returns all runs in a thread sorted oldest→newest", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "Q1" });
    const r2 = await createRun({
      sessionId: sess.id, userInput: "Q2",
      parentRunId: root.id, threadId: root.threadId,
    });
    const r3 = await createRun({
      sessionId: sess.id, userInput: "Q3",
      parentRunId: r2.id, threadId: root.threadId,
    });

    const thread = await getThread(root.id);
    expect(thread.map((r) => r.id)).toEqual([root.id, r2.id, r3.id]);
  });

  test("getThread with just the root id works (threadId = root.id)", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "solo" });
    const thread = await getThread(root.id);
    expect(thread).toHaveLength(1);
    expect(thread[0].id).toBe(root.id);
  });

  test("buildThreadContext builds user/assistant pairs up the chain", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "root question" });
    await finishRun(root.id, "done", { finalContent: "root answer" });

    const r2 = await createRun({
      sessionId: sess.id, userInput: "follow-up question",
      parentRunId: root.id, threadId: root.id,
    });
    await finishRun(r2.id, "done", { finalContent: "follow-up answer" });

    // Build context as seen from r2 (the parent chain = [root, r2])
    const ctx = await buildThreadContext(r2.id);
    expect(ctx).toHaveLength(4);
    expect(ctx[0]).toEqual({ role: "user", content: "root question" });
    expect(ctx[1]).toEqual({ role: "assistant", content: "root answer" });
    expect(ctx[2]).toEqual({ role: "user", content: "follow-up question" });
    expect(ctx[3]).toEqual({ role: "assistant", content: "follow-up answer" });
  });

  test("buildThreadContext on root with no finalContent returns only the user message", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "unanswered" });
    const ctx = await buildThreadContext(root.id);
    expect(ctx).toHaveLength(1);
    expect(ctx[0]).toEqual({ role: "user", content: "unanswered" });
  });

  test("getRun correctly returns parentRunId and threadId", async () => {
    const sess = await mkSession();
    const root = await createRun({ sessionId: sess.id, userInput: "base" });
    const reply = await createRun({
      sessionId: sess.id, userInput: "reply",
      parentRunId: root.id, threadId: root.id,
    });
    const fetched = await getRun(reply.id);
    expect(fetched?.parentRunId).toBe(root.id);
    expect(fetched?.threadId).toBe(root.id);
  });
});

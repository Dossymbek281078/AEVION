import { describe, test, expect, beforeAll, vi } from "vitest";
import crypto from "crypto";

// Force in-memory mode by making the SELECT 1 probe fail.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn().mockRejectedValue(new Error("no db")) }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  applyRefinement,
  createRun,
  createSession,
  deleteSession,
  ensureSession,
  finishRun,
  getMaxOrdering,
  getRun,
  getRunByShareToken,
  getSession,
  insertMessage,
  listMessages,
  listRuns,
  listSessions,
  renameSession,
  searchRuns,
  shareRun,
  unshareRun,
} from "../src/services/qcoreai/store";

const u1 = () => "user-" + crypto.randomBytes(4).toString("hex");

describe("QCoreAI store (in-memory mode)", () => {
  beforeAll(() => {
    // First call will probe and fail, flipping the store to in-memory mode.
    // Subsequent calls in this test process all use Maps.
  });

  test("createSession + getSession + ownership guard", async () => {
    const userId = u1();
    const otherUser = u1();
    const s = await createSession({ userId, title: "Hello" });
    expect(s.id).toBeTruthy();
    expect(s.title).toBe("Hello");
    expect(s.userId).toBe(userId);

    expect(await getSession(s.id, userId)).toMatchObject({ id: s.id });
    expect(await getSession(s.id, otherUser)).toBeNull(); // owned by user1
    expect(await getSession(s.id, null)).toBeNull(); // anonymous can't read owned
  });

  test("ensureSession reuses existing id; rejects cross-user", async () => {
    const u = u1();
    const s = await createSession({ userId: u, title: "Reuse" });
    const reused = await ensureSession({ sessionId: s.id, userId: u });
    expect(reused.id).toBe(s.id);

    await expect(
      ensureSession({ sessionId: s.id, userId: u1() })
    ).rejects.toThrow(/not owned/i);
  });

  test("renameSession + listSessions + deleteSession", async () => {
    const u = u1();
    const a = await createSession({ userId: u, title: "A" });
    const b = await createSession({ userId: u, title: "B" });

    const renamed = await renameSession(a.id, u, "A-prime");
    expect(renamed?.title).toBe("A-prime");

    const list = await listSessions(u, 50);
    expect(list.find((x) => x.id === a.id)?.title).toBe("A-prime");
    expect(list.find((x) => x.id === b.id)?.title).toBe("B");

    expect(await deleteSession(a.id, u)).toBe(true);
    expect(await getSession(a.id, u)).toBeNull();
    // Cross-user delete must fail
    expect(await deleteSession(b.id, u1())).toBe(false);
  });

  test("createRun + insertMessage + getMaxOrdering + finishRun", async () => {
    const u = u1();
    const sess = await createSession({ userId: u, title: "Run test" });
    const run = await createRun({
      sessionId: sess.id,
      userInput: "explain quantum superposition",
      strategy: "sequential",
      agentConfig: { strategy: "sequential" },
    });
    expect(run.status).toBe("running");

    await insertMessage({ runId: run.id, role: "user", content: "Q?", ordering: 0 });
    await insertMessage({
      runId: run.id, role: "analyst", stage: "draft",
      content: "plan", tokensIn: 10, tokensOut: 20, costUsd: 0.001, ordering: 1,
    });
    expect(await getMaxOrdering(run.id)).toBe(1);

    await insertMessage({
      runId: run.id, role: "writer", stage: "draft",
      content: "draft", tokensIn: 30, tokensOut: 80, costUsd: 0.002, ordering: 2,
    });
    expect(await getMaxOrdering(run.id)).toBe(2);

    const msgs = await listMessages(run.id);
    expect(msgs.map((m) => m.ordering)).toEqual([0, 1, 2]);

    await finishRun(run.id, "done", {
      finalContent: "final answer",
      totalDurationMs: 1234,
      totalCostUsd: 0.003,
    });

    const fresh = await getRun(run.id);
    expect(fresh?.status).toBe("done");
    expect(fresh?.finalContent).toBe("final answer");
    expect(fresh?.totalCostUsd).toBe(0.003);
  });

  test("finishRun accepts capped status", async () => {
    const u = u1();
    const sess = await createSession({ userId: u });
    const run = await createRun({ sessionId: sess.id, userInput: "expensive prompt" });
    await finishRun(run.id, "capped", {
      error: "cost cap reached: $0.5005 >= $0.5",
      finalContent: "partial",
      totalDurationMs: 500,
      totalCostUsd: 0.5005,
    });
    const fresh = await getRun(run.id);
    expect(fresh?.status).toBe("capped");
    expect(fresh?.finalContent).toBe("partial");
    expect(fresh?.error).toMatch(/cost cap reached/);
  });

  test("applyRefinement updates final + accumulates cost+duration", async () => {
    const u = u1();
    const sess = await createSession({ userId: u });
    const run = await createRun({ sessionId: sess.id, userInput: "x" });
    await finishRun(run.id, "done", {
      finalContent: "v1",
      totalDurationMs: 1000,
      totalCostUsd: 0.01,
    });

    const updated = await applyRefinement({
      runId: run.id,
      finalContent: "v2 refined",
      addCostUsd: 0.005,
      addDurationMs: 250,
    });
    expect(updated?.finalContent).toBe("v2 refined");
    expect(updated?.totalCostUsd).toBeCloseTo(0.015, 6);
    expect(updated?.totalDurationMs).toBe(1250);
  });

  test("shareRun/unshareRun produce idempotent token + reverse lookup", async () => {
    const u = u1();
    const sess = await createSession({ userId: u });
    const run = await createRun({ sessionId: sess.id, userInput: "share me" });
    await finishRun(run.id, "done", { finalContent: "yo" });

    const t = await shareRun(run.id, u);
    expect(typeof t).toBe("string");
    const t2 = await shareRun(run.id, u);
    expect(t2).toBe(t); // idempotent

    expect((await getRunByShareToken(t!))?.id).toBe(run.id);

    expect(await unshareRun(run.id, u)).toBe(true);
    expect(await getRunByShareToken(t!)).toBeNull();
    // Second unshare returns false (no token)
    expect(await unshareRun(run.id, u)).toBe(false);
  });

  test("searchRuns matches userInput / finalContent / title with sane preview", async () => {
    const u = u1();
    const a = await createSession({ userId: u, title: "Quantum compliance" });
    const b = await createSession({ userId: u, title: "Mundane plans" });
    const ra = await createRun({ sessionId: a.id, userInput: "what is QSign HMAC rotation" });
    await finishRun(ra.id, "done", { finalContent: "QSign rotates secrets via versioning." });
    const rb = await createRun({ sessionId: b.id, userInput: "weekend recipes" });
    await finishRun(rb.id, "done", { finalContent: "Try lasagna." });

    // Match on userInput
    const hits1 = await searchRuns(u, "QSign", 10);
    expect(hits1.length).toBeGreaterThanOrEqual(1);
    expect(hits1.find((h) => h.runId === ra.id)?.matched).toMatch(/input|final/);

    // Match on session title
    const hits2 = await searchRuns(u, "Mundane", 10);
    expect(hits2.find((h) => h.runId === rb.id)?.matched).toBe("title");

    // No match
    expect(await searchRuns(u, "zxcvbnm-no-match", 10)).toEqual([]);

    // Empty query → empty
    expect(await searchRuns(u, "", 10)).toEqual([]);

    // Cross-user isolation
    const otherHits = await searchRuns(u1(), "QSign", 10);
    expect(otherHits.find((h) => h.runId === ra.id)).toBeUndefined();
  });

  test("listRuns is sorted by startedAt ascending", async () => {
    const u = u1();
    const sess = await createSession({ userId: u });
    const r1 = await createRun({ sessionId: sess.id, userInput: "first" });
    // Tiny delay so timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await createRun({ sessionId: sess.id, userInput: "second" });

    const list = await listRuns(sess.id, 50);
    expect(list[0].id).toBe(r1.id);
    expect(list[1].id).toBe(r2.id);
  });
});

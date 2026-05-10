import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  setSessionAiSummary,
  getSessionAiSummary,
  checkAndIncrRateLimit,
  adminResetRateLimit,
  createSession,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }
function sid() { return "s-" + Math.random().toString(36).slice(2); }

describe("V47 — session AI summary (in-memory fallback)", () => {

  test("setSessionAiSummary + getSessionAiSummary round-trip", async () => {
    const userId = uid();
    const session = await createSession({ userId, title: "Test session" });

    await setSessionAiSummary(session.id, "This session covered 3 topics.");
    const cached = await getSessionAiSummary(session.id);

    expect(cached).not.toBeNull();
    expect(cached!.summary).toBe("This session covered 3 topics.");
    expect(typeof cached!.generatedAt).toBe("string");
  });

  test("getSessionAiSummary returns null before any summary is set", async () => {
    const userId = uid();
    const session = await createSession({ userId, title: "Fresh session" });

    const cached = await getSessionAiSummary(session.id);
    expect(cached).toBeNull();
  });

});

describe("V49 — per-user rate limits (in-memory fallback)", () => {

  test("checkAndIncrRateLimit allows when count < limit", async () => {
    const userId = uid();
    const result = await checkAndIncrRateLimit(userId, "test-bucket", 10, 86_400_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(typeof result.resetAt).toBe("string");
  });

  test("checkAndIncrRateLimit blocks when count >= limit", async () => {
    const userId = uid();
    const bucket = "strict-bucket";
    const limit = 2;
    const windowMs = 86_400_000;

    // Exhaust the limit
    await checkAndIncrRateLimit(userId, bucket, limit, windowMs);
    await checkAndIncrRateLimit(userId, bucket, limit, windowMs);
    const blocked = await checkAndIncrRateLimit(userId, bucket, limit, windowMs);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test("adminResetRateLimit removes the limit entry", async () => {
    const userId = uid();
    const bucket = "reset-bucket";

    // Create an entry
    await checkAndIncrRateLimit(userId, bucket, 5, 86_400_000);

    // Reset it
    const ok = await adminResetRateLimit(userId, bucket);
    expect(ok).toBe(true);

    // After reset, should allow again from 0
    const after = await checkAndIncrRateLimit(userId, bucket, 5, 86_400_000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(4);
  });

});

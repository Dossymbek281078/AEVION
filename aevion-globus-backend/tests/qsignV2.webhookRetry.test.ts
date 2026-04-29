import { describe, it, expect } from "vitest";
import {
  planNextStep,
  RETRY_DELAYS_MS,
  MAX_ATTEMPTS,
  type AttemptOutcome,
} from "../src/lib/qsignV2/webhooks";

const NOW = new Date("2026-04-29T12:00:00.000Z");

describe("qsignV2 webhook retry — planNextStep", () => {
  it("success → done regardless of attempt number", () => {
    const out: AttemptOutcome = { kind: "success", status: 200, durationMs: 42 };
    expect(planNextStep(1, out, NOW)).toEqual({ kind: "done" });
    expect(planNextStep(2, out, NOW)).toEqual({ kind: "done" });
    expect(planNextStep(MAX_ATTEMPTS, out, NOW)).toEqual({ kind: "done" });
  });

  it("4xx client error → failed immediately, no retry", () => {
    const out: AttemptOutcome = {
      kind: "client_error",
      status: 404,
      durationMs: 15,
      error: "HTTP 404",
    };
    expect(planNextStep(1, out, NOW)).toEqual({ kind: "failed", reason: "client_error" });
    // Even on a later attempt — same terminal verdict.
    expect(planNextStep(2, out, NOW)).toEqual({ kind: "failed", reason: "client_error" });
  });

  it("5xx server error after attempt 1 → retry at +5s", () => {
    const out: AttemptOutcome = {
      kind: "server_error",
      status: 503,
      durationMs: 100,
      error: "HTTP 503",
    };
    const next = planNextStep(1, out, NOW);
    expect(next.kind).toBe("retry");
    if (next.kind === "retry") {
      expect(next.nextAttemptAt.getTime()).toBe(NOW.getTime() + RETRY_DELAYS_MS[1]);
      expect(next.nextAttemptAt.getTime() - NOW.getTime()).toBe(5_000);
    }
  });

  it("5xx server error after attempt 2 → retry at +30s", () => {
    const out: AttemptOutcome = {
      kind: "server_error",
      status: 502,
      durationMs: 80,
      error: "HTTP 502",
    };
    const next = planNextStep(2, out, NOW);
    expect(next.kind).toBe("retry");
    if (next.kind === "retry") {
      expect(next.nextAttemptAt.getTime() - NOW.getTime()).toBe(30_000);
    }
  });

  it("5xx server error after attempt 3 → exhausted (failed)", () => {
    const out: AttemptOutcome = {
      kind: "server_error",
      status: 500,
      durationMs: 70,
      error: "HTTP 500",
    };
    expect(planNextStep(MAX_ATTEMPTS, out, NOW)).toEqual({
      kind: "failed",
      reason: "exhausted",
    });
  });

  it("network error treated like server error — retries until exhaustion", () => {
    const netOut: AttemptOutcome = {
      kind: "network_error",
      durationMs: 5_000,
      error: "timeout (5s)",
    };
    expect(planNextStep(1, netOut, NOW).kind).toBe("retry");
    expect(planNextStep(2, netOut, NOW).kind).toBe("retry");
    expect(planNextStep(MAX_ATTEMPTS, netOut, NOW)).toEqual({
      kind: "failed",
      reason: "exhausted",
    });
  });

  it("backoff schedule contract — [0, 5_000, 30_000]", () => {
    expect(RETRY_DELAYS_MS).toEqual([0, 5_000, 30_000]);
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("retry scheduling uses the supplied 'now' deterministically", () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const out: AttemptOutcome = {
      kind: "server_error",
      status: 503,
      durationMs: 1,
      error: "HTTP 503",
    };
    const next = planNextStep(1, out, fixed);
    if (next.kind !== "retry") throw new Error("expected retry");
    expect(next.nextAttemptAt.toISOString()).toBe("2026-01-01T00:00:05.000Z");
  });
});

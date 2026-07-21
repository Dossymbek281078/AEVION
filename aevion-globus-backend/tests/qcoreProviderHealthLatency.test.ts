import { describe, test, expect, vi, beforeEach } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe (same pattern as qcoreEval).
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  recordOutcome,
  latencySummary,
  providerLatencySummary,
  healthScore,
  resetProviderHealth,
} from "../src/services/qcoreai/providerHealth";

describe("providerHealth latency tracking", () => {
  beforeEach(() => resetProviderHealth());

  test("null p50 until minSamples successful timed calls", () => {
    recordOutcome("anthropic", "claude-sonnet-4-6", true, 1200);
    recordOutcome("anthropic", "claude-sonnet-4-6", true, 1400);
    expect(latencySummary("anthropic", "claude-sonnet-4-6")).toEqual({ p50Ms: null, samples: 2 });
  });

  test("median over successful timed calls, odd count", () => {
    for (const ms of [900, 3000, 1100]) recordOutcome("openai", "gpt-4o", true, ms);
    expect(latencySummary("openai", "gpt-4o")).toEqual({ p50Ms: 1100, samples: 3 });
  });

  test("median over successful timed calls, even count", () => {
    for (const ms of [1000, 2000, 3000, 4000]) recordOutcome("gemini", "gemini-2.5-flash", true, ms);
    expect(latencySummary("gemini", "gemini-2.5-flash")).toEqual({ p50Ms: 2500, samples: 4 });
  });

  test("failures and untimed calls are excluded from latency but still count for health", () => {
    recordOutcome("deepseek", "deepseek-chat", false, 30000); // failure with a duration — ignored for latency
    recordOutcome("deepseek", "deepseek-chat", true); // streaming success, no ms — ignored for latency
    for (const ms of [800, 850, 900]) recordOutcome("deepseek", "deepseek-chat", true, ms);
    expect(latencySummary("deepseek", "deepseek-chat")).toEqual({ p50Ms: 850, samples: 3 });
    expect(healthScore("deepseek", "deepseek-chat")).toBe(4 / 5);
  });

  test("unknown pair is neutral: no samples, null p50", () => {
    expect(latencySummary("grok", "grok-3")).toEqual({ p50Ms: null, samples: 0 });
  });

  test("providerLatencySummary pools timed samples across models", () => {
    recordOutcome("gemini", "gemini-2.5-flash", true, 1000);
    recordOutcome("gemini", "gemini-2.5-pro", true, 3000);
    recordOutcome("gemini", "gemini-2.5-flash", true, 2000);
    recordOutcome("gemini", "gemini-2.5-pro", false, 9000); // failure ignored
    expect(providerLatencySummary("gemini")).toEqual({ p50Ms: 2000, samples: 3 });
    // Provider prefix must not leak into look-alike names.
    expect(providerLatencySummary("gem")).toEqual({ p50Ms: null, samples: 0 });
  });
});

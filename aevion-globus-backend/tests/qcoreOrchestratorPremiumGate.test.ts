import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { runMultiAgent, type OrchestratorEvent } from "../src/services/qcoreai/orchestrator";

/**
 * Orchestrator-level behaviour of OrchestratorInput.premiumGate — the
 * QCOREAI_PREMIUM_QUOTA wire-in shipped 2026-07-26. Runs the full sequential
 * pipeline offline via the QCOREAI_STUB provider (no keys, no network), so
 * these assertions cover the real streamAgent() choke point, not a mock of it.
 */

const savedStub = process.env.QCOREAI_STUB;
const savedDelay = process.env.QCOREAI_STUB_DELAY;

beforeEach(() => {
  process.env.QCOREAI_STUB = "1";
  process.env.QCOREAI_STUB_DELAY = "0";
});

afterEach(() => {
  if (savedStub === undefined) delete process.env.QCOREAI_STUB;
  else process.env.QCOREAI_STUB = savedStub;
  if (savedDelay === undefined) delete process.env.QCOREAI_STUB_DELAY;
  else process.env.QCOREAI_STUB_DELAY = savedDelay;
});

async function collect(gen: AsyncGenerator<OrchestratorEvent>): Promise<OrchestratorEvent[]> {
  const events: OrchestratorEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("orchestrator premiumGate", () => {
  test("a gate that blocks the Critic yields premium_quota_exceeded and keeps the Writer draft as final", async () => {
    let calls = 0;
    const events = await collect(
      runMultiAgent({
        userInput: "Explain what a token quota is.",
        strategy: "sequential",
        maxRevisions: 0,
        // Analyst (1) and Writer (2) pass; Critic (3) trips the quota.
        premiumGate: async () => {
          calls += 1;
          return calls >= 3 ? { usedTokens: 5_000_000, limitTokens: 5_000_000 } : null;
        },
      })
    );

    const quota = events.find((e) => e.type === "premium_quota_exceeded");
    expect(quota).toBeDefined();
    if (quota?.type === "premium_quota_exceeded") {
      expect(quota.usedTokens).toBe(5_000_000);
      expect(quota.limitTokens).toBe(5_000_000);
      expect(quota.provider).toBeTruthy();
      expect(quota.model).toBeTruthy();
    }

    const err = events.find((e) => e.type === "error");
    expect(err).toBeDefined();
    if (err?.type === "error") {
      expect(err.message).toContain("premium-model monthly quota exhausted");
    }

    // The bailBudget precedent: partial output survives — the Writer draft
    // ships as final, and the run still closes with done.
    const writerEnd = events.find((e) => e.type === "agent_end" && e.role === "writer");
    const final = events.find((e) => e.type === "final");
    expect(final).toBeDefined();
    if (final?.type === "final" && writerEnd?.type === "agent_end") {
      expect(final.content).toBe(writerEnd.content);
      expect(final.content.length).toBeGreaterThan(0);
    }
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  test("a gate that never trips leaves the run untouched", async () => {
    const events = await collect(
      runMultiAgent({
        userInput: "Explain what a token quota is.",
        strategy: "sequential",
        maxRevisions: 0,
        premiumGate: async () => null,
      })
    );
    expect(events.some((e) => e.type === "premium_quota_exceeded")).toBe(false);
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(events.some((e) => e.type === "final")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  test("a gate that throws fails open (the run completes normally)", async () => {
    const events = await collect(
      runMultiAgent({
        userInput: "Explain what a token quota is.",
        strategy: "sequential",
        maxRevisions: 0,
        premiumGate: async () => {
          throw new Error("metering store is down");
        },
      })
    );
    expect(events.some((e) => e.type === "premium_quota_exceeded")).toBe(false);
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(events.some((e) => e.type === "final")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});

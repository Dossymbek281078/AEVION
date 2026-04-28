import { describe, test, expect, vi } from "vitest";

// Mock both providers and the DB pool so the orchestrator runs end-to-end
// without network or PG.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn().mockRejectedValue(new Error("no db")) }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

// Capture the user prompts each agent receives so we can assert guidance
// gets spliced into the right stage's prompt.
const seenUserPrompts: Array<{ provider: string; model: string; lastUser: string }> = [];

vi.mock("../src/services/qcoreai/providers", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/services/qcoreai/providers")>();
  async function* fakeStream(
    providerId: string,
    messages: Array<{ role: string; content: string }>,
    model: string
  ) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    seenUserPrompts.push({ provider: providerId, model, lastUser });
    // Emit a tiny chunk + done so the orchestrator finishes this stage.
    yield { kind: "text", text: `ok-${providerId}-${model}` };
    yield { kind: "done", tokensIn: 5, tokensOut: 5 };
  }
  return {
    ...orig,
    streamProvider: fakeStream,
  };
});

import { runMultiAgent, OrchestratorEvent } from "../src/services/qcoreai/orchestrator";

beforeEach(() => {
  seenUserPrompts.length = 0;
  // Force an Anthropic key so buildAgent picks it as the default provider.
  process.env.ANTHROPIC_API_KEY = "test-key";
});

import { beforeEach } from "vitest";

async function collect(gen: AsyncGenerator<OrchestratorEvent>): Promise<OrchestratorEvent[]> {
  const out: OrchestratorEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("Orchestrator — human-in-the-loop guidance polling", () => {
  test("sequential: guidance queued before Writer is spliced into Writer prompt + emits guidance_applied", async () => {
    let drainedOnce = false;
    const drainPendingGuidance = () => {
      if (drainedOnce) return null;
      drainedOnce = true;
      return "Add a TL;DR at the top.";
    };

    const events = await collect(
      runMultiAgent({
        userInput: "Explain RAG.",
        strategy: "sequential",
        maxRevisions: 0,
        drainPendingGuidance,
      })
    );

    const guidanceEvts = events.filter((e) => e.type === "guidance_applied") as Array<
      Extract<OrchestratorEvent, { type: "guidance_applied" }>
    >;
    expect(guidanceEvts.length).toBe(1);
    expect(guidanceEvts[0].nextRole).toBe("writer");
    expect(guidanceEvts[0].nextStage).toBe("draft");
    expect(guidanceEvts[0].text).toMatch(/TL;DR/);

    // Writer (2nd agent call) should see the guidance in its user prompt.
    expect(seenUserPrompts.length).toBeGreaterThanOrEqual(2);
    const writerPrompt = seenUserPrompts[1].lastUser;
    expect(writerPrompt).toMatch(/User guidance \(mid-run/);
    expect(writerPrompt).toMatch(/TL;DR/);

    // Critic (3rd) should NOT have it because we drained on first poll.
    const criticPrompt = seenUserPrompts[2]?.lastUser || "";
    expect(criticPrompt).not.toMatch(/TL;DR/);
  });

  test("no guidance: no guidance_applied events and prompts unaffected", async () => {
    const events = await collect(
      runMultiAgent({
        userInput: "Explain RAG.",
        strategy: "sequential",
        maxRevisions: 0,
      })
    );
    expect(events.find((e) => e.type === "guidance_applied")).toBeUndefined();
    for (const p of seenUserPrompts) {
      expect(p.lastUser).not.toMatch(/User guidance/);
    }
  });

  test("drain returning empty string is treated as no-guidance", async () => {
    const events = await collect(
      runMultiAgent({
        userInput: "Explain RAG.",
        strategy: "sequential",
        maxRevisions: 0,
        drainPendingGuidance: () => "",
      })
    );
    expect(events.find((e) => e.type === "guidance_applied")).toBeUndefined();
  });

  test("parallel: guidance flows into BOTH writers' prompts", async () => {
    const drainPendingGuidance = () => "Be concise; ≤200 words.";
    let dispensed = 0;
    const drain = () => {
      if (dispensed > 0) return null;
      dispensed++;
      return drainPendingGuidance();
    };

    seenUserPrompts.length = 0;
    const events = await collect(
      runMultiAgent({
        userInput: "Compare ICEs and EVs.",
        strategy: "parallel",
        drainPendingGuidance: drain,
      })
    );

    const guidanceEvts = events.filter((e) => e.type === "guidance_applied");
    expect(guidanceEvts.length).toBe(1);

    // Writer A (idx 1) and Writer B (idx 2) should both contain the guidance.
    expect(seenUserPrompts[1].lastUser).toMatch(/concise/);
    expect(seenUserPrompts[2].lastUser).toMatch(/concise/);
  });

  test("debate: guidance applied before Pro+Con; moderator stage can also pull a fresh interjection", async () => {
    const queue = ["Use bullet points everywhere.", "End with a verdict line."];
    const drain = () => queue.shift() || null;

    seenUserPrompts.length = 0;
    const events = await collect(
      runMultiAgent({
        userInput: "Should we use SQL or NoSQL for X?",
        strategy: "debate",
        drainPendingGuidance: drain,
      })
    );

    const guidanceEvts = events.filter((e) => e.type === "guidance_applied") as Array<
      Extract<OrchestratorEvent, { type: "guidance_applied" }>
    >;
    expect(guidanceEvts.length).toBe(2);
    // First guidance lands on writer/draft (advocates), second on critic/judge (moderator).
    expect(guidanceEvts[0].nextRole).toBe("writer");
    expect(guidanceEvts[1].nextRole).toBe("critic");

    // Pro (idx 1) and Con (idx 2) prompts contain first guidance.
    expect(seenUserPrompts[1].lastUser).toMatch(/bullet points/);
    expect(seenUserPrompts[2].lastUser).toMatch(/bullet points/);
    // Moderator (idx 3) prompt contains second.
    expect(seenUserPrompts[3].lastUser).toMatch(/verdict line/);
  });
});

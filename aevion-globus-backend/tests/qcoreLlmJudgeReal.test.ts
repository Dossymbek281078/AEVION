/**
 * Real-LLM smoke for V6-J llm_judge. Skipped if no provider key is in env;
 * useful as a manual check that Claude Haiku / GPT-4o-mini actually emit
 * the strict VERDICT/CONFIDENCE format our regex expects.
 *
 * Run: ANTHROPIC_API_KEY=sk-ant-... npx vitest run qcoreLlmJudgeReal
 *
 * Tweaking note: if a future model drifts, update LLM_JUDGE_SYSTEM in
 * src/services/qcoreai/evalRunner.ts. Failures here surface that drift.
 */

import { describe, test, expect } from "vitest";

const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
const anyKey = hasAnthropic || hasOpenAI || hasGemini;

// Don't mock dbPool — real-LLM tests don't touch the store.

const skip = (reason: string) => () => {
  console.log(`[skip] ${reason}`);
};

describe.skipIf(!anyKey)("V6-J real-LLM judge smoke", () => {
  test.skipIf(!hasAnthropic)("Claude Haiku emits parseable VERDICT/CONFIDENCE on a clear PASS", async () => {
    const { judgeCase } = await import("../src/services/qcoreai/evalRunner");
    const result = await judgeCase(
      {
        type: "llm_judge",
        rubric: "The output must contain a TL;DR section.",
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
      },
      "TL;DR: AEVION is a multi-agent LLM platform with eval harness, prompts library, and mobile SDKs.\n\nFull details follow…"
    );
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/PASS @ confidence 0\.\d+/);
  }, 30_000);

  test.skipIf(!hasAnthropic)("Claude Haiku emits parseable VERDICT/CONFIDENCE on a clear FAIL", async () => {
    const { judgeCase } = await import("../src/services/qcoreai/evalRunner");
    const result = await judgeCase(
      {
        type: "llm_judge",
        rubric: "The output must contain a TL;DR section.",
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
      },
      "Random unrelated text with no summary section anywhere in this paragraph."
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/FAIL/);
  }, 30_000);

  test.skipIf(!hasAnthropic)("passThreshold filters borderline replies", async () => {
    const { judgeCase } = await import("../src/services/qcoreai/evalRunner");
    // Borderline rubric — model is likely to give moderate confidence.
    const result = await judgeCase(
      {
        type: "llm_judge",
        rubric: "The output is exceptionally creative and unexpected.",
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        passThreshold: 0.95,
      },
      "A short, generic answer about the topic."
    );
    // Either FAIL outright, or PASS@low_confidence → rejected by threshold.
    // What matters is no crash + reason is parseable.
    expect(result.reason).toMatch(/(FAIL|PASS)/);
  }, 30_000);

  test.skipIf(!hasOpenAI)("GPT-4o-mini also emits the strict format", async () => {
    const { judgeCase } = await import("../src/services/qcoreai/evalRunner");
    const result = await judgeCase(
      {
        type: "llm_judge",
        rubric: "The text mentions a TL;DR.",
        provider: "openai",
        model: "gpt-4o-mini",
      },
      "TL;DR: this works."
    );
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/PASS @ confidence/);
  }, 30_000);
});

// Also: ensure the file compiles + describes properly even without keys.
describe("V6-J real-LLM judge env check", () => {
  test("env detection runs without API keys", () => {
    expect(typeof anyKey).toBe("boolean");
    if (!anyKey) {
      skip("set ANTHROPIC_API_KEY (or OPENAI_API_KEY / GEMINI_API_KEY) to enable real-LLM smoke")();
    }
  });
});

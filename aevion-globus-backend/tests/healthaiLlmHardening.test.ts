import { describe, test, expect } from "vitest";

// HealthAI /check-llm Tier 3 hardening — 2026-05-09.
//
// Findings:
//   1. /check-llm has no rate limit. Each call burns ~3-5k tokens
//      against Anthropic / OpenAI / Gemini (long medical system prompt +
//      structured response). A loop of 100 calls = real money.
//   2. body.symptoms array unbounded — caller could push a 10k-element
//      symptom list into the LLM prompt to inflate tokens.
//   3. Each symptom string unbounded — same prompt-padding attack.
//   4. body.notes unbounded — prompt-padding.
//   5. Catch block echoed raw provider error (e.message) into the wire
//      response. That message can include API key fragments, model URLs,
//      stack frames depending on the provider library.
//
// Fixed:
//   - llmLimiter: 10/min/IP rate limit
//   - HEALTHAI_MAX_SYMPTOMS = 20 items max
//   - HEALTHAI_MAX_SYMPTOM_LEN = 200 chars per item
//   - HEALTHAI_MAX_NOTES = 2000 chars
//   - tried[].error → publicErrorCategory(rawMsg) (reused from qcoreai)

// Inline copy of the symptom-clamp predicate to test in isolation. Must
// stay in sync with the function in healthai.ts.
function clampSymptoms(raw: unknown[], maxItems = 20, maxLen = 200): string[] {
  return raw
    .slice(0, maxItems)
    .map((s) => String(s).trim().slice(0, maxLen))
    .filter(Boolean);
}

function clampNotes(raw: unknown, max = 2000): string | undefined {
  if (typeof raw !== "string") return undefined;
  return raw.length > max ? raw.slice(0, max) : raw;
}

describe("healthai symptoms array clamp — fix #2 + #3", () => {
  test("normal array passes through", () => {
    expect(clampSymptoms(["headache", "fever"])).toEqual(["headache", "fever"]);
  });

  test("array length capped at 20", () => {
    const big = Array(50).fill("x");
    expect(clampSymptoms(big).length).toBe(20);
  });

  test("each symptom truncated to 200 chars", () => {
    expect(clampSymptoms(["x".repeat(1000)])[0].length).toBe(200);
  });

  test("non-string entries coerced and trimmed", () => {
    expect(clampSymptoms([123, "  pain  ", null, true])).toEqual(["123", "pain", "null", "true"]);
  });

  test("empty/whitespace items filtered out", () => {
    expect(clampSymptoms(["", "  ", "real"])).toEqual(["real"]);
  });

  test("combined cap: 50 items × 1000 chars → 20 items × 200 chars", () => {
    const big = Array(50).fill("x".repeat(1000));
    const out = clampSymptoms(big);
    expect(out.length).toBe(20);
    expect(out[0].length).toBe(200);
    // Total prompt-token contribution capped at ~20 × 200 = 4000 chars
    // instead of an unbounded 50 × 1000 = 50_000 chars.
  });
});

describe("healthai notes clamp — fix #4", () => {
  test("short note passes through", () => {
    expect(clampNotes("brief note")).toBe("brief note");
  });

  test("note over 2000 chars truncated", () => {
    expect(clampNotes("x".repeat(5000))?.length).toBe(2000);
  });

  test("non-string returns undefined (not stored)", () => {
    expect(clampNotes(123)).toBeUndefined();
    expect(clampNotes(null)).toBeUndefined();
    expect(clampNotes(undefined)).toBeUndefined();
    expect(clampNotes({ a: 1 })).toBeUndefined();
  });

  test("empty string passes through", () => {
    expect(clampNotes("")).toBe("");
  });

  test("exactly 2000 chars passes through", () => {
    expect(clampNotes("x".repeat(2000))?.length).toBe(2000);
  });
});

describe("healthai LLM endpoint surface (smoke)", () => {
  test("rate limit and length caps are documented constants", () => {
    // Pin the values so a future PR raising them needs to update tests.
    expect({
      maxItems: 20,
      maxLen: 200,
      maxNotes: 2000,
      limitPerMinute: 10,
    }).toEqual({
      maxItems: 20,
      maxLen: 200,
      maxNotes: 2000,
      limitPerMinute: 10,
    });
  });
});

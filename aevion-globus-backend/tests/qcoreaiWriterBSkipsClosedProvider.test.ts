/**
 * Второй писатель параллельного режима не уходит к поставщику «не в строю».
 *
 * 20.10.2026: живой прогон /api/qcoreai/multi-agent (strategy parallel) — писатели
 * anthropic + openai, витринное «two writers on different models» правда. Но
 * buildWriterB, в отличие от соседних сборщиков ролей, не пропускал закрытых
 * поставщиков: когда у openai кончатся деньги, параллельный режим упадёт целиком
 * («Parallel writers failed»), а не перейдёт к живому.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildWriterB } from "../src/services/qcoreai/agents";
import { noteProviderOutage, __resetProviderOutages } from "../src/services/qcoreai/providers";

const КЛЮЧИ = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" } as const;
const прежние: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [k, v] of Object.entries(КЛЮЧИ)) { прежние[k] = process.env[k]; process.env[k] = v; }
  __resetProviderOutages();
});
afterEach(() => {
  for (const k of Object.keys(КЛЮЧИ)) { if (прежние[k] === undefined) delete process.env[k]; else process.env[k] = прежние[k]; }
  __resetProviderOutages();
});

const первый = { role: "writer" as const, provider: "anthropic", model: "m", systemPrompt: "s", temperature: 0.7 };

describe("buildWriterB", () => {
  it("КОНТРОЛЬ: все живы — второй писатель у другого поставщика (openai)", () => {
    expect(buildWriterB(первый as any)?.provider).toBe("openai");
  });

  it("openai закрыт поставщиком — второй писатель у следующего живого, не у закрытого", () => {
    noteProviderOutage("openai", "You exceeded your current quota (insufficient_quota)");
    const b = buildWriterB(первый as any);
    expect(b?.provider).not.toBe("openai");
    expect(b?.provider).toBe("gemini");
  });
});

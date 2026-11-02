// «Обещает = делает». Замер 2.11.2026: /api/qcoreai/providers — подключены anthropic, openai, gemini,
// openrouter; deepseek и grok — configured:false. FAQ цен и meta /qfusionai не называют их и «5 провайдеров».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../../..", p), "utf8");

describe("FAQ цен и meta QFusionAI не обещают неподключённых поставщиков", () => {
  for (const l of ["en", "ru", "kk"]) {
    it(`i18n ${l}: ответ aiNotWorking без DeepSeek/Grok/«5»`, () => {
      const m = read(`lib/i18n-lang/${l}.ts`).match(/"constitution\.pricing\.faq\.aiNotWorking\.a": "([^"]*)"/);
      expect(m).not.toBeNull();
      expect(m![1]).not.toMatch(/DeepSeek|Grok|5 (providers|провайдер)|5 провайдермен/);
    });
  }
  it("meta /qfusionai без DeepSeek/Grok/«пять провайдеров»", () => {
    expect(read("app/qfusionai/layout.tsx")).not.toMatch(/DeepSeek|Grok|пять провайдеров/);
    expect(read("app/qfusionai/page.tsx")).not.toMatch(/Самый дешёвый .{0,30}DeepSeek/);
  });
});

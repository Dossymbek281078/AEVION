// «Обещает = делает». Замер 2.11.2026 на проде: блок питча на /qcoreai и «интеграции» питча называли
// DeepSeek и Grok и «5 поставщиков», а /api/qcoreai/providers: подключены anthropic, openai, gemini,
// openrouter; deepseek и grok — configured:false. Питч называет только то, что подключено.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "../../../data/pitchModel.ts"), "utf8");

describe("питч QCoreAI не обещает неподключённых поставщиков", () => {
  it("в карточке qcoreai нет DeepSeek/Grok/«5 provider»", () => {
    const i = src.indexOf('id: "qcoreai"');
    expect(i).toBeGreaterThan(0);
    const карточка = src.slice(i, src.indexOf('id: "qtrade"', i));
    expect(карточка).not.toMatch(/DeepSeek|Grok|5 production providers|5 LLM providers/);
  });
  it("в списке интеграций питча нет DeepSeek/Grok", () => {
    const j = src.indexOf("integrations: [");
    expect(j).toBeGreaterThan(0);
    const блок = src.slice(j, src.indexOf("],", j));
    expect(блок).not.toMatch(/DeepSeek|Grok|5 LLM providers/);
  });
});

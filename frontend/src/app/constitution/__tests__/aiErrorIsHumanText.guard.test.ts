// Ошибка ИИ-совета constitution показывается человеческим текстом, а не сырым ответом сервера.
// 27.10.2026 (Приложения-2): page.tsx бросал `HTTP ${status}: <тело>` и выводил err.message — на
// исчерпанной суточной норме (aiRateGate, 429 ai_daily_limit) человек видел JSON с английским
// «Free tier… Upgrade → Pro»; событие потока kind:"error" показывало текст отказа провайдера.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");
// Только тело AiAdvisorModal — до следующей функции верхнего уровня (у SocialPanel своя ошибка, свой разбор).
const НАЧАЛО = PAGE.indexOf("function AiAdvisorModal(");
const КОНЕЦ = PAGE.indexOf("\nfunction ", НАЧАЛО + 10);
const СОВЕТ = PAGE.slice(НАЧАЛО, КОНЕЦ > 0 ? КОНЕЦ : undefined);

describe("constitution: ошибка ИИ-совета — понятным текстом", () => {
  it("контроль разбора: модальное окно совета найдено и зовёт поток", () => {
    expect(PAGE.indexOf("function AiAdvisorModal(")).toBeGreaterThan(0);
    expect(СОВЕТ).toContain("ai-suggest-stream");
  });

  it("сырое тело ответа и текст провайдера человеку не уходят", () => {
    expect(СОВЕТ).not.toMatch(/HTTP \$\{r\.status\}/);
    expect(СОВЕТ).not.toMatch(/setError\(ev\.message/);
    expect(СОВЕТ).not.toMatch(/setError\(err instanceof Error \? err\.message/);
  });

  it("исчерпанная норма (429 ai_daily_limit) — свой текст с числами", () => {
    expect(СОВЕТ).toMatch(/r\.status === 429 && j\?\.error === "ai_daily_limit"/);
    expect(СОВЕТ).toContain('t("constitution.ai.errorDailyLimit"');
    expect(СОВЕТ).toMatch(/err instanceof ПонятнаяОшибкаИИ \? err\.message : t\("constitution\.ai\.errorFailed"\)/);
  });

  for (const [lang, d] of Object.entries({ ru, en, kk } as Record<string, Record<string, string>>)) {
    it(`${lang}: тексты есть, с {used}/{limit}, без «Free tier»/«Upgrade»/$-цены`, () => {
      const норма = d["constitution.ai.errorDailyLimit"];
      const сбой = d["constitution.ai.errorFailed"];
      expect(норма, lang).toBeTruthy();
      expect(сбой, lang).toBeTruthy();
      expect(норма).toContain("{used}");
      expect(норма).toContain("{limit}");
      for (const s of [норма, сбой]) expect(s, lang).not.toMatch(/Free tier|Upgrade|\$\d/);
    });
  }
});

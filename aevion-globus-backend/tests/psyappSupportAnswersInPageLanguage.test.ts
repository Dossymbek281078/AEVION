import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";
import { psyappReplyLanguage } from "../src/lib/psyappReplyLang";

/**
 * 28.10.2026 (окно «Приложения-2»): страница PsyApp переведена на en/kk и шлёт lang в /support,
 * а системная подсказка требовала «Ответ на русском языке» — человек на en получал ответ по-русски.
 */
const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "psyappDeps.ts"), "utf8"));

describe("ИИ-поддержка PsyApp отвечает на языке страницы", () => {
  test("en, kk и запасной ru", () => {
    expect(psyappReplyLanguage("en")).toBe("Answer in English");
    expect(psyappReplyLanguage("kk")).toMatch(/Kazakh/);
    expect(psyappReplyLanguage(undefined)).toBe("Ответ на русском языке");
    expect(psyappReplyLanguage("de")).toBe("Ответ на русском языке");
  });

  test("подсказка берёт язык из тела запроса, а не зашитый русский", () => {
    expect(SRC).toContain("${psyappReplyLanguage(body.lang)}, не более 120 слов.");
    expect(SRC).not.toContain('"Ответ на русском языке, не более 120 слов. "');
  });
});

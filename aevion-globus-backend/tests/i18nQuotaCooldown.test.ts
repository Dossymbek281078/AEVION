import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { isQuotaError } from "../src/routes/i18n.js";

/**
 * Исчерпанная квота DeepL — состояние надолго, а не разовый сбой.
 *
 * Замер на проде 28.08.2026: 34 строки подряд «DeepL failed (456: Quota
 * exceeded); falling back to Claude». Мы ходили в DeepL перед КАЖДЫМ переводом,
 * получали тот же отказ и только потом звали запасной путь: лишний вызов,
 * лишняя задержка и журнал, забитый одинаковыми строками, среди которых
 * настоящая авария перестаёт быть заметной.
 */
describe("узнаём исчерпанную квоту, а не любую ошибку", () => {
  test.each([
    ["DeepL 456: Quota exceeded", true],
    ["quota exceeded for this billing period", true],
    ["DeepL 456", true],
    ["network timeout", false],
    ["invalid auth key", false],
    // Голое «456» без границ совпало бы здесь — а это ЧУЖАЯ ошибка, и из-за
    // неё DeepL замолчал бы на полчаса.
    ["processed 1456 characters", false],
  ])("%s -> %s", (msg, expected) => {
    expect(isQuotaError(new Error(msg))).toBe(expected);
  });
});

describe("в исходнике нет невидимых управляющих символов", () => {
  test("ни одного символа с кодом меньше 32, кроме перевода строки и табуляции", () => {
    // Дважды за одно окно обратный слэш терялся при передаче правки, и вместо
    // границы слова в файл уезжал НЕВИДИМЫЙ backspace. Глазами и через sed его
    // не видно; ловится только проверкой кодов.
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "i18n.ts"),
      "utf8",
    );
    const bad = [...src].filter((c) => {
      const n = c.charCodeAt(0);
      return n < 9 || (n > 13 && n < 32);
    });
    expect(bad.length, "в файле есть невидимые управляющие символы").toBe(0);
  });
});

describe("после исчерпанной квоты DeepL молчит положенное время", () => {
  test("сразу после отметки не спрашиваем, а спустя срок — снова спрашиваем", async () => {
    const { shouldAskDeepl, noteQuotaExhausted, resetQuotaCooldownForTests, DEEPL_QUOTA_COOLDOWN_MS } =
      await import("../src/routes/i18n.js");
    resetQuotaCooldownForTests();
    const t0 = 1_000_000;
    expect(shouldAskDeepl(t0), "до отказа мы обязаны спрашивать DeepL").toBe(true);
    noteQuotaExhausted(t0);
    expect(shouldAskDeepl(t0 + 1), "сразу после отказа снова пошли в DeepL").toBe(false);
    expect(shouldAskDeepl(t0 + DEEPL_QUOTA_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldAskDeepl(t0 + DEEPL_QUOTA_COOLDOWN_MS), "передышка не кончается").toBe(true);
    resetQuotaCooldownForTests();
  });
});

describe("передышка действительно СПРАШИВАЕТСЯ перед вызовом DeepL", () => {
  test("условие вызова содержит shouldAskDeepl", () => {
    // Это проверка МОНТАЖА, а не поведения, и я называю её так честно:
    // помощники выше проверены поведением, но мутация «убрать проверку из
    // условия вызова» их не роняла — вся передышка оставалась мёртвой, а
    // тесты зелёными. Полноценно это проверяется только подменой сетевого
    // слоя DeepL, что здесь пока не сделано.
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "i18n.ts"),
      "utf8",
    );
    expect(src).toContain("if (deeplReady && deeplTarget && shouldAskDeepl(now))");
  });
});

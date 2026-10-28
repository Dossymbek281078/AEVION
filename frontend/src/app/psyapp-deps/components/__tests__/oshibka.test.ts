import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ошибкаСервера, НЕТ_СВЯЗИ } from "../oshibka";

/*
 * 28.10.2026 (окно «Приложения-2»). Коды ниже — дословно из ответов прода 7b16f03ce на неверный ввод
 * (проба curl 28.10: 10 из 10 ответили 400/404). Человек не должен видеть их сырыми.
 */
const ЗАПАСНОЙ = "запасной текст";
const КОДЫ_ПРОДА = [
  "alias must be 2..40 chars [a-z0-9_-]",
  "alias invalid (2..40 chars [a-z0-9_-])",
  "alias invalid",
  "alias_owned_by_another_user",
  "user_not_found",
  "addiction must be one of: alcohol, smoking, other",
  "trigger_type must be one of: craving, stress, social, emotion",
  "intensity_1_10 must be 1..10",
  "message required",
  "invalid_json",
];

describe("PsyApp: ошибки сервера человеческим текстом", () => {
  test.each(КОДЫ_ПРОДА)("«%s» → русский текст, не сам код и не запасной", (код) => {
    const т = ошибкаСервера(код, ЗАПАСНОЙ);
    expect(т).not.toBe(код);
    expect(т).not.toBe(ЗАПАСНОЙ);
    expect(т).toMatch(/[а-яё]/i);
  });

  test("неизвестный код и пустота → запасной текст, сырое не показываем", () => {
    expect(ошибкаСервера("internal error", ЗАПАСНОЙ)).toBe(ЗАПАСНОЙ);
    expect(ошибкаСервера(undefined, ЗАПАСНОЙ)).toBe(ЗАПАСНОЙ);
    expect(ошибкаСервера({ x: 1 }, ЗАПАСНОЙ)).toBe(ЗАПАСНОЙ);
  });

  test("🔴 компоненты не показывают d.error и e.message сырыми; сбой загрузки журнала не выглядит пустым журналом", () => {
    const папка = join(process.cwd(), "src/app/psyapp-deps/components");
    for (const ф of ["Onboarding.tsx", "StreakCounter.tsx", "SupportChat.tsx", "TriggerLog.tsx"]) {
      const s = readFileSync(join(папка, ф), "utf8");
      expect(s, ф).not.toMatch(/setError\(d\.error \|\|/);
      expect(s, ф).not.toMatch(/\.message : "Сеть недоступна"/);
      expect(s, ф).toContain("НЕТ_СВЯЗИ");
    }
    const t = readFileSync(join(папка, "TriggerLog.tsx"), "utf8");
    expect(t).not.toMatch(/catch \{\s*\/\/ silent/);
    expect(t.indexOf("loadFailed && triggers.length === 0")).toBeGreaterThan(0);
    expect(t.indexOf("loadFailed && triggers.length === 0")).toBeLessThan(t.indexOf("Пока пусто. Первая запись"));
    expect(НЕТ_СВЯЗИ).toMatch(/[а-яё]/i);
  });
});

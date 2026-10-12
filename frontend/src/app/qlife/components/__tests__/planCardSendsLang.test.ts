/*
 * Карточка плана QLife отправляет язык посетителя и не показывает поставщика
 * модели. Замер 12.10.2026: русская страница получала план по-английски,
 * а над планом стояло «via anthropic» (окно Приложения-31.12).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "PlanCard.tsx"), "utf8");

describe("PlanCard: язык и без имени поставщика", () => {
  it("тело запроса плана несёт lang", () => {
    expect(SRC).toMatch(/JSON\.stringify\(\{ age: ageNum, goals, lang \}\)/);
    expect(SRC).toMatch(/useI18nOptional\(\)\?\.lang/);
  });

  it("имя поставщика модели на экран не выводится", () => {
    expect(SRC).not.toMatch(/via \{/);
  });
});

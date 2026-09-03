import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Описания стилей соперника видит каждый, кто выбирает, с кем играть.
 * В них жили английские вставки посреди русских фраз: «sharp openings»,
 * «mainline-варианты», «exchange-структуры», «Шах. Mainline.» — и подпись
 * выбора для экранного диктора «Выбор стиля AI».
 *
 * Замер 03.09.2026: смешанных строк было 4, стало 0.
 */

const ЛИЧНОСТИ = () => readFileSync(join(__dirname, "..", "aiPersonalities.ts"), "utf8");

describe("стили соперника", () => {
  it("в описаниях нет английских слов посреди русского", () => {
    const строки = [...ЛИЧНОСТИ().matchAll(/"([^"\n]{6,120})"/g)].map((m) => m[1]);
    expect(строки.length).toBeGreaterThan(20); // контроль охвата: строки нашлись
    const смешанные = строки
      .filter((s) => /[А-Яа-яЁё]/.test(s) && /[A-Za-z]{4,}/.test(s))
      .map((s) => s.slice(0, 60));
    expect(смешанные).toEqual([]);
  });

  it("подпись выбора стиля — для человека, а не для разработчика", () => {
    const код = readFileSync(join(__dirname, "..", "AiPersonalityPicker.tsx"), "utf8");
    expect(код).not.toContain("Выбор стиля AI");
    expect(код).toContain("Выбор стиля соперника");
  });
});

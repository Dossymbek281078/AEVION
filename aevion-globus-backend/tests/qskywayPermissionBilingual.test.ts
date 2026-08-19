import { describe, test, expect } from "vitest";

import { PERMISSION, permissionSummary } from "../src/routes/qskyway.permission";

/**
 * Правило регулятора приходит с сервера, и `t()` на странице до него не
 * достаёт: какой язык ни выбери, покажут то, что лежит в поле. До 12.08.2026
 * это значило, что у Астаны английский посетитель читал русский текст, а у
 * Токио — наоборот: поле `regime` там было заполнено ПО-АНГЛИЙСКИ, и русскому
 * показывали английский.
 *
 * Проверяется не «перевод хороший» (это не машинная проверка), а то, что обе
 * версии есть и что они на разных языках: латиница в английской, кириллица в
 * русской. Потерять одну из них легко — поля заполняются руками в двух файлах
 * городов, и забытое поле не падает, а молча показывает чужой язык.
 */
const CYRILLIC = /[А-Яа-яЁё]/;
const LATIN = /[A-Za-z]/;

describe("правило регулятора — на двух языках", () => {
  for (const [city, p] of Object.entries(PERMISSION)) {
    test(`[${city}] regime заполнен по-русски, regimeEn — по-английски`, () => {
      expect(p.regime.length, `${city}: пустое regime`).toBeGreaterThan(10);
      expect(p.regimeEn.length, `${city}: пустое regimeEn`).toBeGreaterThan(10);
      expect(CYRILLIC.test(p.regime), `${city}: regime без кириллицы — похоже, туда положили английский`).toBe(true);
      expect(CYRILLIC.test(p.regimeEn), `${city}: regimeEn содержит кириллицу`).toBe(false);
      expect(LATIN.test(p.regimeEn), `${city}: regimeEn без латиницы`).toBe(true);
    });

    test(`[${city}] примечание и происхождение значения тоже на двух языках`, () => {
      const s = permissionSummary(city);
      expect(s.available).toBe(true);
      if (!s.available) return;
      expect(CYRILLIC.test(s.note)).toBe(true);
      expect(CYRILLIC.test(s.noteEn), `${city}: noteEn содержит кириллицу`).toBe(false);
      expect(CYRILLIC.test(s.provenanceNote)).toBe(true);
      expect(CYRILLIC.test(s.provenanceNoteEn), `${city}: provenanceNoteEn содержит кириллицу`).toBe(false);
      // Запрет и режим разрешений должны читаться по-разному и в переводе:
      // «forbidden» против «requires an individual authorization».
      if (p.kind === "prohibition") expect(s.noteEn.toLowerCase()).toContain("forbidden");
      else expect(s.noteEn.toLowerCase()).toContain("authorization");
    });
  }

  test("города, у которых режим есть, вообще существуют", () => {
    // Иначе оба перебора выше зелены на пустом объекте.
    expect(Object.keys(PERMISSION).length).toBeGreaterThan(0);
  });
});

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Число факторов на странице CPI должно СЧИТАТЬСЯ, а не набираться руками.
 *
 * Замер 27.08.2026: на одной странице стояли два разных числа. Текст обещал
 * «сортировать по любому из 9 факторов», а описание сводного рейтинга — «все
 * 11 факторов». Одиннадцать — это набор СЕРВЕРА (`CPI_FACTORS` в бэкенде), и он
 * другой по составу: accuracy/tactics/endgame/timing/…, тогда как страница знает
 * E/T/O/B1/M1/M2/M3/H/Br. Страница занимала чужое число, и её собственные цифры
 * перестали сходиться между собой.
 *
 * Сторож сканирует исходник, а не импортирует страницу: она клиентская, и её
 * импорт тянет в тест весь React-обвес. Тот же приём уже применён в
 * `devhubDictionary.test.ts`.
 */

const PAGE = path.join(__dirname, "..", "page.tsx");

function source(): string {
  return fs.readFileSync(PAGE, "utf8");
}

describe("число факторов CPI выводится из списка", () => {
  test("в видимом тексте нет зашитого числа факторов", () => {
    const src = source();
    // Ищем «<цифры> фактор…» именно в тексте, а не в комментариях: комментарий
    // выше объясняет прежний дефект и обязан упоминать 9 и 11.
    const withoutComments = src
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
      })
      .join("\n");

    const hardcoded = [...withoutComments.matchAll(/(\d+)\s+фактор/g)].map((m) => m[1]);
    expect(hardcoded, "число факторов зашито в текст — оно разойдётся со списком").toEqual([]);
  });

  test("счётчик выводится из FACTOR_META и исключает сводный", () => {
    const src = source();
    expect(src).toContain("SORTABLE_FACTOR_COUNT");
    expect(src).toMatch(/Object\.keys\(FACTOR_META\)/);
    // Именно исключение `overall` делает число правдой: это сводка по
    // остальным, а не фактор наравне с ними.
    expect(src).toMatch(/filter\(\(k\) => k !== "overall"\)/);
  });

  test("в тексте стоит подстановка счётчика, а не цифра", () => {
    expect(source()).toContain("{SORTABLE_FACTOR_COUNT} факторов");
  });

  test("список факторов не пуст и сводный в нём есть", () => {
    const src = source();
    const block = src.slice(src.indexOf("const FACTOR_META"), src.indexOf("SORTABLE_FACTOR_COUNT"));
    const keys = [...block.matchAll(/^\s{2}([A-Za-z0-9]+):\s*\{/gm)].map((m) => m[1]);
    expect(keys).toContain("overall");
    // Девять сортируемых плюс сводный. Число закреплено намеренно: если состав
    // поменяется, тест обязан заставить перечитать и текст страницы.
    expect(keys.length).toBe(10);
  });
});

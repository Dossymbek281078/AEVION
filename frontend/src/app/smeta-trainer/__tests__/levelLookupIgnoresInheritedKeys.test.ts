import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Уровень ищется по значению ИЗ АДРЕСА — значит унаследованные ключи объекта
 * не должны считаться существующими уровнями.
 *
 * Замер 28.08.2026 на живом сайте. Страница `/smeta-trainer/level/__proto__`
 * отвечала на 449 байт больше, чем контроль ТОЙ ЖЕ длины (`xxxxxxxxx`), и
 * рисовала «Уровень __proto__ — undefined»: `LEVEL_META["__proto__"]` возвращает
 * прототип, он истинен, и проверка `meta && (...)` пропускала его дальше.
 *
 * Находка была не новой — она лежала в базовой линии сторожа служебных слов и
 * ждала, когда её кто-нибудь разберёт. Базовая линия, которую никто не читает,
 * это место, где дефекты живут годами.
 *
 * Живой сторож (`aevion-proto-watch-frontend.mjs`) поймает возврат дефекта на
 * ПРОДЕ. Эта проверка ловит его раньше — в репозитории, до выкатки.
 */

const PAGE = path.resolve(__dirname, "../level/[num]/page.tsx");

describe("страница уровня не принимает унаследованные ключи за уровень", () => {
  const src = fs.readFileSync(PAGE, "utf-8");

  test("поиск идёт по СОБСТВЕННОМУ свойству, а не по любому доступному", () => {
    const compact = src.replace(/\s+/g, "");
    expect(
      compact.includes("Object.prototype.hasOwnProperty.call(LEVEL_META,num)"),
      "голый LEVEL_META[num] пропускает __proto__ и constructor как существующие уровни",
    ).toBe(true);
  });

  test("сама таблица уровней содержит только числовые ключи", () => {
    // Контроль к первой проверке: если ключи вдруг перестанут быть числами,
    // защита от служебных слов станет недостаточной, и это надо заметить.
    const table = src.slice(src.indexOf("const LEVEL_META"), src.indexOf("export default"));
    const keys = [...table.matchAll(/"(\d+)":/g)].map((m) => m[1]);
    expect(keys.length, "ключи уровней не найдены — проверка смотрит не туда").toBeGreaterThan(0);
    for (const k of keys) expect(Number.isInteger(Number(k))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CITY } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";
import { CITY_SINGAPORE } from "../src/routes/qskyway.city.singapore";
import { CITY_AMSTERDAM } from "../src/routes/qskyway.city.amsterdam";
import { CITY_BERLIN } from "../src/routes/qskyway.city.berlin";
import { CITY_VIENNA } from "../src/routes/qskyway.city.vienna";
import { CITY_ZURICH } from "../src/routes/qskyway.city.zurich";

// Страница /compare — продающая: числа на ней читают как проверяемые, и ссылка
// рядом ведёт на живой API. Значит расхождение с данными твинов — не опечатка,
// а несостоятельное утверждение.
//
// 10.08.2026 прямой прогон по данным нашёл ровно такое: строка «42 пары
// площадок на город». Площадок 7, пар из них 21; 42 — это направления, потому
// что A→B и B→A строятся как разные маршруты. Число пар было завышено вдвое.
// Остальное сошлось: 3 города, 7232 здания, провенанс 96.7 / 92.7 / 0.
//
// Тест сверяет утверждения страницы с самими твинами — не с прошлым замером,
// который тоже мог устареть. Твины пересобирают (Токио пересобрали на этой же
// ветке), и после пересборки цифры на витрине разъезжаются молча.

const CITIES: Record<string, { buildings: unknown[]; vertiports: unknown[]; dataQuality: { measuredPct: number } }> = {
  astana: CITY as never,
  nyc: CITY_NYC as never,
  tokyo: CITY_TOKYO as never,
  singapore: CITY_SINGAPORE as never,
  amsterdam: CITY_AMSTERDAM as never,
  berlin: CITY_BERLIN as never,
  vienna: CITY_VIENNA as never,
  zurich: CITY_ZURICH as never,
};

const COMPETITORS = fs.readFileSync(
  path.join(__dirname, "..", "..", "frontend", "src", "lib", "competitors.ts"),
  "utf8",
);

/**
 * Блок QSKYWAY целиком — чтобы не поймать число из соседнего модуля.
 * Комментарии отбрасываем: в них разобрана как раз прежняя неверная
 * формулировка, и она не должна считаться нарушением.
 */
function qskywayBlock(): string {
  const src = COMPETITORS.replace(/^\s*\/\/.*$/gm, "");
  const start = src.indexOf('moduleId: "qskyway"');
  expect(start, "блок qskyway не найден в competitors.ts").toBeGreaterThan(-1);
  const next = src.indexOf("moduleId:", start + 20);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("числа QSkyway на /compare сходятся с твинами", () => {
  const block = qskywayBlock();

  it("городов столько, сколько твинов", () => {
    // «4 города», но «5 городов» — форма слова зависит от числа, как и у зданий ниже.
    // Без `\b`: в JS граница слова знает только латиницу, после кириллицы её нет
    // (`feedback_regex_word_boundary_cyrillic`) — поймано этим же тестом 16.09.
    const m = block.match(/(\d+)\s+город(?:а|ов)(?![а-яё])/);
    expect(m, "в блоке нет утверждения о числе городов").not.toBeNull();
    expect(Number(m![1])).toBe(Object.keys(CITIES).length);
  });

  it("зданий столько, сколько их в сумме по твинам", () => {
    const total = Object.values(CITIES).reduce((s, c) => s + c.buildings.length, 0);
    // Форма слова зависит от самого числа: 7227 «зданий», но 7232 «здания».
    // Регулярка требовала только «зданий» и 12.08.2026 упала на ПРАВИЛЬНО
    // согласованном тексте после пересборки твина — проверка числа не должна
    // диктовать грамматику.
    const m = block.match(/(\d{3,})\s+здани[йяе]/);
    expect(m, "в блоке нет утверждения о числе зданий").not.toBeNull();
    expect(Number(m![1])).toBe(total);
  });

  it("площадок на город — столько, сколько в твине, и одинаково во всех", () => {
    const counts = Object.values(CITIES).map((c) => c.vertiports.length);
    expect(new Set(counts).size, "города перестали быть одинаковыми по числу площадок").toBe(1);
    const m = block.match(/(\d+)\s+площадок на город/);
    expect(m, "в блоке нет утверждения о числе площадок").not.toBeNull();
    expect(Number(m![1])).toBe(counts[0]);
  });

  it("маршрутов — это направления (n·(n−1)), и они не выданы за пары", () => {
    const n = Object.values(CITIES)[0].vertiports.length;
    const directed = n * (n - 1);
    const m = block.match(/(\d+)\s+маршрута в обе стороны/);
    expect(m, "в блоке нет утверждения о числе маршрутов").not.toBeNull();
    expect(Number(m![1])).toBe(directed);
    // Именно эта формулировка была неверной: пар вдвое меньше направлений.
    expect(block).not.toMatch(/\d+\s+пары площадок/);
  });

  it("провенанс высот назван по каждому городу так, как его считает движок", () => {
    for (const [id, c] of Object.entries(CITIES)) {
      const pct = c.dataQuality.measuredPct;
      const label = { astana: "Астана", nyc: "Нью-Йорк", tokyo: "Токио", singapore: "Сингапур", amsterdam: "Амстердам", berlin: "Берлин", vienna: "Вена", zurich: "Цюрих" }[id]!;
      const m = block.match(new RegExp(`${label}[^;]*?(\\d+(?:\\.\\d+)?)%`));
      expect(m, `в блоке нет процента обмера для «${label}»`).not.toBeNull();
      expect(Number(m![1]), `${label}: на витрине ${m![1]}%, движок считает ${pct}%`).toBe(pct);
    }
  });
});

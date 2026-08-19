import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Первый круг турнира кто-то строит. 19.08.2026.
//
// Цепочка была разорвана посередине: сервер переводит турнир в «идёт», ручка
// умеет собрать первый круг с нуля (номер становится первым, пары берутся из
// состава), а страница — единственный, кто её зовёт — выходила по безусловному
// `if (rounds.length === 0) return`.
//
// Итог: участники видят «идёт» и ПУСТУЮ сетку. Ни ошибки, ни объяснения.

const SRC = path.join(__dirname, "..", "tournaments", "[id]", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8")).replace(/\s+/g, " ");

describe("первый круг турнира", () => {
  test("страница запрашивает построение, когда кругов ещё нет", () => {
    const s = src();
    // Проверяется СМЫСЛ, а не форматирование: в окне после проверки «кругов
    // нет» должен стоять вызов построения. Жёсткий шаблон по пробелам ломался
    // бы о перенос строки, а не о дефект — на этом я и попался.
    const i = s.indexOf("rounds.length === 0");
    expect(i, "ветка «кругов нет» исчезла").toBeGreaterThan(-1);
    expect(s.slice(i, i + 420)).toMatch(/queue-match/);
  });

  test("запрос идёт только у живого турнира и только при двух участниках", () => {
    // Иначе построение звали бы для предстоящего турнира и для пустого —
    // сетка из одного человека бессмысленна.
    const s = src();
    const блок = s.slice(s.indexOf("rounds.length === 0"), s.indexOf("rounds.length === 0") + 420);
    expect(блок).toMatch(/meta\.status === "live"/);
    expect(блок).toMatch(/players \?\? 0\) >= 2/);
  });

  test("есть защёлка от повторов, и она своя", () => {
    // Общий счётчик кругов здесь не работает: круга ещё нет, сравнивать не с
    // чем. Без защёлки каждый перерисованный кадр слал бы запрос.
    const s = src();
    expect(s).toMatch(/firstRoundAskedRef/);
    // При неудаче защёлка снимается — иначе одна сетевая ошибка запирала бы
    // построение навсегда.
    expect(s).toMatch(/firstRoundAskedRef\.current = false/);
  });
});

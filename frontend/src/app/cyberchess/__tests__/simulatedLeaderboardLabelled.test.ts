import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Симулированная таблица лидеров должна быть подписана симулированной.
 *
 * `leaderboards.ts` синтезирует соперников из сида — Магнус, Хикару, Карлсен с
 * выдуманными рейтингами и числом партий. В одном месте страницы это честно
 * помечалось значком «демо», а в двух других (карточка «Лидеры площадки» и её
 * развёрнутый вид) пометки не было: человек читал свой ранг среди чемпионов как
 * настоящий. Свой рейтинг у него при этом действительно настоящий — оттого
 * правдоподобно вдвойне.
 *
 * Тот же класс, что выдуманная сотня игроков в задаче дня. Разница в том, что
 * здесь симуляция уместна — пустая таблица на старте хуже — и лечится не удалением,
 * а подписью и переходом к настоящей таблице (/cyberchess/leaderboard, рейтинг
 * матчмейкинга по живым партиям).
 */

const PAGE = join(__dirname, "..", "page.tsx");
const raw = readFileSync(PAGE, "utf8");
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* Окно вокруг вызова, а не после него: подпись и ссылка стоят в шапке карточки,
   то есть ВЫШЕ строки, которая рисует синтезированные места. Первая версия теста
   смотрела только вперёд и краснела на правильном коде. */
function windowAround(anchor: string, before = 2000, after = 2500): string {
  const i = src.indexOf(anchor);
  expect(i, `не найден якорь: ${anchor}`).toBeGreaterThan(-1);
  return src.slice(Math.max(0, i - before), i + after);
}

const RENDERS_SIMULATED = ["getTopWithMe(", "getFullBoardAroundMe("];

describe("симулированные соперники подписаны", () => {
  it("оба места, где рисуются синтезированные соперники, помечены", () => {
    for (const anchor of RENDERS_SIMULATED) {
      expect(windowAround(anchor), anchor).toMatch(/демо|синтезированы/);
    }
  });

  it("оба места уводят к настоящей таблице", () => {
    for (const anchor of RENDERS_SIMULATED) {
      expect(windowAround(anchor), anchor).toMatch(/\/cyberchess\/leaderboard/);
    }
  });

  it("не обещает как будущее то, что уже работает", () => {
    /* Подпись гласила «Реальный лидерборд появится с запуском multiplayer», хотя
       матчмейкинг живой и страница с настоящей таблицей существует. Обещание
       сделанного — такой же неверный факт на экране, как выдуманная строка. */
    expect(src).not.toMatch(/появится с запуском multiplayer/);
  });

  it("настоящая таблица действительно есть, иначе ссылка вела бы в никуда", () => {
    const real = readFileSync(join(__dirname, "..", "leaderboard", "page.tsx"), "utf8");
    expect(real).toMatch(/matchmaking\/leaderboard/);
  });
});

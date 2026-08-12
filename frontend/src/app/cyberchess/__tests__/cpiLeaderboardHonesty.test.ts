import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { stripComments } from "./_stripComments";

/* Страница CPI-лидерборда показывает ОБРАЗЕЦ, и обязана это говорить.
 *
 * В ней пятнадцать выдуманных имён с выдуманными значениями CPI и числом партий
 * (`MOCK_ENTRIES`), обращений к API — ноль. При этом адрес публичный, есть
 * OG-картинка и разметка списка для поисковиков: со стороны это неотличимо от
 * настоящего рейтинга игроков AEVION.
 *
 * Подключить настоящий источник правкой вёрстки нельзя: сервер отдаёт по одному
 * значению на игрока и другой набор факторов, чем рисует страница. Это
 * продуктовая задача. Пока она не сделана, честность держится двумя вещами —
 * видимой оговоркой и запретом индексации, — и обе легко потерять при уборке.
 */

const PAGE = "src/app/cyberchess/cpi/leaderboard/page.tsx";
const LAYOUT = "src/app/cyberchess/cpi/leaderboard/layout.tsx";

const read = (p: string) => stripComments(readFileSync(p, "utf8"));

describe("страница не выдаёт образец за рейтинг", () => {
  it("на странице есть видимая оговорка", () => {
    const src = read(PAGE);
    expect(src).toMatch(/cpi-demo-notice/);
    expect(src).toMatch(/образец/i);
  });

  it("оговорка говорит прямо, что значения выдуманные", () => {
    /* «Демо-режим» ни о чём не сообщает человеку. Нужно слово про сами цифры. */
    const src = read(PAGE);
    expect(src).toMatch(/выдуманн/i);
  });

  it("страница закрыта от индексации, пока данные не настоящие", () => {
    expect(read(LAYOUT)).toMatch(/robots:\s*\{[^}]*index:\s*false/);
  });

  it("если появится настоящий источник — оговорку можно снимать", () => {
    /* Обратная сторона: сторож не должен мешать починке. Как только страница
       начнёт ходить за данными, этот тест перестанет требовать оговорку —
       и тогда его надо будет заменить проверкой самого источника. */
    const src = read(PAGE);
    const usesApi = /fetch\(/.test(src);
    if (usesApi) {
      expect(src).toMatch(/cpi\/leaderboard/);
    } else {
      expect(src).toMatch(/MOCK_ENTRIES/);
    }
  });
});

describe("страница «Экономика» не выдаёт макетные лоты за настоящие", () => {
  const ECONOMY = "src/app/cyberchess/economy/page.tsx";

  it("оговорка стоит ПЕРЕД списком лотов, а не в конце страницы", () => {
    /* Оговорка была — строкой «F7 · Mock-режим» в самом низу. Человек читает
       лоты сверху вниз и до неё не доходит. */
    const src = read(ECONOMY);
    const noticeAt = src.indexOf("economy-demo-notice");
    const lotsAt = src.indexOf("MOCK_AUCTIONS.map");
    expect(noticeAt).toBeGreaterThanOrEqual(0);
    expect(lotsAt).toBeGreaterThanOrEqual(0);
    expect(noticeAt).toBeLessThan(lotsAt);
  });

  it("сказано, что выдуманы именно цены и ставки, а не «режим»", () => {
    /* «Mock-режим» ничего не сообщает игроку о числах на экране. */
    const src = read(ECONOMY);
    expect(src).toMatch(/выдуман/i);
    expect(src).toMatch(/ставок|ставк/i);
  });
});

describe("турнирная сетка подписана так же, как лидерборд рядом", () => {
  const PAGE = "src/app/cyberchess/tournament/page.tsx";

  it("у сетки есть подпись, что имена и счёт выдуманы", () => {
    /* Лидерборд на этой же странице при живом бэкенде настоящий, и это
       подписано. Сетка строится из MOCK_PLAYERS/MOCK_RESULTS всегда, а подписи
       не имела — рядом с настоящими данными это читается как настоящее. */
    const src = read(PAGE);
    expect(src).toMatch(/bracket-demo-notice/);
    expect(src).toMatch(/выдуман/i);
  });

  it("подпись стоит перед самой сеткой", () => {
    const src = read(PAGE);
    expect(src.indexOf("bracket-demo-notice")).toBeLessThan(src.indexOf("<BracketView"));
  });
});

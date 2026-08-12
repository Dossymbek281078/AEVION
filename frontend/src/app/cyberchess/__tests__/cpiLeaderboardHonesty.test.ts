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
       начнёт ходить за данными, требование оговорки про ВЫДУМАННЫЕ цифры
       снимается — они перестанут быть выдуманными. */
    const src = read(PAGE);
    const usesApi = /fetch\(/.test(src);
    if (usesApi) {
      expect(src).toMatch(/cpi\/leaderboard/);
    } else {
      expect(src).toMatch(/MOCK_ENTRIES/);
    }
  });

  it("подключение к API не отменяет вопрос, откуда числа", () => {
    /* Дыра, которую оставляла проверка выше в одиночку: она считала «пошли за
       данными» синонимом «данные настоящие». А сервер отдаёт CPI, посчитанный
       БРАУЗЕРОМ игрока о самом себе, и помечает это в поле `source`
       (12.08.2026). Подключить такой источник и снять оговорку — значит
       показать самооценку игроков как измеренную сервером величину, причём
       выглядеть это будет честнее прежнего макета.

       Поэтому: пока страница на макете — довольно оговорки; как только она
       берёт данные с сервера, она обязана читать и показывать происхождение.
       Появится серверный расчёт — у строк будет другое значение `source`, и
       проверка продолжит работать без правок. */
    const src = read(PAGE);
    const usesApi = /fetch\(/.test(src);
    if (!usesApi) return; // ещё макет — этот случай стерегут проверки выше

    const showsProvenance = /source/.test(src) || /самооцен|сам о себе|self_reported/i.test(src);
    expect(showsProvenance).toBe(true);
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

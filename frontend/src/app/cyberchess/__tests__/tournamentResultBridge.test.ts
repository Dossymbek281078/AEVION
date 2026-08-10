import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Турнирная сетка не могла закрыться.
 *
 * Пары публикуются в матчмейкинг (`publishRoundToMatchmaking` →
 * `createPreMatchedMatch`), партия играется, сервер сам определяет исход и
 * пересчитывает рейтинг. Закрыть пару умеет только `applyResultToMatch`, а
 * единственный путь к ней — `POST /api/cyberchess-tournaments/:id/result`, которую
 * НЕ ЗВАЛ НИКТО: во всём фронтенде ни одного обращения, на бэкенде тоже. Настоящий
 * турнир навсегда застревал на первом круге, и заметить это было нечем —
 * демонстрационный турнир зашит уже сыгранным, так что страница выглядит живой.
 *
 * Проверка читает исходники бэкенда: его тесты в этом worktree не запускаются, там
 * нет зависимостей (node_modules — симлинк в каталог без express и typescript).
 * Сторож не заменяет прогон, он ловит именно повторное исчезновение звена.
 */

const MM = "../aevion-globus-backend/src/routes/cyberchessMatchmaking.ts";
const TOUR = "../aevion-globus-backend/src/routes/cyberchessTournaments.ts";

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const read = (p: string) => stripComments(readFileSync(p, "utf8"));

describe("исход партии доходит до турнирной сетки", () => {
  it("матчмейкинг сообщает об исходе при засчитывании партии", () => {
    const src = read(MM);
    expect(src).toMatch(/export function onMatchSettled/);
    const settle = src.slice(src.indexOf("async function settleMatch"));
    expect(settle).toMatch(/notifyMatchSettled\(/);
  });

  it("сообщает ПОСЛЕ проверки на повторное завершение", () => {
    /* Второй `/end` от другого клиента — обычное дело: оба браузера сообщают конец
       партии. Если известить раньше проверки, сетка засчитает один и тот же
       результат дважды, и в швейцарской системе игрок получит два очка за партию. */
    const src = read(MM);
    const settle = src.slice(src.indexOf("async function settleMatch"));
    const guard = settle.indexOf("if (!firstEnd) return null;");
    const notify = settle.indexOf("notifyMatchSettled(");
    expect(guard).toBeGreaterThan(-1);
    expect(notify).toBeGreaterThan(guard);
  });

  it("турниры подписаны и закрывают пару", () => {
    const src = read(TOUR);
    expect(src).toMatch(/onMatchSettled\(/);
    const handler = src.slice(src.indexOf("onMatchSettled("));
    expect(handler).toMatch(/applyResultToMatch\(/);
    // связь пары с живым матчем — по liveMatchId, его проставляет публикация круга
    expect(handler).toMatch(/liveMatchId === matchId/);
  });

  it("не закрывает пару повторно", () => {
    const handler = read(TOUR).slice(read(TOUR).indexOf("onMatchSettled("));
    expect(handler).toMatch(/status === "done"\) return/);
  });

  it("у сетки больше одного пути к закрытию пары", () => {
    /* Ровно один вызов `applyResultToMatch` означал бы, что мы вернулись к прежнему
       состоянию: единственный путь — ручка, которую никто не зовёт. */
    const calls = read(TOUR).match(/applyResultToMatch\(/g) ?? [];
    // одно объявление функции + минимум два вызова
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});

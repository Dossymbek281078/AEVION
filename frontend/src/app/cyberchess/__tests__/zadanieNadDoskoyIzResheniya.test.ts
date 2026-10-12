// Строка над доской говорит правду о задаче: число ходов — из РЕШЕНИЯ, не из тега.
//
// Повод: 0-ДОКЛАД-ПРОВЕРЕН («выставил задачу мат в 1 ход, когда там близко его нет»)
// и замер 12.10.2026 — человек с ролика не видел на экране ни чей ход, ни что искать.
//
// Задачи здесь НЕ выдуманы: это сырой формат банка (lichess, чётный sol, первый ход —
// соперника). Первая взята с прода 12.10 — задача дня li-банка, тема «мат в 1»:
// ход чёрных Kd8, затем Qe8# — мат ставят БЕЛЫЕ, и решающий тоже белые.
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { zadanieNadDoskoy, razborZadachi, normalizePuzzle } from "../puzzleNormalize";

const основа = { name: "", r: 800, theme: "", phase: undefined };
const задачаДня = {
  ...основа,
  fen: "r4b1r/1bq1kQpp/p1npp3/1p5B/8/1P6/PBP2PPP/RN3RK1 b - - 4 15",
  sol: ["e7d8", "f7e8"],
};

describe("строка задания над доской", () => {
  it("прибор проверен: линия задачи дня действительно кончается матом", () => {
    // Контроль НА ДАННЫХ, а не на нашей функции: иначе сторож подтверждал бы сам себя.
    const g = new Chess(задачаДня.fen);
    for (const u of задачаДня.sol) expect(g.move({ from: u.slice(0, 2), to: u.slice(2, 4) }), u).toBeTruthy();
    expect(g.isCheckmate(), "в конце линии мат").toBe(true);
  });

  it("задача дня с прода: «Ход белых · Мат в 1»", () => {
    // Решают БЕЛЫЕ, хотя в сыром fen ход чёрных — сторона берётся после нормализации.
    expect(zadanieNadDoskoy(задачаДня)).toBe("Ход белых · Мат в 1");
  });

  it("сторона НЕ берётся из сырого fen (иначе было бы ровно наоборот)", () => {
    expect(задачаДня.fen.split(" ")[1]).toBe("b");
    expect(zadanieNadDoskoy(задачаДня).startsWith("Ход белых")).toBe(true);
  });

  it("тег goal/mateIn не влияет: врущая подпись «мат в 5» строку не портит", () => {
    const сВрущимТегом = { ...задачаДня, goal: "Mate" as const, mateIn: 5, theme: "Мат в 5" };
    expect(zadanieNadDoskoy(сВрущимТегом)).toBe("Ход белых · Мат в 1");
  });

  it("тег «Mate» на позиции БЕЗ мата не даёт слова «мат»", () => {
    // Отрицательный контроль: решение — взятие ферзя, мата нет.
    const безМата = {
      ...основа,
      fen: "rnbqkbnr/ppp2ppp/8/3pp3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1",
      sol: ["d8h4", "e1e2"],
      goal: "Mate" as const, mateIn: 1, theme: "Мат в 1",
    };
    const р = razborZadachi(безМата);
    expect(р && р.kind, "контроль: решение это не мат").not.toBe("mate");
    expect(zadanieNadDoskoy(безМата)).not.toMatch(/Мат/);
  });

  it("строка всегда называет сторону и всегда что-то требует", () => {
    for (const пз of [задачаДня]) {
      const с = zadanieNadDoskoy(пз);
      expect(с).toMatch(/^Ход (белых|чёрных) · /);
      expect(с.split(" · ")[1].length).toBeGreaterThan(3);
    }
  });

  it("нормализация идемпотентна — строка не меняется от повторного прогона", () => {
    const один = normalizePuzzle(задачаДня);
    expect(zadanieNadDoskoy(один)).toBe(zadanieNadDoskoy(задачаДня));
  });
});

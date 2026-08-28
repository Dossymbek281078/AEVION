import { describe, expect, test } from "vitest";
import { Chess } from "chess.js";
import { best, ev } from "../chessEngine";

/**
 * Ядро соперника: от него зависит, интересно ли играть. Оно не падает при
 * поломке — просто начинает играть плохо, и заметит это только живой игрок.
 * Поэтому проверяем на позициях, ответ для которых известен заранее.
 *
 * Мутационно проверено 28.08.2026: ломал ценность ферзя (q:900 → q:0) и
 * значение мата — обе поломки ловятся этими четырьмя проверками.
 */
describe("движок соперника", () => {
  test("берёт бесплатного ферзя", () => {
    const fen = "q6k/8/8/8/8/8/7P/R5K1 w - - 0 1";
    const m = best(new Chess(fen), 3, 0);
    expect(m).not.toBeNull();
    expect(`${m!.from}${m!.to}`).toBe("a1a8");
  });

  test("ставит мат в один ход, когда он есть", () => {
    const fen = "7k/6Q1/6K1/8/8/8/8/8 w - - 0 1";
    const m = best(new Chess(fen), 3, 0);
    const proba = new Chess(fen);
    proba.move(m!);
    expect(proba.isCheckmate()).toBe(true);
  });

  test("оценка видит материальный перевес", () => {
    const ravno = ev(new Chess());
    // у чёрных нет ферзя — оценка обязана качнуться в пользу белых
    const bezFerzya = ev(new Chess("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"));
    expect(bezFerzya).toBeGreaterThan(ravno);
  });

  test("в патовой позиции честно отвечает «ходов нет»", () => {
    expect(best(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 2, 0)).toBeNull();
  });
});

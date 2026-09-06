import { describe, it, expect } from "vitest";
import { pickReinforcement } from "../variants";

/**
 * Reinforcement — вариант возвращает на доску фигуру (своего цвета) на пустую
 * клетку в СВОЕЙ половине. Баг = фигура появится не там/не та/на занятой клетке,
 * что тихо ломает вариант. Функция чистая (кроме random-выбора) — проверяем
 * инварианты, а не конкретный выбор, прогоняя многократно.
 */

// Пустая доска — вся своя половина свободна.
const EMPTY = "8/8/8/8/8/8/8/8 w - - 0 1";
// Полностью занятая доска.
const FULL = "pppppppp/pppppppp/pppppppp/pppppppp/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w - - 0 1";

const whiteHalf = new Set(["1", "2", "3", "4"]); // ранги белых
const blackHalf = new Set(["5", "6", "7", "8"]); // ранги чёрных

describe("Reinforcement: подкрепление ставится своё и в своей половине", () => {
  it("нет захваченных фигур → null", () => {
    expect(pickReinforcement([], "w", EMPTY)).toBeNull();
  });

  it("нет фигур МОЕГО цвета среди захваченных → null", () => {
    // белые, но в наборе только чёрные (строчные) — ставить нечего
    expect(pickReinforcement(["p", "n", "q"], "w", EMPTY)).toBeNull();
  });

  it("белые: 200 прогонов — фигура ЗАГЛАВНАЯ и клетка в ранах 1–4", () => {
    for (let t = 0; t < 200; t++) {
      const r = pickReinforcement(["P", "N", "R"], "w", EMPTY);
      expect(r).not.toBeNull();
      expect(r!.piece, `фигура должна быть белой: ${r!.piece}`).toBe(r!.piece.toUpperCase());
      expect(["P", "N", "R"]).toContain(r!.piece);
      expect(whiteHalf.has(r!.sq[1]), `клетка ${r!.sq} не в половине белых`).toBe(true);
    }
  });

  it("чёрные: 200 прогонов — фигура строчная и клетка в ранах 5–8", () => {
    for (let t = 0; t < 200; t++) {
      const r = pickReinforcement(["p", "b"], "b", EMPTY);
      expect(r).not.toBeNull();
      expect(r!.piece, `фигура должна быть чёрной: ${r!.piece}`).toBe(r!.piece.toLowerCase());
      expect(blackHalf.has(r!.sq[1]), `клетка ${r!.sq} не в половине чёрных`).toBe(true);
    }
  });

  it("своя половина полностью занята → некуда ставить → null", () => {
    expect(pickReinforcement(["P", "N"], "w", FULL)).toBeNull();
  });

  it("подкрепление ставится только на ПУСТУЮ клетку", () => {
    // Белая половина: ранг 1 полон, ранги 2–4 пусты → клетка обязана быть с ранга 2–4.
    const fen = "8/8/8/8/8/8/8/RNBQKBNR w - - 0 1"; // только ранг 1 занят
    for (let t = 0; t < 100; t++) {
      const r = pickReinforcement(["P"], "w", fen);
      expect(r).not.toBeNull();
      expect(r!.sq[1], `клетка ${r!.sq} попала на занятый ранг 1`).not.toBe("1");
      expect(["2", "3", "4"]).toContain(r!.sq[1]);
    }
  });
});

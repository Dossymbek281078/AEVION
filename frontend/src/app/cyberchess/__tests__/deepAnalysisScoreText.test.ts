import { describe, it, expect } from "vitest";
import { scoreText, toWhiteRelative } from "../DeepAnalysisPanel";

/**
 * Оценка «Глубокого анализа» (SF 17.1) — то, что человек читает над доской.
 * Перепутанный знак или округление показали бы неверную оценку при рабочем
 * движке (тихая ложь). Функция чистая — закрепляем формат.
 */
describe("DeepAnalysisPanel scoreText — формат оценки для человека", () => {
  it("перевес белых — со знаком +, два знака после запятой", () => {
    expect(scoreText(40, 0)).toBe("+0.40");
    expect(scoreText(325, 0)).toBe("+3.25");
  });
  it("перевес чёрных — с минусом", () => {
    expect(scoreText(-150, 0)).toBe("-1.50");
  });
  it("ровно 0 — без плюса (не перевес)", () => {
    expect(scoreText(0, 0)).toBe("0.00");
  });
  it("мат за нас — #N без минуса", () => {
    expect(scoreText(0, 3)).toBe("#3");
    expect(scoreText(9999, 1)).toBe("#1"); // мат перебивает cp
  });
  it("мат против нас — #N с пометкой минуса", () => {
    expect(scoreText(0, -2)).toBe("#2 (−)");
  });
});

/**
 * UCI `score cp/mate` идёт ОТ СТОРОНЫ ХОДА; основной eval-бар приводит его к
 * бело-относительному (cp*sign, page.tsx). Панель обязана делать то же, иначе
 * на ходу чёрных её оценка спорит с eval-баром знаком. Закрепляем приведение,
 * чтобы регресс (показ сырого cp) краснел.
 */
describe("toWhiteRelative — оценка приводится к перспективе белых", () => {
  const WHITE_TO_MOVE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const BLACK_TO_MOVE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";

  it("ход белых — знак не меняется (движок уже смотрит от белых)", () => {
    expect(toWhiteRelative(120, 0, WHITE_TO_MOVE)).toEqual({ cp: 120, mate: 0 });
  });
  it("ход чёрных — знак ИНВЕРТИРУЕТСЯ (иначе спор с eval-баром)", () => {
    // Чёрные лучше на +3 (score cp +300 от стороны хода) → бело-относительно −3.
    expect(toWhiteRelative(300, 0, BLACK_TO_MOVE)).toEqual({ cp: -300, mate: 0 });
    expect(toWhiteRelative(0, 2, BLACK_TO_MOVE)).toEqual({ cp: 0, mate: -2 });
  });
  it("сквозь scoreText: чёрные выигрывают на своём ходу → человек видит минус", () => {
    const w = toWhiteRelative(300, 0, BLACK_TO_MOVE);
    expect(scoreText(w.cp, w.mate)).toBe("-3.00");
  });
});

import { describe, it, expect } from "vitest";
import { scoreText } from "../DeepAnalysisPanel";

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

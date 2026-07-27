import { describe, it, expect } from "vitest";
import { accuracyOf } from "../accuracy";

const of = (...q: string[]) => q.map((quality) => ({ quality }));

describe("accuracyOf", () => {
  it("безупречная партия — 100%", () => {
    expect(accuracyOf(of("brilliant", "great", "brilliant"))).toBe(100);
  });

  it("одни зевки — 0%", () => {
    expect(accuracyOf(of("blunder", "blunder"))).toBe(0);
  });

  it("веса те же, что были в четырёх копиях", () => {
    // 1 + 0.85 + 0.6 + 0.3 + 0 = 2.75 из 5 → 55%
    expect(accuracyOf(of("great", "good", "inacc", "mistake", "blunder"))).toBe(55);
  });

  it("пустой вход — null, а не выдуманное число", () => {
    // Одна из копий возвращала здесь 50 и тянула тренд к середине,
    // другая делила на ноль. Числа у такой партии нет.
    expect(accuracyOf([])).toBeNull();
  });

  it("незнакомая метка не роняет счёт и не даёт NaN", () => {
    const v = accuracyOf(of("good", "какая-то-новая-метка"));
    expect(v).not.toBeNull();
    expect(Number.isFinite(v!)).toBe(true);
  });

  it("порядок ходов не влияет на результат", () => {
    expect(accuracyOf(of("blunder", "great", "good"))).toBe(accuracyOf(of("good", "blunder", "great")));
  });
});

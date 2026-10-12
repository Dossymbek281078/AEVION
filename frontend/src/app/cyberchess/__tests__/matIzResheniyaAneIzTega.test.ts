import { describe, it, expect } from "vitest";
import { matovVResheniyi, imyaPoResheniyu } from "../puzzleNormalize";

/**
 * Один источник правды для «Мат в N».
 *
 * Повод — класс, на котором обожглись 01.10.2026: к задаче подписали «мат в 1»,
 * которого в позиции нет. Число жило в двух местах: заголовок считал его по
 * решению, а метка карточки и поздравление печатали тег `mateIn`. Пока тег и
 * решение совпадают, разницы не видно — но тогда её не видно и когда начнут
 * расходиться. Замер 12.10.2026 по 2000 задачам банка: из 607 задач «мат»
 * расхождений ноль (прибор проверен подделкой), поэтому правка сделана ДО того,
 * как тег соврал, а не после.
 */

// Настоящая задача с прода: li_075iw. Сырой fen говорит «ход белых», но первый
// ход решения делает соперник, а мат ставят ЧЁРНЫЕ третьим своим ходом.
const SPROD = {
  id: "li_075iw",
  fen: "5r1k/p5pp/2p1Q3/1pq1p3/4P3/8/B4PPP/5RK1 w - - 0 32",
  sol: ["f1d1", "c5f2", "g1h1", "f2f1", "d1f1", "f8f1"],
  name: "Мат в 3 · Лёгкая",
  r: 1186,
  theme: "Мат на последней горизонтали",
  goal: "Mate" as const,
  side: "w" as const,
  mateIn: 3,
};

describe("«Мат в N» берётся из решения, а не из тега", () => {
  it("на живой задаче с прода решение даёт 3 — столько же, сколько честный тег", () => {
    expect(matovVResheniyi(SPROD)).toBe(3);
    expect(imyaPoResheniyu(SPROD)).toBe("Мат в 3");
  });

  it("ВРУЩИЙ тег не влияет на число: подменяем mateIn — ответ прежний", () => {
    expect(matovVResheniyi({ ...SPROD, mateIn: 1 })).toBe(3);
    expect(matovVResheniyi({ ...SPROD, mateIn: 99 })).toBe(3);
    // именно это и было бы напечатано раньше — «Мат в 1», которого нет
    expect(matovVResheniyi({ ...SPROD, mateIn: 1 })).not.toBe(1);
  });

  it("не мат — числа нет вовсе, а не ноль и не тег", () => {
    // решение обрывается до мата: тег остался, но правды в нём нет
    const неМат = { ...SPROD, sol: ["f1d1", "c5f2"], goal: "Best move" as const };
    expect(matovVResheniyi(неМат)).toBeNull();
    expect(matovVResheniyi({ ...неМат, mateIn: 3 })).toBeNull();
  });

  it("мусорное решение не притворяется матом", () => {
    expect(matovVResheniyi({ ...SPROD, sol: ["zzzz"] })).toBeNull();
    expect(matovVResheniyi({ ...SPROD, sol: [] })).toBeNull();
  });
});

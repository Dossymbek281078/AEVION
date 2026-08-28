import { describe, it, expect } from "vitest";
import { RANKS, gRank, новыйРейтинг, РЕЙТИНГ_МИН, РЕЙТИНГ_МАКС } from "../rating";

/**
 * Рейтинг — то, по чему человек видит свой прогресс. Формула жила внутри
 * компонента и не была закреплена ничем (28.08.2026).
 */
describe("рейтинг после партии", () => {
  it("победа над более сильным даёт больше, чем над слабым", () => {
    const надСильным = новыйРейтинг(1200, 2000, true) - 1200;
    const надСлабым = новыйРейтинг(1200, 400, true) - 1200;
    expect(надСильным).toBeGreaterThan(надСлабым);
  });

  it("победа над заведомо слабым всё равно что-то даёт", () => {
    expect(новыйРейтинг(2000, 400, true)).toBeGreaterThan(2000);
  });

  it("поражение от слабого стоит дороже, чем от сильного", () => {
    const отСлабого = 1200 - новыйРейтинг(1200, 400, false);
    const отСильного = 1200 - новыйРейтинг(1200, 2000, false);
    expect(отСлабого).toBeGreaterThan(отСильного);
  });

  it("рейтинг не уходит ниже пола и выше потолка", () => {
    expect(новыйРейтинг(РЕЙТИНГ_МИН, 3000, false)).toBe(РЕЙТИНГ_МИН);
    expect(новыйРейтинг(РЕЙТИНГ_МАКС, 100, true)).toBe(РЕЙТИНГ_МАКС);
  });

  it("серия поражений не загоняет рейтинг в минус", () => {
    let r = 300;
    for (let i = 0; i < 50; i++) r = новыйРейтинг(r, 100, false);
    expect(r).toBe(РЕЙТИНГ_МИН);
    expect(r).toBeGreaterThan(0);
  });
});

describe("звание по рейтингу", () => {
  test("новичок получает первое звание, а не пустоту", () => {
    expect(gRank(0).t).toBe("Начинающий");
    expect(gRank(100).t).toBe("Начинающий");
  });

  test("звание растёт вместе с рейтингом и никогда не падает при росте", () => {
    let prezhnij = -1;
    for (let r = 0; r <= 3000; r += 50) {
      const nomer = RANKS.findIndex((x) => x.t === gRank(r).t);
      expect(nomer).toBeGreaterThanOrEqual(prezhnij);
      prezhnij = nomer;
    }
  });

  test("на каждом пороге звание меняется ровно на нём, а не рядом", () => {
    for (const r of RANKS.slice(1)) {
      expect(gRank(r.min).t).toBe(r.t);
      expect(gRank(r.min - 1).t).not.toBe(r.t);
    }
  });

  test("рейтинг выше самой высокой планки — высшее звание", () => {
    const vysshee = RANKS[RANKS.length - 1];
    expect(gRank(9999).t).toBe(vysshee.t);
  });
});

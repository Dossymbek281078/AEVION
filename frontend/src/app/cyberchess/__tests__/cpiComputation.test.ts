import { describe, it, expect, beforeEach } from "vitest";
import { computeGameCPI, applyGameToCPI, __runTests, type GameMetrics } from "../cpi";

/**
 * CPI (Composite Performance Index) — киллер-фича CyberChess против lichess и
 * chess.com: рейтинг по 11 факторам, начисляющий за КАЧЕСТВО даже в проигрыше.
 * Расчёт жил с ВСТРОЕННЫМ __runTests(), но CI его не гонял — то есть эталоны
 * спеки ничем не защищены. Здесь они подняты в набор + добавлены инварианты
 * знаков: если у фактора перепутается знак/вес, главное число платформы
 * тихо начнёт врать игроку.
 */

// Нейтральная база: средняя партия, один фактор меняем за тест.
const base = (): GameMetrics => ({
  cplPerMove: Array.from({ length: 40 }, () => 30),
  timeMsPerMove: Array.from({ length: 40 }, (_, i) => (i % 2 ? 1000 : 0)),
  totalTimeMs: 600000,
  openingBookHits: 3,
  movesByEngineRank: Array.from({ length: 40 }, (_, i) => (i < 15 ? 1 : 4)),
  mateOpportunities: { m1: 0, m2: 0, m3: 0 },
  mateFound: { m1: 0, m2: 0, m3: 0 },
  hangs: 0,
  brilliancies: 0,
  result: "d",
});

describe("CPI: эталоны спеки (бывший встроенный __runTests) в CI", () => {
  it("все встроенные примеры формулы сходятся", () => {
    const { ok, failures } = __runTests();
    expect(failures, failures.join("; ")).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("CPI: знаки факторов — порча веса ломает эти инварианты", () => {
  it("зевки ШТРАФУЮТ: больше зевков → строго меньше итог", () => {
    const none = computeGameCPI({ ...base(), hangs: 0 }).total;
    const some = computeGameCPI({ ...base(), hangs: 3 }).total;
    expect(some).toBeLessThan(none);
  });

  it("блеск НАГРАЖДАЕТ: больше блестящих → строго больше итог", () => {
    const none = computeGameCPI({ ...base(), brilliancies: 0 }).total;
    const some = computeGameCPI({ ...base(), brilliancies: 2 }).total;
    expect(some).toBeGreaterThan(none);
  });

  it("результат: победа ≥ ничья ≥ поражение при прочих равных", () => {
    const w = computeGameCPI({ ...base(), result: "w" }).total;
    const d = computeGameCPI({ ...base(), result: "d" }).total;
    const l = computeGameCPI({ ...base(), result: "l" }).total;
    expect(w).toBeGreaterThanOrEqual(d);
    expect(d).toBeGreaterThanOrEqual(l);
    expect(w).toBeGreaterThan(l); // R_W=10 > R_L=0 — строго
  });

  it("найденный мат НАГРАЖДАЕТ: реализованная возможность > упущенной", () => {
    const found = computeGameCPI({ ...base(), mateOpportunities: { m1: 2, m2: 0, m3: 0 }, mateFound: { m1: 2, m2: 0, m3: 0 } }).total;
    const missed = computeGameCPI({ ...base(), mateOpportunities: { m1: 2, m2: 0, m3: 0 }, mateFound: { m1: 0, m2: 0, m3: 0 } }).total;
    expect(found).toBeGreaterThan(missed);
  });

  it("меньше средней потери (CPL) → выше итог (точнее игра ценится больше)", () => {
    const sharp = computeGameCPI({ ...base(), cplPerMove: Array.from({ length: 40 }, () => 8) }).total;
    const loose = computeGameCPI({ ...base(), cplPerMove: Array.from({ length: 40 }, () => 120) }).total;
    expect(sharp).toBeGreaterThan(loose);
  });

  it("итог = сумма компонентов минус штраф за зевки (H вычитается, не прибавляется)", () => {
    const b = computeGameCPI({ ...base(), hangs: 2 });
    const sum = b.E + b.T + b.O + b.B1 + b.B2 + b.B3 + b.M1 + b.M2 + b.M3 - b.H + b.Br + b.R;
    expect(Math.abs(b.total - sum)).toBeLessThan(0.05);
    expect(b.H).toBeGreaterThan(0); // штраф присутствует и он положительное число, вычитаемое
  });
});

describe("CPI: накопление состояния", () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* noop */ }
  });

  it("applyGameToCPI дописывает историю и держит рейтинг в [0,4000]", () => {
    const s1 = applyGameToCPI(base(), "g1");
    expect(s1.history).toHaveLength(1);
    expect(s1.cpi).toBeGreaterThanOrEqual(0);
    expect(s1.cpi).toBeLessThanOrEqual(4000);
    const s2 = applyGameToCPI(base(), "g2");
    expect(s2.history).toHaveLength(2);
  });

  it("рейтинг не уходит ниже нуля даже на кошмарной партии", () => {
    const nightmare: GameMetrics = { ...base(), cplPerMove: Array.from({ length: 60 }, () => 400), hangs: 50, brilliancies: 0, result: "l" };
    // много подряд — загоняем к нижнему клампу
    let s = applyGameToCPI(nightmare, "n1");
    for (let i = 0; i < 20; i++) s = applyGameToCPI(nightmare, `n${i + 2}`);
    expect(s.cpi).toBeGreaterThanOrEqual(0);
  });
});

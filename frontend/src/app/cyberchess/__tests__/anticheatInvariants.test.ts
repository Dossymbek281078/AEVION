import { describe, it, expect } from "vitest";
import { analyzeGameForCheating } from "../anticheat";
import type { MoveMetric } from "../stockfishMetrics";
import type { BehaviorSummary } from "../behaviorTracker";

/**
 * Античит — вопрос ДОВЕРИЯ на запуске. Две катастрофы: ложно обвинить честного
 * игрока и пропустить очевидный чит. Пороги здесь нечёткие (их калибруют), но
 * НАПРАВЛЕННЫЕ инварианты незыблемы и их-то и закрепляем — без фиксации самих
 * чисел, чтобы не мешать калибровке.
 */

// Ход-«диагностик»: ply>6, два близких кандидата (gap≤400, |eval|≤650) — такой
// ход идёт в статистику. Меняем rank/cpl/time под сценарий.
const mv = (ply: number, rank: 1 | 2 | 3 | 4, cpl: number, timeMs: number): MoveMetric => ({
  ply,
  fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  san: "Nf3",
  uci: "g1f3",
  engineTop3: [
    { uci: "g1f3", eval: 20, mateIn: null },
    { uci: "b1c3", eval: 0, mateIn: null },
    { uci: "d2d4", eval: -10, mateIn: null },
  ],
  cpl,
  rank,
  hadMate1: false, hadMate2: false, hadMate3: false,
  foundMate1: false, foundMate2: false, foundMate3: false,
  isHang: false,
  isBrilliancy: false,
  timeMs,
});

// Игрок — белые (нечётные ply). Генерим N ходов игрока начиная с ply 7.
const whiteGame = (n: number, pick: (i: number) => { rank: 1 | 2 | 3 | 4; cpl: number; timeMs: number }): MoveMetric[] =>
  Array.from({ length: n }, (_, i) => {
    const p = pick(i);
    return mv(7 + i * 2, p.rank, p.cpl, p.timeMs);
  });

const noBehavior: BehaviorSummary | null = null;
const fenCopy: BehaviorSummary = {
  tabHiddenCount: 0, windowBlurCount: 0, fenCopyCount: 1, rapidReturnCount: 0,
  instantMoveCount: 0, devtoolsCount: 0, maxHiddenMs: 0, totalHiddenMs: 0,
  suspicionEvents: [], behaviorScore: 0, fenCopyDetected: true,
};

// Честная человеческая игра: ~45% лучших, разброс потерь, разное время.
const honest = whiteGame(40, (i) => ({
  rank: (i % 20 < 9 ? 1 : (i % 3) + 2) as 1 | 2 | 3 | 4,
  cpl: 20 + (i % 7) * 18,
  timeMs: 2000 + (i % 5) * 3500,
}));

// Идеальная движковая игра: всегда лучший ход, почти ноль потерь, ровное время.
const perfect = whiteGame(40, () => ({ rank: 1, cpl: 2, timeMs: 4000 }));

describe("Античит: защита честного игрока", () => {
  it("мало данных (<10 ходов) → НИКОГДА не флагуем", () => {
    const thin = whiteGame(6, () => ({ rank: 1, cpl: 1, timeMs: 3000 }));
    const r = analyzeGameForCheating(thin, "w", 1200, noBehavior);
    expect(r.confidence).toBe("insufficient");
    expect(r.verdict).toBe("clean"); // даже идеальная короткая игра не обвиняется
  });

  it("честная человеческая игра не помечается ни suspicious, ни flagged", () => {
    const r = analyzeGameForCheating(honest, "w", 1500, noBehavior);
    expect(["clean", "unusual"]).toContain(r.verdict);
  });
});

describe("Античит: ловит очевидный чит", () => {
  it("идеальная движковая игра строго подозрительнее честной", () => {
    const rHonest = analyzeGameForCheating(honest, "w", 1200, noBehavior);
    const rPerfect = analyzeGameForCheating(perfect, "w", 1200, noBehavior);
    expect(rPerfect.suspicionScore).toBeGreaterThan(rHonest.suspicionScore);
  });

  it("идеальная игра у игрока с низким рейтингом эскалирует вердикт выше clean", () => {
    const r = analyzeGameForCheating(perfect, "w", 1200, noBehavior);
    expect(r.verdict).not.toBe("clean");
  });

  it("копирование FEN в буфер → мгновенный flagged, независимо от ходов", () => {
    // даже на честной по ходам игре копирование позиции — near-definitive
    const r = analyzeGameForCheating(honest, "w", 1500, fenCopy);
    expect(r.verdict).toBe("flagged");
    expect(r.fenCopyDetected).toBe(true);
  });
});

describe("Античит: монотонность по доле лучших ходов", () => {
  it("больше top-1 при прочих равных → не меньше подозрения", () => {
    const mid = whiteGame(40, (i) => ({ rank: (i % 2 === 0 ? 1 : 2) as 1 | 2, cpl: 15, timeMs: 4000 }));
    const rMid = analyzeGameForCheating(mid, "w", 1200, noBehavior);
    const rHigh = analyzeGameForCheating(perfect, "w", 1200, noBehavior);
    expect(rHigh.suspicionScore).toBeGreaterThanOrEqual(rMid.suspicionScore);
  });
});

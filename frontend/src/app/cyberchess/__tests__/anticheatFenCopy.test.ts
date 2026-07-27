import { describe, it, expect } from "vitest";
import { analyzeGameForCheating } from "../anticheat";
import { BehaviorTracker, type BehaviorSummary } from "../behaviorTracker";
import type { MoveMetric } from "../stockfishMetrics";

/* Копирование FEN считалось почти доказательством работы с движком и ставило вердикт
   «flagged» сразу — до порога выборки и до схождения нескольких сигналов. При этом само
   приложение кладёт FEN в буфер: клавиша S делится позицией ссылкой, а в предпросмотре
   стоит кнопка «📋 Копировать FEN». Игрок нажимал кнопку продукта и получал обвинение
   с первой же партии. */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Ход белых, попадающий в диагностическую выборку (ply > 6, позиция не решена). */
const move = (ply: number, rank: 1 | 2 | 3 | 4 = 3): MoveMetric => ({
  ply,
  fenBefore: START,
  san: "Nf3",
  uci: "g1f3",
  engineTop3: [
    { uci: "g1f3", eval: 20, mateIn: null },
    { uci: "d2d4", eval: -10, mateIn: null },
    { uci: "e2e4", eval: -40, mateIn: null },
  ],
  cpl: 60,
  rank,
  hadMate1: false,
  hadMate2: false,
  hadMate3: false,
  foundMate: false,
  timeMs: 9000,
  phase: "middlegame",
});

/** N ходов белых начиная с ply 7 — до этого ходы считаются дебютными. */
const whiteMoves = (n: number) => Array.from({ length: n }, (_, i) => move(7 + i * 2));

const withFenCopy: BehaviorSummary = {
  tabHiddenCount: 0,
  windowBlurCount: 0,
  fenCopyCount: 1,
  rapidReturnCount: 0,
  instantMoveCount: 0,
  devtoolsCount: 0,
  maxHiddenMs: 0,
  totalHiddenMs: 0,
  suspicionEvents: [],
  behaviorScore: 60,
  fenCopyDetected: true,
};

describe("вердикт по копированию FEN", () => {
  it("на короткой партии не выносит обвинение, а помечает подозрение", () => {
    const r = analyzeGameForCheating(whiteMoves(4), "w", 1400, withFenCopy);
    expect(r.confidence).toBe("insufficient");
    expect(r.verdict).toBe("suspicious");
  });

  it("когда ходов хватает, признак работает в полную силу", () => {
    const r = analyzeGameForCheating(whiteMoves(40), "w", 1400, withFenCopy);
    expect(r.confidence).not.toBe("insufficient");
    expect(r.verdict).toBe("flagged");
  });

  it("без копирования короткая партия не даёт обвинения", () => {
    const r = analyzeGameForCheating(whiteMoves(4), "w", 1400, null);
    expect(r.verdict).not.toBe("flagged");
  });
});

describe("самопометка копирования", () => {
  const fireCopy = (text: string) => {
    const e = new Event("copy");
    Object.defineProperty(e, "clipboardData", {
      value: { getData: () => text },
      configurable: true,
    });
    document.dispatchEvent(e);
  };

  const running = () => {
    const t = new BehaviorTracker();
    t.attach();
    t.onTurnStart(5);
    return t;
  };

  it("копирование игроком по-прежнему видно", () => {
    const t = running();
    fireCopy(START);
    expect(t.getSummary().fenCopyDetected).toBe(true);
    t.detach();
  });

  it("копирование, которое сделало приложение, не считается", () => {
    const t = running();
    t.markSelfCopy();
    fireCopy(START);
    expect(t.getSummary().fenCopyDetected).toBe(false);
    t.detach();
  });

  it("метка не открывает окно навсегда — только на ближайшие секунды", () => {
    const t = running();
    t.markSelfCopy();
    (t as unknown as { selfCopyAt: number }).selfCopyAt = Date.now() - 10_000;
    fireCopy(START);
    expect(t.getSummary().fenCopyDetected).toBe(true);
    t.detach();
  });

  it("обычный текст в буфере не принимается за позицию", () => {
    const t = running();
    fireCopy("хорошая партия, спасибо");
    expect(t.getSummary().fenCopyDetected).toBe(false);
    t.detach();
  });
});

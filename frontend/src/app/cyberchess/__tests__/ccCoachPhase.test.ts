import { describe, it, expect } from "vitest";
import { detectPhase } from "../chessCoachEngine";

/**
 * 13.09.2026. Дефект найден живым тестом коуча на проде: коуч называл
 * ЭНДШПИЛЬНУЮ задачу «дебютом» и советовал дебютные принципы (рокировка,
 * развитие коней) на позиции без рокировки. Причина — detectPhase судила по
 * plyCount (<20 → opening), а у ЗАГРУЖЕННОЙ задачи plyCount=0 при любой фазе.
 * Починка: фаза по ПОЗИЦИИ (число фигур/пешек), не по номеру хода.
 *
 * Поведенческий тест (реальные FEN → фаза), не source-guard.
 */
describe("detectPhase — фаза по позиции, не по номеру хода", () => {
  it("эндшпильная задача (мало фигур, plyCount=0) — endgame, НЕ opening", () => {
    // ладейный эндшпиль, «ход 1» как у загруженной задачи
    expect(detectPhase("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", 0)).toBe("endgame");
  });

  it("миттельшпильная задача (средний материал, мало пешек, plyCount=0) — не opening", () => {
    // ферзь+ладьи+кони, пешек мало — типичная тактическая задача из середины
    const fen = "3r2k1/5ppp/8/3q4/3R4/5N2/5PPP/3R2K1 w - - 0 1";
    expect(detectPhase(fen, 0)).not.toBe("opening");
  });

  it("реальный дебют (полная доска, мало ходов) — opening", () => {
    expect(detectPhase("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", 2)).toBe("opening");
  });

  it("миттельшпиль с полной доской, но много ходов — middlegame", () => {
    const fen = "r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 12";
    expect(detectPhase(fen, 24)).toBe("middlegame");
  });

  it("глубокий эндшпиль даже при большом plyCount — endgame", () => {
    expect(detectPhase("8/8/4k3/8/8/4K3/4P3/8 w - - 0 60", 120)).toBe("endgame");
  });
});

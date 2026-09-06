import { describe, it, expect } from "vitest";
import { rollDice, filterMovesByDice } from "../variants";

/**
 * Diceblade: кубик задаёт, какой фигурой можно ходить в этот ход. Если фильтр
 * ошибётся — вариант молча ломается: либо запретит легальный ход, либо разрешит
 * ход не той фигурой. Правило чистое — проверяем без браузера.
 *
 * Два инварианта, которые НЕЛЬЗЯ терять:
 *   1) ходы королём разрешены ВСЕГДА (иначе игрок может застрять без ходов);
 *   2) грань 6 («любая фигура») ничего не ограничивает.
 */

type M = { piece: string; id: number };
const moves: M[] = [
  { piece: "p", id: 1 },
  { piece: "n", id: 2 },
  { piece: "b", id: 3 },
  { piece: "r", id: 4 },
  { piece: "q", id: 5 },
  { piece: "k", id: 6 },
];

describe("Diceblade: rollDice раскладывает грани по фигурам", () => {
  it("каждая грань 1..6 отдаёт согласованный тип и подпись, тип из набора chess.js", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const { face, pieceType, label } = rollDice();
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
      expect(label.length).toBeGreaterThan(0);
      // грань 6 = «любая» → пустой тип; остальные → конкретная фигура chess.js
      if (face === 6) expect(pieceType).toBe("");
      else expect(["p", "n", "b", "r", "q"]).toContain(pieceType);
      seen.add(face);
    }
    // за 300 бросков должны выпасть все шесть граней (иначе генератор кривой)
    expect(seen.size).toBe(6);
  });
});

describe("Diceblade: filterMovesByDice оставляет только нужную фигуру + короля", () => {
  it("выпал конь → остаются кони И ходы короля, остальное отсечено", () => {
    const out = filterMovesByDice(moves, "n").map((m) => m.piece).sort();
    expect(out).toEqual(["k", "n"]);
  });
  it("король разрешён при ЛЮБОй выпавшей фигуре (инвариант против тупика)", () => {
    for (const p of ["p", "n", "b", "r", "q"]) {
      expect(filterMovesByDice(moves, p).some((m) => m.piece === "k"), `король пропал при кубике ${p}`).toBe(true);
    }
  });
  it("грань «любая» (пустой тип) не ограничивает ничего", () => {
    expect(filterMovesByDice(moves, "").length).toBe(moves.length);
  });
  it("выпала фигура, которой нет на доске → остаются только ходы короля", () => {
    const noQueen = moves.filter((m) => m.piece !== "q");
    const out = filterMovesByDice(noQueen, "q").map((m) => m.piece);
    expect(out).toEqual(["k"]);
  });
});

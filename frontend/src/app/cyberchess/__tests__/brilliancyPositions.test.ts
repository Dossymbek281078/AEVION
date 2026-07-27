import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { BRILLIANCIES } from "../brilliancy";

/* Последний набор позиций модуля, который никто не проигрывал, и он платит Chessy за
   верный ответ. Проверяется то же, что и у коуча: позиция грузится и могла возникнуть в
   партии, объявленная сторона совпадает с очередью хода, решение легально, а записанное
   как мат — действительно мат. Ответ сверяется по SAN, поэтому и altSans должны играться:
   игрок вводит их руками. */

describe("BRILLIANCIES", () => {
  it("ships a hunt to play", () => {
    expect(BRILLIANCIES.length).toBeGreaterThan(5);
  });

  it("loads every position and matches the side it declares", () => {
    const bad: string[] = [];
    for (const b of BRILLIANCIES) {
      try {
        const c = new Chess(b.fen);
        if (c.turn() !== b.side) bad.push(`${b.id}: side=${b.side}, а ход у ${c.turn()}`);
      } catch {
        bad.push(`${b.id}: FEN не грузится`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("never starts with the idle side already in check", () => {
    const bad = BRILLIANCIES.filter((b) => {
      const flipped = b.fen.replace(/ (w|b) /, (_m, t) => ` ${t === "w" ? "b" : "w"} `);
      try {
        return new Chess(flipped).inCheck();
      } catch {
        return false;
      }
    }).map((b) => b.id);
    expect(bad).toEqual([]);
  });

  it("accepts every answer it is willing to take", () => {
    const bad: string[] = [];
    for (const b of BRILLIANCIES) {
      let legal: string[];
      try {
        legal = new Chess(b.fen).moves().map((m) => m.replace(/[+#]/g, ""));
      } catch {
        continue;
      }
      for (const san of [b.solutionSan, ...(b.altSans ?? [])]) {
        if (!legal.includes(san.replace(/[+#!?]/g, ""))) bad.push(`${b.id}: ${san}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("delivers the mate it writes down", () => {
    const bad: string[] = [];
    for (const b of BRILLIANCIES) {
      if (!b.solutionSan.includes("#")) continue;
      const c = new Chess(b.fen);
      try {
        c.move(b.solutionSan);
      } catch {
        continue; // поймает соседний тест
      }
      if (!c.isCheckmate()) bad.push(`${b.id}: ${b.solutionSan} записан матом, а мата нет`);
    }
    expect(bad).toEqual([]);
  });
});

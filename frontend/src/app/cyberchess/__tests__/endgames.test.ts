import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { ENDGAMES } from "../endgames";

/* Each drill loads its FEN and tells the player to reach `goal`. Two of these positions
   claimed Win for a position that is drawn with correct play, so the drill could not be
   finished however well it was played. The Win/Draw claim itself needs a solver and is
   checked separately; what this file locks down is that the board is sane and the
   material matches the name on the card. */

const pieces = (fen: string) => {
  const board = fen.split(" ")[0];
  const count: Record<string, number> = {};
  for (const ch of board) if (/[a-zA-Z]/.test(ch)) count[ch] = (count[ch] ?? 0) + 1;
  return count;
};

describe("endgame drills", () => {
  it("ships the twelve the menu advertises", () => {
    expect(ENDGAMES.length).toBe(12);
  });

  it("names each one distinctly", () => {
    const names = ENDGAMES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("loads every position on a real board", () => {
    const bad: string[] = [];
    for (const e of ENDGAMES) {
      try {
        new Chess(e.fen);
      } catch (err) {
        bad.push(`${e.name}: ${(err as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("starts with the side the drill says the player is", () => {
    const bad: string[] = [];
    for (const e of ENDGAMES) {
      const turn = new Chess(e.fen).turn();
      if (turn !== e.side) bad.push(`${e.name}: ходит ${turn}, заявлено ${e.side}`);
    }
    expect(bad).toEqual([]);
  });

  it("never opens on a finished game", () => {
    const bad: string[] = [];
    for (const e of ENDGAMES) {
      const c = new Chess(e.fen);
      if (c.isGameOver()) bad.push(`${e.name}: ${c.isCheckmate() ? "мат" : c.isStalemate() ? "пат" : "ничья"}`);
    }
    expect(bad).toEqual([]);
  });

  /* chess.js loads a position where the side NOT to move is already in check — the
     opponent's king could simply be captured, so no such position can arise in a game.
     Four of the twelve drills shipped exactly that: a queen or rook lined up on the
     enemy king with the wrong side to move. The tablebase refuses them outright; the
     board just draws them. Detected by flipping the side to move and asking. */
  it("never starts with the idle side already in check", () => {
    const bad: string[] = [];
    for (const e of ENDGAMES) {
      const flipped = e.fen.replace(/ (w|b) /, (_m, t) => ` ${t === "w" ? "b" : "w"} `);
      let c: Chess;
      try {
        c = new Chess(flipped);
      } catch {
        continue; // такой FEN уже поймает соседний тест
      }
      if (c.inCheck()) bad.push(`${e.name}: под шахом сторона, которая не ходит`);
    }
    expect(bad).toEqual([]);
  });

  /* Both kings are always on the board; a FEN missing one is the failure that hid in the
     coach data, and it silently prevents the position from loading at all. */
  it("has both kings", () => {
    for (const e of ENDGAMES) {
      const p = pieces(e.fen);
      expect(p["K"], e.name).toBe(1);
      expect(p["k"], e.name).toBe(1);
    }
  });

  /* The name promises the material. A drill called "два слона" that ships one bishop
     teaches a mate the player cannot deliver. */
  it("puts on the board the material its name promises", () => {
    const expectations: [RegExp, string, number][] = [
      [/^KQ vs K$/, "Q", 1],
      [/^KR vs K$/, "R", 1],
      [/^Два слона/, "B", 2],
      [/^Конь \+ слон/, "N", 1],
      [/^KBN vs K/, "B", 1],
      [/^KBN vs K/, "N", 1],
    ];
    const bad: string[] = [];
    for (const e of ENDGAMES) {
      const p = pieces(e.fen);
      for (const [name, piece, n] of expectations) {
        if (name.test(e.name) && (p[piece] ?? 0) !== n) {
          bad.push(`${e.name}: ${piece}×${p[piece] ?? 0}, ожидалось ${n}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("pays something for every drill and says what to do", () => {
    for (const e of ENDGAMES) {
      expect(e.reward).toBeGreaterThan(0);
      expect(e.hint.length).toBeGreaterThan(20);
      expect(["Win", "Draw"]).toContain(e.goal);
    }
  });

  /* A bare-king side cannot be asked to win. */
  it("does not ask a side with no material to win", () => {
    const bad: string[] = [];
    for (const e of ENDGAMES.filter((x) => x.goal === "Win")) {
      const p = pieces(e.fen);
      const mine = e.side === "w" ? ["Q", "R", "B", "N", "P"] : ["q", "r", "b", "n", "p"];
      if (!mine.some((x) => p[x])) bad.push(`${e.name}: у играющего только король`);
    }
    expect(bad).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { ingestPuzzles, normalizeThemes, repairUnshiftedPuzzles } from "../puzzleIngest";

/* Дефект, ради которого это существует: пул на бэкенде собран без сдвига, который
   требует формат Lichess, и игроку показывали позицию на полуход раньше — правильным
   ответом считался ход СОПЕРНИКА. У матовых задач это кончалось тем, что игрок
   доигрывал «решение» и получал мат. */

// Мат Лёгаля-подобная концовка: чёрные берут коня, белые матуют. В сыром виде задача
// начинается ходом чёрных (соперник), поэтому решение чётной длины.
const RAW_MATE = {
  fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1",
  sol: ["a7a6", "b5c6"], // 1...a6 2.Bxc6 — ход чёрных первым выдаёт несдвинутую запись
  side: "b",
  theme: "fork",
};

describe("repairUnshiftedPuzzles", () => {
  it("hands the move back to the player when the solution has even length", () => {
    const [fixed] = repairUnshiftedPuzzles([RAW_MATE]);
    expect(fixed.fen).not.toBe(RAW_MATE.fen);
    expect(fixed.sol).toEqual(["b5c6"]);
    expect(fixed.side).toBe("w"); // сторона берётся из НОВОЙ позиции, а не из старой
    expect(new Chess(fixed.fen).turn()).toBe("w");
  });

  it("leaves a correctly shifted puzzle alone", () => {
    const ok = { fen: RAW_MATE.fen, sol: ["a7a6"], side: "b" };
    expect(repairUnshiftedPuzzles([ok])[0]).toEqual(ok);
  });

  it("gives the player the last move of every repaired solution", () => {
    const [fixed] = repairUnshiftedPuzzles([RAW_MATE]);
    expect(fixed.sol.length % 2).toBe(1);
  });

  it("keeps a record whose first move cannot be played rather than dropping it", () => {
    const broken = { fen: RAW_MATE.fen, sol: ["h1h8", "a7a6"], side: "b" };
    expect(repairUnshiftedPuzzles([broken])[0]).toEqual(broken);
  });

  it("survives a corrupt fen without throwing", () => {
    const junk = { fen: "не фен", sol: ["a2a3", "a7a6"], side: "w" };
    expect(() => repairUnshiftedPuzzles([junk])).not.toThrow();
    expect(repairUnshiftedPuzzles([junk])[0]).toEqual(junk);
  });

  /* Свойство, ради которого делается сдвиг: мат должен ставить ИГРОК. На боевой выборке
     до починки это не выполнялось ни в одной из 6370 матовых задач. */
  it("makes the player, not the opponent, deliver the mate", () => {
    // Дурацкий мат: позиция после 1.f3 e5, ход белых. Сырая запись начинается ходом
    // белых g2-g4 — это и есть подводка соперника, а матует чёрный ферзь.
    const raw = {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2",
      sol: ["g2g4", "d8h4"],
      side: "w",
    };
    const [fixed] = repairUnshiftedPuzzles([raw]);
    const c = new Chess(fixed.fen);
    const player = c.turn();
    let mateBy: string | null = null;
    for (const u of fixed.sol) {
      const who = c.turn();
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
      if (c.isCheckmate()) {
        mateBy = who;
        break;
      }
    }
    expect(mateBy).toBe(player);
  });
});

describe("normalizeThemes", () => {
  it("collapses the Lichess tag and its Russian twin onto one theme", () => {
    const [a, b] = normalizeThemes([{ theme: "fork" }, { theme: "Вилка" }]);
    expect(a.theme).toBe(b.theme);
  });

  it("passes an unknown theme through instead of swallowing it", () => {
    expect(normalizeThemes([{ theme: "somethingNew" }])[0].theme).toBe("somethingNew");
  });

  it("leaves a record without a theme untouched", () => {
    expect(normalizeThemes([{ fen: "x" } as { fen: string; theme?: string }])[0]).toEqual({ fen: "x" });
  });
});

describe("ingestPuzzles", () => {
  it("does both jobs — one entry point for all three load paths", () => {
    const [out] = ingestPuzzles([RAW_MATE]);
    expect(out.theme).toBe("Вилка");
    expect(out.sol).toEqual(["b5c6"]);
  });
});

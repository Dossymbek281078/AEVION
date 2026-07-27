import { describe, it, expect } from "vitest";
import { scoreGuess, getValidGames, buildFenLine, MASTER_GAMES } from "../masters";

/* The guess arrives as free text the player types, and it used to be compared to the
   stored SAN character for character. The shipped games contain 49 moves ending in "+"
   and 5 in "#", so naming the right move without the check symbol was marked wrong —
   the trainer failing correct answers in the one mode that teaches from real games. */

describe("scoreGuess", () => {
  it("accepts the move without its check or mate symbol", () => {
    expect(scoreGuess("Nf3+", "Nf3").correct).toBe(true);
    expect(scoreGuess("Qxh7#", "Qxh7").correct).toBe(true);
    // And the other way round, if the player types one that is not there.
    expect(scoreGuess("Nf3", "Nf3+").correct).toBe(true);
  });

  it("accepts castling written with zeros", () => {
    expect(scoreGuess("O-O", "0-0").correct).toBe(true);
    expect(scoreGuess("O-O-O", "0-0-0").correct).toBe(true);
  });

  it("ignores annotation marks and surrounding space", () => {
    expect(scoreGuess("Bb5", "  Bb5!  ").correct).toBe(true);
    expect(scoreGuess("Bb5", "Bb5?!").correct).toBe(true);
  });

  /* Case is left alone on purpose: in SAN a leading lowercase letter is a file, so
     bxc4 is a pawn capture and Bxc4 is a bishop capture — different moves. Folding
     case would credit the wrong answer. */
  it("does not treat a pawn move as the bishop move of the same name", () => {
    expect(scoreGuess("Bxc4", "bxc4").correct).toBe(false);
    expect(scoreGuess("bxc4", "Bxc4").correct).toBe(false);
  });

  it("still rejects a genuinely different move", () => {
    expect(scoreGuess("Nf3", "Nc3").correct).toBe(false);
    expect(scoreGuess("e4", "d4").correct).toBe(false);
  });

  it("handles an empty or missing guess", () => {
    expect(scoreGuess("Nf3", null).correct).toBe(false);
    expect(scoreGuess("Nf3", "").correct).toBe(false);
  });

  it("pays only for a correct guess", () => {
    expect(scoreGuess("Nf3+", "Nf3").reward).toBeGreaterThan(0);
    expect(scoreGuess("Nf3", "Nc3").reward).toBe(0);
  });

  it("reports the actual move back so the UI can show it", () => {
    expect(scoreGuess("Qxh7#", "Nf3").actual).toBe("Qxh7#");
  });
});

describe("the shipped master games", () => {
  it("all replay legally from the start position", () => {
    const games = getValidGames();
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) {
      // buildFenLine stops early on an illegal move, so a full line proves the game.
      expect(buildFenLine(g)).toHaveLength(g.moves.length + 1);
    }
  });

  it("writes castling with letters, matching what chess.js produces", () => {
    for (const g of getValidGames()) {
      for (const san of g.moves) {
        expect(san).not.toMatch(/0-0/);
      }
    }
  });
});

/* getValidGames() проигрывает каждую партию и молча выбрасывает ту, что не сходится —
   поэтому опечатка не падает, а просто убирает партию из раздела. Так и было: три из
   одиннадцати не доигрывались, игрок видел восемь. Две спотыкались о результат «1-0»,
   записанный как ход, у третьей после мата Ne2# стояли ещё два хода, которых быть не
   может. Фильтр обязан возвращать ВСЕ партии — иначе контент исчезает беззвучно. */
describe("MASTER_GAMES", () => {
  it("loses none of its games to the validity filter", () => {
    const dropped = MASTER_GAMES.filter((g) => !getValidGames().some((v) => v.id === g.id)).map((g) => g.id);
    expect(dropped).toEqual([]);
  });

  it("never carries a result token inside the moves", () => {
    const withResult = MASTER_GAMES.filter((g) => g.moves.some((m) => /^(1-0|0-1|1\/2-1\/2|\*)$/.test(m))).map((g) => g.id);
    expect(withResult).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { buildPlayerProfile } from "../mirrorMode";

/* Зеркальный режим подбирает силу по доле побед игрока. Разбор результата здесь был
   ТРЕТЬЕЙ независимой копией и не знал ни одной реальной строки приложения: «Checkmate!
   You win! 🏆» не проходил, «AI timed out — you win!» тоже. Победы не считались никогда,
   поэтому оценка ELO у всех была минимальной. */

const game = (result: string) => ({
  result,
  playerColor: "w" as const,
  moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"],
});

describe("buildPlayerProfile", () => {
  it("counts the wins the app actually records", () => {
    const wins = Array.from({ length: 10 }, () => game("Checkmate! You win! 🏆"));
    const losses = Array.from({ length: 10 }, () => game("Checkmate — AI wins"));
    expect(buildPlayerProfile(wins).estimatedElo).toBeGreaterThan(
      buildPlayerProfile(losses).estimatedElo,
    );
  });

  it("counts a win on the clock as a win", () => {
    const onTime = Array.from({ length: 10 }, () => game("AI timed out — you win!"));
    const losses = Array.from({ length: 10 }, () => game("You resigned"));
    expect(buildPlayerProfile(onTime).estimatedElo).toBeGreaterThan(
      buildPlayerProfile(losses).estimatedElo,
    );
  });

  it("moves the engine depth with the estimate, not only the rating number", () => {
    const wins = Array.from({ length: 10 }, () => game("Checkmate! You win! 🏆"));
    expect(buildPlayerProfile(wins).stockfishDepth).toBeGreaterThan(4);
  });
});

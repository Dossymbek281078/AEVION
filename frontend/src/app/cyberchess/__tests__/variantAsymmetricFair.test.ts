import { describe, it, expect } from "vitest";
import { randomArmy, asymmetricFen, buildArmyFen } from "../variants";

const VAL: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, K: 0 };
const rankBudget = (rank: string) =>
  rank.split("").reduce((a, c) => a + (VAL[c.toUpperCase()] ?? 0), 0);
const rankKings = (rank: string) => rank.split("").filter((c) => c.toUpperCase() === "K").length;

/**
 * Asymmetric — обе стороны получают РАЗНЫЙ состав фигур, но РАВНЫЙ материал
 * (бюджет 39 очков). Если бюджеты разойдутся — одна сторона тихо стартует с
 * перевесом, а вариант отвечает 200 и не падает. Правило чистое — без браузера.
 *
 * ⚠️ ЗАМЕЧЕНО 06.09.2026 и вынесено основателю (НЕ чинил — это баланс, решение
 * автора): случайная армия суммирует 39, а ЗАПАСНАЯ (fallback в randomArmy,
 * если 200 попыток не дали решения) — R+N+B+Q+B+N+R = 31. Практически fallback
 * почти недостижим, поэтому тест ниже его не ловит и НЕ должен: он закрепляет
 * норму (39=39), а расхождение fallback помечено словами. Чинить — только по
 * слову основателя (сделать fallback тоже 39 либо привести цель к 31).
 */

describe("Asymmetric: обе армии — равный бюджет, разный состав", () => {
  it("randomArmy: 500 прогонов — 7 нефигур короля, бюджет ровно 39, король на e", () => {
    for (let t = 0; t < 500; t++) {
      const { piecesByFile } = randomArmy();
      expect(piecesByFile).toHaveLength(8);
      expect(piecesByFile[4], "король должен стоять на файле e (индекс 4)").toBe("K");
      const nonKing = piecesByFile.filter((p) => p !== "K");
      expect(nonKing).toHaveLength(7);
      for (const p of nonKing) expect(["Q", "R", "B", "N"]).toContain(p);
      expect(piecesByFile.reduce((a, p) => a + (VAL[p] ?? 0), 0), "бюджет армии обязан быть 39").toBe(39);
    }
  });

  it("asymmetricFen: у белых и чёрных РАВНЫЙ материал и по одному королю", () => {
    for (let t = 0; t < 300; t++) {
      const { fen } = asymmetricFen();
      const ranks = fen.split(" ")[0].split("/");
      const black = ranks[0];
      const white = ranks[7];
      expect(rankBudget(white)).toBe(rankBudget(black)); // честность
      expect(rankBudget(white)).toBe(39);
      expect(rankKings(white)).toBe(1);
      expect(rankKings(black)).toBe(1);
    }
  });
});

describe("Asymmetric: ручной билдер армии валидирует бюджет", () => {
  it("две легальные армии на 39 очков принимаются, король на месте", () => {
    // 39 = Q9 + R5 + R5 + B3 + B3 + N3 + ... нужно 7 слотов = 39.
    // Q(9)+R(5)+R(5)+B(3)+B(3)+N(3)+... = 28 за 6 слотов, +N(3)+... не хватит.
    // Возьмём Q+R+R+R+R+B+... R×4=20+Q9=29, +B3+... 7 слотов: Q,R,R,R,R,B,B = 9+20+6=35 — мало.
    // Проще: Q,Q,R,R,R,B,N = 9+9+5+5+5+3+3 = 39. ✓ (7 слотов)
    const army: ("Q" | "R" | "B" | "N")[] = ["Q", "Q", "R", "R", "R", "B", "N"];
    expect(army.reduce((a, p) => a + VAL[p], 0)).toBe(39); // контроль самого теста
    const res = buildArmyFen(army, army);
    expect(res).not.toBeNull();
    const ranks = res!.fen.split(" ")[0].split("/");
    expect(rankBudget(ranks[7])).toBe(39);
    expect(rankKings(ranks[7])).toBe(1);
  });

  it("бюджет НЕ 39 → отклонено (nul), а не молча принято", () => {
    const tooWeak: ("Q" | "R" | "B" | "N")[] = ["N", "N", "N", "N", "N", "N", "N"]; // 21
    const tooStrong: ("Q" | "R" | "B" | "N")[] = ["Q", "Q", "Q", "Q", "R", "R", "R"]; // 51
    expect(buildArmyFen(tooWeak, tooWeak)).toBeNull();
    expect(buildArmyFen(tooStrong, tooStrong)).toBeNull();
  });

  it("не 7 слотов → отклонено", () => {
    expect(buildArmyFen(["Q", "R", "R"] as any, ["Q", "R", "R"] as any)).toBeNull();
  });
});

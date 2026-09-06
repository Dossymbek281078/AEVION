import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
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
 * ⚠️ ИСТОРИЯ: 06.09.2026 запасная армия (fallback в randomArmy, если 200 попыток
 * не дали решения) суммировала R+N+B+Q+B+N+R = 31, а не 39 — если бы fallback
 * сработал для ОДНОЙ стороны, у неё было бы 31 против 39 (тихий перевес в 8
 * очков). По слову основателя («все делай») исправлено: fallback тоже даёт 39,
 * так как 39 — явное намерение функции (все валидные ветви дают 39), а не
 * балансный выбор. Тест ниже закрепляет это и на happy-path, и на самом
 * fallback-константе (читаем исходник).
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

  it("запасная армия (fallback) тоже суммирует 39 — не 31, как было", () => {
    // fallback недостижим в happy-path (200 попыток хватает), поэтому проверяем
    // САМУ КОНСТАНТУ в исходнике: piecesByFile в ветви «Fallback ... army».
    const src = readFileSync(join(process.cwd(), "src/app/cyberchess/variants.ts"), "utf8");
    // Якорь структурный: fallback-армия — это единственный piecesByFile, СРАЗУ
    // за которым идёт агрегированный pieces:[{ ... }] в return-объекте.
    // (В generate960Backrank тоже есть слово «Fallback», но без piecesByFile,
    // а random-путь строит piecesByFile отдельной изменяемой переменной.)
    const m = src.match(/piecesByFile:\s*\[([^\]]+)\],\s*pieces:\s*\[\{/);
    expect(m, "не нашёл fallback-return армии").not.toBeNull();
    const pieces = m![1].split(",").map((s) => s.replace(/["'\s]/g, ""));
    const budget = pieces.reduce((a, p) => a + (VAL[p.toUpperCase()] ?? 0), 0);
    expect(budget, `fallback-армия ${pieces.join("")} = ${budget}, должно быть 39`).toBe(39);
    expect(pieces.filter((p) => p.toUpperCase() === "K").length, "у fallback ровно один король").toBe(1);
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

import { describe, it, expect } from "vitest";
import {
  generate960Backrank,
  kothWinner,
  applyExplosion,
  twinKingsLossSideByCaptures,
} from "../variants";

/**
 * Ядро корректности вариантов — генераторы стартовых позиций и функции
 * win-condition — определяет ИСХОД партии, но покрыто не было (роадмап #5).
 * Баг здесь тихий и дорогой: игроку объявят выигрыш/проигрыш неверно, а
 * страница при этом отвечает 200 и ошибок в консоли нет. Юнитами (без браузера)
 * это ловится дёшево и детерминированно.
 */

describe("Chess960: каждая сгенерированная позиция ЛЕГАЛЬНА", () => {
  it("500 прогонов — слоны на разных цветах, король между ладьями, полный состав", () => {
    for (let t = 0; t < 500; t++) {
      const br = generate960Backrank();
      expect(br, "бэкранк должен быть 8 клеток").toHaveLength(8);
      // Полный и точный состав фигур (перестановка RNBQKBNR)
      const sorted = br.split("").sort().join("");
      expect(sorted, `неверный состав: ${br}`).toBe("BBKNNQRR");
      // Слоны на клетках РАЗНОГО цвета (индексы разной чётности)
      const b1 = br.indexOf("B");
      const b2 = br.lastIndexOf("B");
      expect(b1 % 2 === b2 % 2, `слоны на одном цвете: ${br}`).toBe(false);
      // Король СТРОГО между двумя ладьями (иначе рокировка невозможна)
      const k = br.indexOf("K");
      const r1 = br.indexOf("R");
      const r2 = br.lastIndexOf("R");
      expect(r1 < k && k < r2, `король не между ладьями: ${br}`).toBe(true);
    }
  });
});

describe("King of the Hill: победа = король на центральной клетке", () => {
  // FEN, где ОДИН король стоит на заданной клетке (остальная доска пуста).
  const kingOn = (sq: string, piece: "K" | "k") => {
    const file = sq.charCodeAt(0) - 97;      // 0..7
    const rankIdx = 8 - Number(sq[1]);       // 0 = rank8
    const ranks = Array.from({ length: 8 }, () => "8");
    // ряд короля: пустые клетки слева + фигура + пустые справа (напр. e4 → "4K3")
    ranks[rankIdx] = (file > 0 ? String(file) : "") + piece + (7 - file > 0 ? String(7 - file) : "");
    return `${ranks.join("/")} w - - 0 1`;
  };

  // ВСЕ четыре центральные клетки — иначе выпадение одной из списка не ловится
  // (ровно этот пробел поймала мутация 06.09: тест на e4/d5 пропускал d4).
  it.each(["d4", "d5", "e4", "e5"])("белый король на %s → победа белых", (sq) => {
    expect(kothWinner(kingOn(sq, "K"))).toBe("w");
  });
  it.each(["d4", "d5", "e4", "e5"])("чёрный король на %s → победа чёрных", (sq) => {
    expect(kothWinner(kingOn(sq, "k"))).toBe("b");
  });
  it("короли на стартовых клетках → победы нет", () => {
    expect(kothWinner("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBeNull();
  });
  it.each(["e3", "c4", "d6", "f5"])("король рядом с центром (%s), но не на нём → победы нет", (sq) => {
    expect(kothWinner(kingOn(sq, "K"))).toBeNull();
  });
});

describe("Atomic: взрыв при взятии", () => {
  it("взятие рядом с королём убивает короля", () => {
    // Белые бьют на d7; король чёрных на e8 — в радиусе 3×3 от d7.
    const { blackKingDead, whiteKingDead } = applyExplosion("4k3/3r4/8/8/8/8/8/8 w - - 0 1", "d7");
    expect(blackKingDead).toBe(true);
    expect(whiteKingDead).toBe(false);
  });
  it("пешка рядом со взрывом ВЫЖИВАЕТ, а фигура в эпицентре исчезает", () => {
    // Взрыв на e4: конь в эпицентре гибнет, пешка на d5 (рядом) остаётся.
    const before = "8/8/8/3p4/4N3/8/8/8 w - - 0 1";
    const { fen } = applyExplosion(before, "e4");
    const placement = fen.split(" ")[0];
    expect(placement.includes("N"), "конь в эпицентре должен исчезнуть").toBe(false);
    expect(placement.includes("p"), "пешка рядом должна выжить").toBe(true);
  });
  it("пешка В ЭПИЦЕНТРЕ гибнет", () => {
    const { fen } = applyExplosion("8/8/8/8/4p3/8/8/8 w - - 0 1", "e4");
    expect(fen.split(" ")[0].includes("p")).toBe(false);
  });
});

describe("Twin Kings: проигрыш по потере королевского ферзя (по истории взятий)", () => {
  it("у белых забрали ферзя Q → белые проиграли", () => {
    expect(twinKingsLossSideByCaptures([], ["Q"])).toBe("w");
  });
  it("у чёрных забрали ферзя q → чёрные проиграли", () => {
    expect(twinKingsLossSideByCaptures(["q"], [])).toBe("b");
  });
  it("ферзи целы → проигравшего нет", () => {
    expect(twinKingsLossSideByCaptures(["p", "n"], ["P", "R"])).toBeNull();
  });
});

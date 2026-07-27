import { describe, it, expect } from "vitest";
import { spotTactics, explainMove, assessCenter } from "../chessCoachEngine";

/* Подсказка про вилку смотрела ходы СОПЕРНИКА: после хода конём очередь уже перешла, и
   условие «есть взятие ферзя или ладьи» означало, что соперник может забрать ТВОЮ
   фигуру. Коуч советовал ход, после которого снимают ферзя. */

describe("spotTactics", () => {
  /* Ладья d8 бьёт белого ферзя d1 после ЛЮБОГО хода конём — тут советовать нечего. */
  it("does not praise a knight move that hangs your own queen", () => {
    const hints = spotTactics("3r2k1/8/8/8/8/5N2/6PP/3Q2K1 w - - 0 1");
    expect(hints.filter((h) => h.includes("🐴"))).toEqual([]);
  });

  /* Конь с d5 идёт на c7 и бьёт разом короля e8 и ладью a8 — вот это вилка. */
  it("points at a knight move that really forks two heavy targets", () => {
    const hints = spotTactics("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1");
    expect(hints.some((h) => h.includes("🐴") && h.includes("Nc7"))).toBe(true);
  });

  it("puts mate in one first, above everything else", () => {
    const hints = spotTactics("6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1");
    expect(hints[0]).toContain("МАТ В 1");
  });
});

/* explainMove нигде не вызывается, но оценки в модуле бело-относительные: без поправки
   на сторону отличный ход чёрных получал вердикт «блундер», а зевок — «отличный ход». */
describe("explainMove", () => {
  const START_W = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const START_B = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";

  it("praises a white move that raises the white-relative score", () => {
    expect(explainMove(START_W, "Nf3", 0, 200)).toContain("Отличный ход");
  });

  it("praises a black move that lowers it — same thing from Black's side", () => {
    expect(explainMove(START_B, "Nf6", 0, -200)).toContain("Отличный ход");
  });

  it("calls a black blunder a blunder, not a brilliancy", () => {
    expect(explainMove(START_B, "g5", 0, 300)).toContain("Блундер");
  });
});

/* «Пешки в центре» проверялось по всей горизонтали: одинокая пешка на a4 давала фразу
   про центр. Центр — это d4/e4/d5/e5, о них текст и говорит. */
describe("assessCenter", () => {
  it("does not call a rook-file pawn a pawn in the centre", () => {
    expect(assessCenter("4k3/8/8/8/P7/8/8/4K3 w - - 0 1")).toBe("открытый центр");
    expect(assessCenter("4k3/8/8/7p/8/8/8/4K3 w - - 0 1")).toBe("открытый центр");
  });

  it("sees a pawn that really stands in the centre", () => {
    expect(assessCenter("4k3/8/8/8/4P3/8/8/4K3 w - - 0 1")).toContain("белые пешки в центре");
    expect(assessCenter("4k3/8/8/3p4/8/8/8/4K3 w - - 0 1")).toContain("чёрные пешки в центре");
  });

  it("names both sides when both are there", () => {
    const s = assessCenter("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    expect(s).toContain("белые");
    expect(s).toContain("чёрные");
  });
});

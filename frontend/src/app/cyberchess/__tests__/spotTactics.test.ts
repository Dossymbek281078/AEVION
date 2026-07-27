import { describe, it, expect } from "vitest";
import { spotTactics } from "../chessCoachEngine";

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

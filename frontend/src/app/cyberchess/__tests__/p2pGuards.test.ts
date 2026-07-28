import { describe, it, expect } from "vitest";
import { parseUciMove, safeOpponentName } from "../p2pGuards";

/* Сообщения по p2p приходят напрямую от второго игрока — он волен прислать что
   угодно. Тесты описывают ровно те подмены, которые работали до этих проверок. */

describe("разбор хода соперника", () => {
  it("нормальный ход разбирается", () => {
    expect(parseUciMove("e2e4")).toEqual({ from: "e2", to: "e4" });
  });

  it("превращение принимается только в четыре фигуры", () => {
    expect(parseUciMove("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(parseUciMove("e7e8k")).toBeNull();
    expect(parseUciMove("e7e8p")).toBeNull();
  });

  it("не-строка отвергается, а не роняет обработчик", () => {
    // раньше на этом значении сразу звался .slice()
    for (const junk of [null, undefined, 42, {}, [], true]) {
      expect(parseUciMove(junk)).toBeNull();
    }
  });

  it("клетки вне доски отвергаются", () => {
    for (const bad of ["e2e9", "i2e4", "e0e4", "zzzz", "e2", "e2e4qq", ""]) {
      expect(parseUciMove(bad)).toBeNull();
    }
  });

  it("ход в ту же клетку отвергается", () => {
    expect(parseUciMove("e2e2")).toBeNull();
  });
});

describe("имя соперника", () => {
  it("обычное имя проходит как есть", () => {
    expect(safeOpponentName("Пётр")).toBe("Пётр");
  });

  it("пустое и не-строка дают нейтральное имя", () => {
    for (const junk of ["", "   ", null, undefined, 42, {}]) {
      expect(safeOpponentName(junk)).toBe("Соперник");
    }
  });

  it("переводы строк и невидимые символы вырезаются", () => {
    expect(safeOpponentName("Пётр\nИв")).toBe("ПётрИв");
    expect(safeOpponentName("Пётр​Ив")).toBe("ПётрИв");
    expect(safeOpponentName("Пётр‮Ив")).toBe("ПётрИв");
  });

  it("длинное имя обрезается и не разносит вёрстку", () => {
    const out = safeOpponentName("я".repeat(200));
    expect(out.length).toBeLessThanOrEqual(25);
    expect(out.endsWith("…")).toBe(true);
  });

  it("имя из одних невидимых символов не проходит как пустое", () => {
    expect(safeOpponentName("​​​")).toBe("Соперник");
  });
});

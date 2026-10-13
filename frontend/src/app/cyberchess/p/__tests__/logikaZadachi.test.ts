import { describe, it, expect } from "vitest";
import { sozdatSostoyanie, shag, tseli, svoyaFigura, kletki, uciVHod } from "../logikaZadachi";

// мат в 1: белые, ладья e1 → e8
const МАТ_В_1 = { fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1", sol: ["e1e8"] };
// две пары ходов: белые ферзём шах, чёрные закрываются, белые матуют
const ДВА_ХОДА = { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4", sol: ["h5f7"] };
// превращение: белая пешка g7 → g8 ферзём ставит мат (король h8, белый король g6 защищает ферзя)
const ПРЕВРАЩЕНИЕ = { fen: "7k/6P1/6K1/8/8/8/8/8 w - - 0 1", sol: ["g7g8q"] };

describe("логика лёгкой задачи", () => {
  it("верный ход решает задачу из одного хода", () => {
    const s = sozdatSostoyanie(МАТ_В_1.fen, МАТ_В_1.sol);
    expect(s.storona).toBe("w");
    const r = shag(s, "e1", "e8");
    expect(r.vid).toBe("ok");
    if (r.vid === "ok") { expect(r.reshena).toBe(true); expect(r.otvet).toBeNull(); expect(r.sostoyanie.fen).toContain("4R1k1"); }
  });

  it("🔴 неверный ход не меняет позицию и не решает", () => {
    const s = sozdatSostoyanie(МАТ_В_1.fen, МАТ_В_1.sol);
    const r = shag(s, "e1", "e7");
    expect(r.vid).toBe("wrong");
    expect(r.sostoyanie.fen).toBe(s.fen);
    expect(r.sostoyanie.reshena).toBe(false);
  });

  it("мат другим ходом — тоже решение (цель задачи достигнута)", () => {
    const s = sozdatSostoyanie(ДВА_ХОДА.fen, ДВА_ХОДА.sol);
    const r = shag(s, "h5", "f7");
    expect(r.vid).toBe("ok");
    if (r.vid === "ok") expect(r.reshena).toBe(true);
  });

  it("превращение в решении подставляется из решения", () => {
    const s = sozdatSostoyanie(ПРЕВРАЩЕНИЕ.fen, ПРЕВРАЩЕНИЕ.sol);
    const r = shag(s, "g7", "g8");
    expect(r.vid).toBe("ok");
    if (r.vid === "ok") expect(r.reshena).toBe(true);
    expect(uciVHod("g7g8q")).toEqual({ from: "g7", to: "g8", promotion: "q" });
  });

  it("цели и своя фигура — по позиции и стороне игрока", () => {
    const s = sozdatSostoyanie(МАТ_В_1.fen, МАТ_В_1.sol);
    expect(tseli(s.fen, "e1")).toContain("e8");
    expect(svoyaFigura(s, "e1")).toBe(true);
    expect(svoyaFigura(s, "g8")).toBe(false);
    expect(tseli(s.fen, "g8")).toEqual([]);
  });

  it("доска: игрок снизу — для чёрных ряды и колонки перевёрнуты", () => {
    const б = kletki("4k3/8/8/8/8/8/8/4K3 b - - 0 1", "b");
    expect(б[0][0].sq).toBe("h1");
    expect(б[7][7].sq).toBe("a8");
    const в = kletki("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "w");
    expect(в[0][0].sq).toBe("a8");
    expect(в[7][4].p).toBe("wk");
  });
});

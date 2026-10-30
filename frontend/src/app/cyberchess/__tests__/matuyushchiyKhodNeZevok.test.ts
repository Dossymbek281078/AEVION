// Матующий ход — не «??» и не «поворотный момент −20.0».
// Замер Продаж на проде 30.10.2026, ловушка Легаля: 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4
// 4.Nc3 g6 5.Nxe5 Bxd1 6.Bxf7+ Ke7 7.Nd5# — «Ключевые моменты» пометили 7.Nd5#
// зевком. Причина: после мата позиция окончена, движок отвечал «mate 0» без cp,
// оценка становилась 0, и «мат в 1» → 0 выглядел потерей ста пешек; глубокий
// разбор вдобавок терял «score mate N» и брал только cp.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { classifyDrop } from "../moveQuality";

// Функции живут в page.tsx (храповик размера импортов не пускает новый код в moveQuality) —
// вынимаем их из исходника и гоняем как настоящие.
const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
function строка(начало: string): string {
  const i = SRC.indexOf(начало);
  if (i < 0) throw new Error(`в page.tsx нет «${начало}»`);
  return SRC.slice(i, SRC.indexOf("\n", i));
}
const MAT_CP = Number(строка("const MAT_CP=").replace("const MAT_CP=", "").replace(";", ""));
const matVCp = new Function(
  "MAT_CP",
  строка("const matVCp=").replace("const matVCp=", "return ").split(":number").join(""),
)(MAT_CP) as (m: number, c: number) => number;
const ocenkaKonca = new Function(
  "Chess",
  "MAT_CP",
  строка("const ocenkaKonca=").replace("const ocenkaKonca=", "return ").replace("(fen:string):{cp:number;mate:number}|null=>", "(fen)=>"),
)(Chess, MAT_CP) as (fen: string) => { cp: number; mate: number } | null;

function послеХодов(san: string[]): Chess {
  const c = new Chess();
  for (const m of san) c.move(m);
  return c;
}
const ЛЕГАЛЬ = ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7+", "Ke7", "Nd5#"];

describe("мат в оценке хода", () => {
  it("позиция после 7.Nd5# — мат, победа белых (+MAT_CP с точки зрения белых)", () => {
    const c = послеХодов(ЛЕГАЛЬ);
    expect(c.isCheckmate()).toBe(true);
    expect(ocenkaKonca(c.fen())).toEqual({ cp: MAT_CP, mate: 0 });
  });

  it("контроль: незаконченная позиция — оценку решает движок (null)", () => {
    expect(ocenkaKonca(послеХодов(ЛЕГАЛЬ.slice(0, -1)).fen())).toBeNull();
  });

  it("мат чёрным — победа чёрных (−MAT_CP)", () => {
    const c = послеХодов(["f3", "e5", "g4", "Qh4#"]);
    expect(ocenkaKonca(c.fen())).toEqual({ cp: -MAT_CP, mate: 0 });
  });

  it("мат в N переводится в сантипешки со знаком победителя", () => {
    expect(matVCp(1, 0)).toBe(MAT_CP - 1);
    expect(matVCp(-3, 0)).toBe(-MAT_CP + 3);
    expect(matVCp(0, 37)).toBe(37);
  });

  it("7.Nd5# после «мат в 1» — не зевок: падение для белых ≤ 0", () => {
    const до = matVCp(1, 0); // перед 7.Nd5# белые ставят мат в 1
    const после = ocenkaKonca(послеХодов(ЛЕГАЛЬ).fen())!.cp;
    const drop = до - после; // ходили белые: с их точки зрения
    const q = classifyDrop(drop, до, после, послеХодов(ЛЕГАЛЬ).fen());
    expect(q).not.toBe("blunder");
    expect(q).not.toBe("mistake");
  });

  it("сторож исходника: оба пути оценки в page.tsx спрашивают ocenkaKonca и переводят мат", () => {
    const src = SRC;
    expect(src.split("ocenkaKonca(fen)").length - 1).toBeGreaterThanOrEqual(2);
    expect(src).toContain("lastCp=matVCp(lastMate,c*sign)");
    expect(src).not.toContain("lastCp=c*sign;lastMate=m*sign");
  });
});

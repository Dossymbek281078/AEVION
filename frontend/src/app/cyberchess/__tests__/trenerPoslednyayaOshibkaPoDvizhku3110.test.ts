/**
 * Тренер CyberChess: «где моя последняя ошибка» считает движок, а не модель; при листании позиция и
 * история — одна точка; ответ тренера с разметкой не показывает звёздочки.
 *
 * Повод 31.10.2026 (находки Продаж, ловушка Легаля 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6 5.Nxe5 Bxd1):
 * тренер в 3 из 5 прогонов называл ошибкой «Kxf7», «Kd7», «Nxe5». Stockfish 18 lite (глубина 16) по
 * каждому ходу: 5.Nxe5 — лучший ход белых (потеря 0.04); у чёрных 4...g6 (−1.01) и 5...Bxd1?? (мат в 2).
 * Оценки ниже — из того прогона (с точки зрения белых), чтобы тест не зависел от движка.
 * Живая проверка тем же выводом через прод /api/coach/chat 31.10: чёрными 5/5, белыми 5/5 верно.
 *
 * КОНТРОЛЬ: на 2f217a909 модуля нет, а статические проверки page.tsx красные.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { poslednyayaOshibka, vyvodDlyaTrenera, dlyaStorony, type Otsenka } from "../poslednyayaOshibka";

const HIST = "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1".split(" ");
const g = new Chess();
const FENS = [g.fen()];
for (const m of HIST) { g.move(m); FENS.push(g.fen()); }

// Оценка позиции после i полуходов, с точки зрения белых (cp) — Stockfish 18 lite, глубина 16.
const CP = [35, 30, 33, 39, 50, 47, 66, 59, 163, 163];
function otsenkaIzZapisi(fen: string): Promise<Otsenka> {
  const i = FENS.indexOf(fen);
  if (i === 10) return Promise.resolve({ cp: 0, mate: 2, best: "c4f7" }); // после 5...Bxd1 — мат белых в 2
  if (i === 9) return Promise.resolve({ cp: 172, mate: 0, best: "d6e5" }); // до 5...Bxd1 лучшее — dxe5
  if (i < 0) throw new Error("позиции нет в записи");
  return Promise.resolve({ cp: CP[i], mate: 0 });
}

describe("последняя ошибка — по движку", () => {
  test("чёрными: 5...Bxd1??, мат в 2, лучше было dxe5 — а не Nxe5, Kxf7 или Kd7", async () => {
    const r = await poslednyayaOshibka(FENS, HIST, "b", otsenkaIzZapisi);
    expect(r.oshibka).toMatchObject({ ply: 9, nomer: "5...", san: "Bxd1", grubaya: true, dalMat: 2, luchshe: "dxe5" });
    const v = vyvodDlyaTrenera(r, "b");
    expect(v).toContain("5...Bxd1??");
    expect(v).toMatch(/мат в 2/);
    expect(v).not.toMatch(/Nxe5|Kxf7|Kd7/);
  });

  test("белыми: ошибок нет — 5.Nxe5 не ошибка", async () => {
    const r = await poslednyayaOshibka(FENS, HIST, "w", otsenkaIzZapisi);
    expect(r.oshibka).toBeNull();
    expect(r.provereno).toBe(5);
    expect(vyvodDlyaTrenera(r, "w")).toMatch(/ошибок нет/);
  });

  test("срок вышел — проверено 0 ходов: ни ошибки, ни «ошибок нет» не утверждаем", async () => {
    const r = await poslednyayaOshibka(FENS, HIST, "b", otsenkaIzZapisi, 12, 0);
    expect(r).toEqual({ oshibka: null, provereno: 0 });
    const v = vyvodDlyaTrenera(r, "b");
    expect(v).toMatch(/не успели/);
    expect(v).not.toMatch(/ошибок нет —/);
  });

  test("мат приводится к конечной оценке и знак стороны верен", () => {
    expect(dlyaStorony({ cp: 0, mate: 2 }, "w")).toBeGreaterThan(19);
    expect(dlyaStorony({ cp: 0, mate: 2 }, "b")).toBeLessThan(-19);
    expect(dlyaStorony({ cp: 150, mate: 0 }, "b")).toBe(-1.5);
  });
});

describe("страница: тренер получает одну точку партии, вывод движка и рисует разметку", () => {
  const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  const sendChat = SRC.slice(SRC.indexOf("const sendChat=async(question:string)=>"), SRC.indexOf("const SYSTEM=`Ты AEVION CyberChess Coach"));

  test("при листании позиция — fenHist[plyVid], история — hist.slice(0,plyVid)", () => {
    expect(sendChat.length, "блок sendChat не найден").toBeGreaterThan(500);
    expect(sendChat).toContain("const plyVid=browseIdx<0?hist.length:Math.min(browseIdx,hist.length);");
    expect(sendChat).toContain("const histVid=hist.slice(0,plyVid);");
    expect(sendChat).toContain("const fen=fenHist[plyVid]??game.fen();");
    expect(sendChat).not.toMatch(/const recent=hist\.slice/);
    expect(sendChat).toContain("const legalSan=pozVid.moves();");
  });

  test("вывод движка добавляется в контекст, модуль грузится лениво", () => {
    expect(sendChat).toContain('await import("./poslednyayaOshibka")');
    expect(SRC).not.toMatch(/^import [^;]*from "\.\/poslednyayaOshibka";/m);
    expect(SRC).toContain("${vyvodDvizhka?`\\n${vyvodDvizhka}`:\"\"}");
    expect(SRC).toMatch(/Если в контексте есть «ВЫВОД ДВИЖКА»/);
  });

  test("ответы соперника на лучший ход даёт chess.js (не модель)", () => {
    expect(sendChat).toContain("у соперника легальны только");
  });

  test("ответ тренера рисуется разметкой, а не текстом со звёздочками", () => {
    expect(SRC).toContain("{m.role===\"user\"?m.content:razmetkaTrenera(m.content)}");
    expect(SRC).toMatch(/function razmetkaTrenera\(t:string\)/);
  });
});

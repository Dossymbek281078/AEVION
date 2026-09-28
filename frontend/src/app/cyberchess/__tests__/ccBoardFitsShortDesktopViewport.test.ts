// Низ под доской (буквы, строка «Вы», кнопки) обязан быть виден на низком десктопном экране.
// Замер 22.09.2026 на проде, 1366×768: верх доски 319px, доска до 803px, «Новая партия» на 887,
// «Сдаться» на 984 — при overflow:hidden колонки недостижимы (слово основателя: «низ под доской
// вообще не виден и туда стрелкой не приведёшь»).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("доска помещается на низком десктопном экране", () => {
  it("верх доски измеряется, бюджет высоты = верх + 150px под доской", () => {
    expect(src).toContain('const el=document.querySelector("[data-cc-board]");');
    expect(src).toContain("const desktopVReserve=Math.max(250,boardTopPx>0?boardTopPx+(lowDesktop?186:150):0);");
    expect(src).toContain('vhPx-(vwPx>=769?desktopVReserve:290)');
    expect(src).toContain('data-cc-board="1"');
  });
  it("колонка доски прокручивается на десктопе (запас), на телефоне как была", () => {
    expect(src).toContain('data-cc-board-col="1" style={{flex:"0 1 auto",minWidth:0,minHeight:0,display:"flex",flexDirection:"column",alignItems:"center",overflowY:isMobileLayout?"visible":"auto"}}');
  });
  it("быстрая панель не рисуется на низком десктопе, на телефоне остаётся", () => {
    expect(src).toContain('{!streamerMode&&!setup&&on&&tab==="play"&&(vwPx<769||vhPx>=820)&&(');
  });
  it("контроль: измерение не зависит от размера доски (нет петли)", () => {
    const i = src.indexOf("const measure=()=>{");
    expect(src.slice(i, i + 400)).not.toContain("boardPx");
  });
});

describe("ряды кнопок под доской на низком десктопе", () => {
  it("оба ряда идут одной строкой с боковой прокруткой, запас 186px", () => {
    expect(src).toContain("const lowDesktop=vwPx>=769&&vhPx<860;");
    expect(src).toContain('?{flexWrap:"nowrap",overflowX:"auto",scrollbarWidth:"none"}');
    expect(src).toContain("boardTopPx+(lowDesktop?186:150)");
    expect(src.match(/\.\.\.podDoskoyRow\}\}>/g)?.length).toBe(2);
  });
  it("контроль: на обычном десктопе и телефоне ряды по-прежнему переносятся", () => {
    expect(src).toContain(':{flexWrap:"wrap",overflowX:"visible"}');
  });
});

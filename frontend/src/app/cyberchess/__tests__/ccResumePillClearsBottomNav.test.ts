// Пилюля «Вернуться к партии» не должна ложиться ни на нав, ни на доску, ни на ряд ввода ходов.
// История формы: 15.09.2026 — fixed bottom:88 на телефоне (над BottomNav) и fixed top:156 на
// десктопе. 18.09.2026 тестер (настоящая партия кликами, 390px, Коуч) показал, что fixed внизу
// на телефоне ВСЁ РАВНО ложится на доску: «c»/«d» × «Вернуться к партии» — 100% наложения.
// Любой fixed-элемент на телефоне накрывает либо доску, либо нав. Поэтому на телефоне пилюля
// теперь СТРОКА В ПОТОКЕ внутри sticky-шапки (flex:1 1 100%): она сдвигает контент вниз и
// накрывать ей нечего по построению. Fixed top:156 остался только для десктопа (≥769).
// Сторож ИСХОДНИКА (форма); что наложений нет — тестером (tester-overlaps).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const COND = 'on&&!over&&tab!=="play"&&!isHumanGame';

describe("пилюля «Вернуться к партии»: строка шапки на телефоне, fixed top под шапкой на десктопе", () => {
  it("телефон: кнопка В ПОТОКЕ (flex:1 1 100%), условие пилюли + vwPx<769", () => {
    const i = src.indexOf(`{${COND}&&vwPx<769&&<button onClick={()=>sTab("play")}`);
    expect(i, "мобильная строка-пилюля не найдена").toBeGreaterThan(0);
    const block = src.slice(i, i + 900);
    expect(block).toContain('flex:"1 1 100%"');
    expect(block).not.toContain('position:"fixed"');
    expect(block).toContain("Вернуться к партии");
  });
  it("мобильная строка лежит ВНУТРИ sticky-шапки (между её открытием и закрытием)", () => {
    const hdr = src.indexOf('position:"sticky",top:0,zIndex:Z.sticky,');
    const pill = src.indexOf(`{${COND}&&vwPx<769&&<button`);
    expect(hdr).toBeGreaterThan(0);
    expect(pill).toBeGreaterThan(hdr);
    // до мобильной пилюли шапка ещё не закрыта: между ними нет строки-закрытия шапки «      </div>}\n\n» перед скроллером
    expect(src.slice(hdr, pill)).not.toContain("{/* Resume offer banner */}");
  });
  it("десктоп: fixed top:156 по центру, только при vwPx>=769", () => {
    const i = src.indexOf(`{${COND}&&vwPx>=769&&<button onClick={()=>sTab("play")}`);
    expect(i, "десктопная fixed-пилюля не найдена").toBeGreaterThan(0);
    const block = src.slice(i, i + 3000);
    expect(block).toMatch(/position:"fixed",top:(\d+),left:"50%",transform:"translateX\(-50%\)"/);
    expect(Number(block.match(/position:"fixed",top:(\d+)/)![1])).toBeGreaterThanOrEqual(120);
  });
  it("прежние формы не вернулись: bottom на телефоне, безусловная fixed-пилюля", () => {
    expect(src).not.toMatch(/\.\.\.\(vwPx<769\?\{bottom:\d+\}:\{top:\d+\}\)/);
    const d = src.indexOf(`{${COND}&&vwPx>=769&&<button`);
    // только собственный блок пилюли: следом в файле есть ДРУГИЕ fixed-элементы с bottom
    const e = src.indexOf("</button>}", d);
    expect(src.slice(d, e)).not.toMatch(/position:"fixed",bottom:\d+/);
    expect(src).not.toContain(`{${COND}&&<button onClick={()=>sTab("play")}`);
  });
});

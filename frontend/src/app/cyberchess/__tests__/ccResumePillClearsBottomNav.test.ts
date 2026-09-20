// «Вернуться к партии» не должна ложиться ни на нав, ни на доску, ни на ряд ввода ходов.
// История: 15.09.2026 — fixed bottom:88 (телефон) / fixed top:156 (десктоп). 18.09 тестер
// (настоящая партия кликами) показал: на 390 fixed-пилюля лежала на буквах доски «c»/«d»
// (100 %), на 1920 при прокрутке «Анализа» fixed top:156 ложилась на 8-ю горизонталь.
// Любой fixed-элемент рано или поздно накрывает доску. Поэтому с 19.09.2026 пилюля — кнопка
// В ПОТОКЕ внутри sticky-шапки на ЛЮБОЙ ширине (телефон: своя строка flex 1 1 100%; десктоп:
// inline в ряду шапки). Fixed-пилюли нет нигде. Сторож ИСХОДНИКА; наложения — тестером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const COND = 'on&&!over&&tab!=="play"&&!isHumanGame';

describe("«Вернуться к партии» — только в потоке шапки, без fixed", () => {
  it("кнопка в шапке: условие пилюли без порога ширины, flex по ширине, не fixed", () => {
    const i = src.indexOf(`{${COND}&&<button onClick={()=>sTab("play")}`);
    expect(i, "кнопка в шапке не найдена").toBeGreaterThan(0);
    const block = src.slice(i, src.indexOf("</button>}", i));
    expect(block).toContain('flex:vwPx<769?"1 1 100%":"0 0 auto"');
    expect(block).not.toContain('position:"fixed"');
    expect(block).toContain("Вернуться к партии");
  });
  it("кнопка лежит ВНУТРИ sticky-шапки (после её открытия, до баннера незавершённой партии)", () => {
    const hdr = src.indexOf('position:"sticky",top:0,zIndex:Z.sticky,');
    const pill = src.indexOf(`{${COND}&&<button`);
    expect(hdr).toBeGreaterThan(0);
    expect(pill).toBeGreaterThan(hdr);
    expect(src.slice(hdr, pill)).not.toContain("{/* Resume offer banner */}");
  });
  it("fixed-пилюли нет ни на одной ширине; ровно одна кнопка «Вернуться к партии» с sTab", () => {
    expect(src).not.toMatch(/position:"fixed",top:\d+,left:"50%"/);
    expect(src).not.toMatch(/\.\.\.\(vwPx<769\?\{bottom:\d+\}:\{top:\d+\}\)/);
    expect(src).not.toContain(`{${COND}&&vwPx>=769&&<button`);
    expect(src).not.toContain(`{${COND}&&vwPx<769&&<button`);
    const n = src.split(`{${COND}&&<button onClick={()=>sTab("play")}`).length - 1;
    expect(n).toBe(1);
  });
  it("плавающей пилюли «горячие клавиши» нет (накрывала «Войти» в панели анализа варианта)", () => {
    expect(src).not.toContain('title="Показать горячие клавиши"');
  });
  it("мобильная шапка компактна: «Все разделы», «Помощь», «Войти», рейтинг/Chessy — только с 769", () => {
    expect(src).toContain('{vwPx>=769&&<button onClick={()=>sShowSections(true)}');
    expect(src).toContain('{vwPx>=769&&ccAuth.checked&&(');
    expect(src).toContain('{vwPx>=769&&<div className="cc-hzone"');
    // …а убранное не пропало: на телефоне оно в меню «Ещё»
    expect(src).toContain('lbl:"Войти в аккаунт AEVION",act:()=>{window.location.href="/auth?next=/cyberchess"}');
    expect(src).toContain("lbl:`Рейтинг ${rat} · Chessy ${chessy.balance}`,act:()=>sShowStatsDashboard(true)");
    expect(src).toContain('lbl:"Все разделы",act:()=>sShowSections(true)');
    // одна строка на 390: отступ справа под плавающую «RU ▼», текст логотипа clip, звук только ≥769
    expect(src).toContain('padding:vwPx<769?"10px 100px 10px 12px":"10px 12px"');
    expect(src).toContain('clip:"rect(0 0 0 0)"');
    expect(src).toContain('{vwPx>=769&&<Btn variant={muted?"danger":"secondary"}');
  });
});

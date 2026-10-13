import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Волна 136 (13–14.10.2026), слово основателя: «доска очень маленькая и не увеличивается… панель
 * справа огромная». Замер на проде 1463×724: доска 296 px (41 % vh), шапка в две строки 126 px, карточка
 * «С чего начать» над доской, левый рейл + панель до 530 px. Образец lichess: доска 76 % vh, шапка 64.
 * Сторож пинит правила монолита: резервы, рейл выключен, панель 380 (под доской на 769–1279), шапка в
 * одну строку, карточка вне колонки доски, ряды под доской без горизонтальной прокрутки. Живая приёмка —
 * 01-CyberChess/2026-10-14-ДОСКА/priemka-doski.mjs (доли окна, 7 пар).
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("доска во всю доступную высоту (136)", () => {
  it("🔴 резервы: шапка+полоска+под доской, без 150–186 px и без max(250)", () => {
    expect(src).toContain("const vReserve=vwPx>=769?190:300;");
    expect(src).toContain("const подДоской136=зашёлЗаЗадачей?36:52;");
    expect(src).toContain("const desktopVReserve=(boardTopPx>0?boardTopPx:110)+подДоской136+8;");
    expect(src).not.toContain("const desktopVReserve=Math.max(250,");
  });
  it("🔴 левый рейл выключен, панель 380, на 769–1279 панель под доской", () => {
    expect(src).toContain("const railShown=false&&vwPx>=1100");
    expect(src).toContain("const ПАНЕЛЬ_W_136=380;");
    expect(src).toContain("const панельРядом=vwPx>=1280;");
    expect(src).toContain("const rightPanelMax=ПАНЕЛЬ_W_136;");
    expect(src).toContain("(панельРядом?ПАНЕЛЬ_W_136+24:48)");
    expect(src).toContain('flexWrap:vwPx>=769&&!панельРядом?"wrap":"nowrap"');
    expect(src).toContain('width:vwPx>=769&&!панельРядом?"100%":rightPanelMax');
  });
  it("🔴 шапка в одну строку: nowrap на ≥1024 и на телефоне, второстепенное только с 1700", () => {
    expect(src).toContain('flexWrap:vwPx>=1024||vwPx<769?"nowrap":"wrap"');
    expect(src).toContain("{!isMobileLayout&&vwPx>=1700&&<button onClick={()=>sPalOpen(true)}");
    expect(src).toContain("{vwPx>=1700&&<button onClick={()=>sShowSections(true)}");
    expect(src).toContain("{vwPx>=1700&&!шапкаКомпактна&&<div className=\"cc-hzone\"");
    expect(src).toContain("{(vwPx>=1500||active)&&<span>{t.label}</span>}");
    expect(src).toContain('padding:vwPx<769?"3px 72px 3px 12px":"6px 12px"');
  });
  it("🔴 карточка «С чего начать» — не в колонке над доской: телефон под доской, десктоп в панели", () => {
    const колонка = src.indexOf('data-cc-board-col="1"');
    const доска = src.indexOf('data-cc-board="1"');
    expect(src.slice(колонка, доска)).not.toContain("полоскаСтарта(bw)");
    expect(src).toContain("{isMobileLayout&&полоскаСтарта(bw)}");
    expect(src).toContain('{!isMobileLayout&&полоскаСтарта("100%")}');
    expect(src.indexOf("{isMobileLayout&&полоскаСтарта(bw)}")).toBeGreaterThan(доска);
  });
  it("🔴 первый экран (настройка): превью по высоте окна, лобби колонкой справа с 1280, масштаб −/+ под превью, карточка после доски", () => {
    expect(src).toContain("const лоббиРядом=vwPx>=1280;");
    expect(src).toContain("const превьюPx=Math.round((isMobileLayout?vwPx-20:Math.max(360,Math.min(vhPx-(лоббиРядом?190:230),vwPx-(лоббиРядом?420+48:48)-dockReserve)))*Math.max(0.6,Math.min(1,boardScale)));");
    expect(src).toContain('maxPx={превьюPx}');
    expect(src).toContain('data-cc-setup-zoom="1"');
    expect(src).toContain("gridTemplateColumns:`minmax(0,auto) minmax(${320}px,${420}px)`");
    const превью = src.indexOf("<SetupBoardPreview");
    expect(src.slice(превью - 600, превью)).not.toContain("полоскаСтарта(");
    expect(src.indexOf('{полоскаСтарта("100%")}', превью) - превью).toBeLessThan(2600);
  });
  it("🔴 над игровой доской нет дублей: быстрая панель только на телефоне, ряд премувов переносится", () => {
    expect(src).toContain('{!streamerMode&&!setup&&on&&tab==="play"&&vwPx<769&&(');
    expect(src).toContain('<div style={{display:"flex",alignItems:"center",gap:SPACE[2],flexWrap:"wrap"}}>{/* 136: ряд переносится');
    expect(src).toContain("const mobileGutter=20;");
  });
  it("ряды под доской переносятся — горизонтальной прокрутки нет", () => {
    expect(src).toContain('const podDoskoyRow:React.CSSProperties={flexWrap:"wrap",overflowX:"visible"};');
    expect(src).not.toContain('{flexWrap:"nowrap",overflowX:"auto",scrollbarWidth:"none"}');
  });
});

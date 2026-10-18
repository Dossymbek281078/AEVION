import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Волна 139 (14.10.2026). Замер на проде 592555ad6, 1463×724, партия: верх доски 120, а доска 478 px
 * (66 % vh; порог приёмки 0,72·vh = 521, образец lichess 76 %). Две причины, обе арифметические:
 *  (а) предкап vhPx−190 = 534 резал бюджет РАНЬШЕ измеренного (120 + 52 + 8 = 180 → 544);
 *  (б) ряд [eval-бар 32+4 | цифры 16+4 | доска flex:1] был шириной bw — доска получала bw − 56
 *      (514 без eval-бара, 478 с ним; на телефоне 390 — 350 вместо 370).
 * Правило: сторона доски задаётся явно из бюджета высоты; ряд шире её на обвязку; на телефоне обвязки
 * нет (цифры рангов внутри клеток, оценка — полоска поверх края доски); строка игрока на низком окне 40 px.
 * Живая приёмка — 01-CyberChess/2026-10-14-ДОСКА/priemka-doski.mjs на /cyberchess и ?puzzle=.
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const clock = readFileSync(join(__dirname, "..", "TurnClock.tsx"), "utf8");
const раз = (s: string, образец: string) => s.split(образец).length - 1;

describe("доска берёт весь измеренный бюджет высоты (139)", () => {
  it("🔴 предкап и бюджет — одно число из замера верха; под доской буквы + строка игрока", () => {
    expect(src).toContain("const строкаИгрокаPx=vhPx<800?40:48;");
    expect(src).toContain("const подДоской139=зашёлЗаЗадачей?36:(рядМасштабаВПанели?0:26)+строкаИгрокаPx;"); // 140б: ряд в панели — 26 доске
    expect(src).toContain("const desktopVReserve=(boardTopPx>0?boardTopPx:110)+подДоской139+8;");
    expect(src).toContain("const vReserve=vwPx>=769?desktopVReserve:(boardTopPx>0?boardTopPx:157)+ПОД_ДОСКОЙ_ТЕЛЕФОН;"); // 143г: телефон тоже от замера
    expect(src).not.toContain("const vReserve=vwPx>=769?190:300;");
    // замер верха объявлен ДО предкапа — иначе TDZ, и tsc бы не пропустил; пин держит порядок
    expect(src.indexOf("const[boardTopPx,sBoardTopPx]=useState(0);")).toBeLessThan(src.indexOf("const vReserve="));
  });
  it("🔴 сторона доски явная, ряд шире на обвязку, обвязка вычтена из бюджета ширины дважды", () => {
    expect(src).toContain('style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:"0 0 auto",width:boardPx,aspectRatio:"1",');
    expect(src).not.toContain('gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",');
    expect(src).toContain('const bw=(boardPx+обвязкаДоскиPx)+"px";');
    expect(src).toContain("const обвязкаДоскиPx=isMobileLayout?0:20+(evalБарВиден?36:0);");
    expect(раз(src, "vwPx-hReserve-dockReserve-обвязкаДоскиPx)")).toBe(2);
    // строки под доской равняются по обвязке, а не по константе 23
    expect(раз(src, "paddingLeft:обвязкаДоскиPx+3")).toBe(3);
    expect(src).not.toContain("paddingLeft:23,");
  });
  it("🔴 телефон: цифры рангов внутри клеток, колонка цифр не рисуется, оценка — полоска поверх края", () => {
    expect(src).toContain('{isMobileLayout&&<div aria-hidden="true" data-cc-ranks-inside="1"');
    expect(src).toContain('{!isMobileLayout&&<div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:6,paddingLeft:2,width:16}}>');
    expect(src).toContain('if(isMobileLayout)return(<div className="cc-eval-bar" title={label}');
    expect(src).toContain('<div translate="no" style={{display:"flex",width:bw,gap:4,position:"relative"}}>');
  });
  it("строка игрока: часы 36 на низком окне (size={строкаИгрокаPx-4}), TurnClock принимает size; строка человека тоже 40", () => {
    expect(src).toContain("size={строкаИгрокаPx-4}/>");
    expect(clock).toContain("size?: number;");
    expect(clock).toContain("const size = sizeProp ?? 44;");
    expect(clock).toContain("fontSize: size < 44 ? 11 : secs < 60 ? 13 : 12,");
    // нижняя строка (свой игрок) рисуется другим блоком: поля 3 и часы 16 px на низком окне — иначе «Вы» 48 px
    // уходит за низ окна на 2 px при доске 538 (замер 14.10, 1463×724)
    expect(src).toContain('padding:vhPx<800?"3px 0":"5px 0",marginTop:2,gap:8,');
    expect(src).toContain("fontSize:vhPx<800?16:20,fontWeight:900,");
    expect(src).toContain('padding:vhPx<800?"2px 8px":"4px 10px",borderRadius:6,');
  });
  it("🔴 экран задачи: баннер «Проекты» и его резерв 244 px не рисуются (на 1463×724 они сжимали колонку доски до 511)", () => {
    const условие = 'showProjectsBanner&&!streamerMode&&!on&&!pzCurrent&&!зашёлЗаЗадачей&&tab!=="puzzles"&&!scratchOn&&!anyOnboardingModal&&vwPx>=1100';
    expect(раз(src, условие)).toBe(3); // переменная резерва, paddingRight ряда, сам баннер
    expect(src).not.toContain("!pzCurrent&&!scratchOn&&!anyOnboardingModal&&vwPx>=1100");
  });
});

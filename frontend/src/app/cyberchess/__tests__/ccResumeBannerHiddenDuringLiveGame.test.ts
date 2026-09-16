// Баннер «Незавершённая партия · ▶ Продолжить» не должен жить поверх ЖИВОЙ партии.
// Обход 15.09.2026 (десктоп, Коуч): игрок начал новую партию, баннер со старым снимком
// остался; автосейв уже перезаписал снимок новой партией, а «Продолжить» брал старую
// партию из state и ставил её поверх текущей — текущая терялась без предупреждения.
// Починка — эффект: любая живая партия (on && !over) гасит resumeOffer; одно место
// покрывает все входы (шторка, турнир, партия с человеком).
// Сторож ИСХОДНИКА (форма). Что баннер реально исчезает — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("баннер «Незавершённая партия» гаснет при живой партии", () => {
  it("эффект: on && !over → sResumeOffer(null), зависимости [on,over]", () => {
    expect(src).toContain("useEffect(()=>{if(on&&!over)sResumeOffer(null)},[on,over]);");
  });
  it("якорь: баннер по-прежнему рендерится по resumeOffer, а «Продолжить» зовёт resumeGame", () => {
    expect(src).toContain("{resumeOffer&&(()=>{");
    expect(src).toContain("onClick={()=>resumeGame(s)}");
  });
  it("якорь: автосейв перезаписывает снимок при живой партии — потому баннер и обязан гаснуть", () => {
    expect(src).toContain('if(tab!=="play"||!on||over||setup||hist.length===0)return;');
  });
});

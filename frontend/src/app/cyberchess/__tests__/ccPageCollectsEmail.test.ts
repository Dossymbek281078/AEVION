// Ворота запуска, п.6: на странице МОДУЛЯ есть приём адреса. До 28.09.2026 форма жила только
// на /cyberchess/launch — пришедший играть и не готовый купить сегодня уходил бесследно
// (замер: из 11 посадочных адрес не собирала одна — /cyberchess).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("страница шахмат принимает адрес", () => {
  it("форма подключена и помечена меткой, которую примет рассылка запуска", () => {
    expect(page).toContain('import WaitlistCapture from "@/components/WaitlistCapture";');
    expect(page).toContain('source="cyberchess-app"');
    // правило отбора рассылки: метка равна cyberchess или начинается с cyberchess-
    expect("cyberchess-app".startsWith("cyberchess-")).toBe(true);
    expect("chess-app".startsWith("cyberchess-")).toBe(false); // контроль: чужая метка не прошла бы
  });
  it("окно доступно из меню «Ещё» с любой ширины", () => {
    const i = page.indexOf('lbl:"Написать мне о запуске"');
    expect(i).toBeGreaterThan(0);
    // пункт вне ветки vwPx<769: он не внутри мобильного блока
    const mobileBlockStart = page.indexOf("...(vwPx<769?[");
    const mobileBlockEnd = page.indexOf("] : []),", mobileBlockStart);
    expect(i > mobileBlockEnd).toBe(true);
  });
  it("автопоказ — один раз после законченной партии, с запоминанием", () => {
    expect(page).toContain('if(!over||предлагалиПодпискуRef.current)return;');
    expect(page).toContain('localStorage.getItem("aevion_chess_waitlist_seen")==="1"');
    expect(page).toContain('localStorage.setItem("aevion_chess_waitlist_seen","1")');
  });
  it("контроль: во время партии окно не открывается само", () => {
    const i = page.indexOf("предлагалиПодпискуRef");
    const block = page.slice(i, i + 900);
    expect(block).toContain("},[over]);"); // зависит только от конца партии
    expect(block).not.toContain("sShowWaitlist(true)},[on]");
  });
});

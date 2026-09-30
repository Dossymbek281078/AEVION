// Ворота запуска, п.6: на странице МОДУЛЯ есть приём адреса. До 28.09.2026 форма жила только
// на /cyberchess/launch — пришедший играть и не готовый купить сегодня уходил бесследно
// (замер: из 11 посадочных адрес не собирала одна — /cyberchess).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { уженеПредлагать } from "../page";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

/** Снять комментарии: иначе объяснение ПРО код считается кодом, а длинный
 *  комментарий внутри блока выталкивает нужную строку за окно поиска. */
function безКомментариев(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const два = src.slice(i, i + 2);
    if (два === "/*") { const к = src.indexOf("*/", i + 2); i = к < 0 ? src.length : к + 2; continue; }
    if (два === "//" && src[i - 1] !== ":") { const к = src.indexOf(String.fromCharCode(10), i); i = к < 0 ? src.length : к; continue; }
    out += src[i]; i += 1;
  }
  return out;
}
const кодСтраницы = безКомментариев(page);

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
    expect(кодСтраницы).toContain('if(!over||предлагалиПодпискуRef.current)return;');
    expect(кодСтраницы).toContain('localStorage.setItem("aevion_chess_waitlist_seen","1")');
    // 🔴 ПЕРЕНАЦЕЛЕНО 30.09.2026. Здесь ждали дословного
    // `localStorage.getItem(...)==="1"`. Чтение переехало в помощник
    // `уженеПредлагать`, и сторож покраснел на ВЕРНОЙ правке: она чинила
    // приватное окно, где localStorage бросает. Теперь спрашиваем поведение.
    expect(кодСтраницы).toContain("если (уженеПредлагать())".replace("если ", "if "));
  });

  it("🔴 хранилище недоступно — адрес всё равно предлагаем", () => {
    // Ради этого правка и делалась. Раньше отказ хранилища значил «не
    // показывать НИКОГДА»: в приватном окне и во встроенных браузерах
    // соцсетей форма не появлялась совсем, а выглядело это как «человек не
    // захотел». Оттуда идёт наш главный поток — Instagram, 347 визитов за
    // 14 дней. Падать надо в сторону работы: хуже предложить дважды, чем
    // потерять адрес.
    const бросает = { getItem() { throw new Error("private mode"); } };
    expect(уженеПредлагать(бросает)).toBe(false);
  });

  it("контроль: отметка прочитана — второй раз не предлагаем", () => {
    expect(уженеПредлагать({ getItem: () => "1" })).toBe(true);
    expect(уженеПредлагать({ getItem: () => null })).toBe(false);
  });
  it("контроль: во время партии окно не открывается само", () => {
    // 🔴 ПЕРЕНАЦЕЛЕНО 30.09.2026. Проверка брала окно в 900 знаков от первого
    // упоминания ссылки. Правка добавила внутрь блока объяснение на десять
    // строк — и `},[over]);` уехал за край окна. Тест покраснел не на смысле,
    // а на длине КОММЕНТАРИЯ. Теперь комментарии сняты, а границей служит сам
    // конец эффекта, а не счёт знаков.
    const i = кодСтраницы.indexOf("предлагалиПодпискуRef");
    expect(i).toBeGreaterThan(0);
    const конец = кодСтраницы.indexOf("},[", i);
    const эффект = кодСтраницы.slice(i, конец + 12);
    expect(эффект, "автопоказ зависит не только от конца партии").toContain("},[over]);");
    expect(эффект).not.toContain("sShowWaitlist(true)},[on]");
  });
});

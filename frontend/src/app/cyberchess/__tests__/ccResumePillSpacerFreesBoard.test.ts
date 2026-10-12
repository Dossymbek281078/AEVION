// История: пилюля «Вернуться к партии» была position:fixed и на телефоне накрывала низ доски;
// 15.09.2026 под неё добавили paddingBottom:152 у контейнера прокрутки. 18.09.2026 fixed-пилюли
// на телефоне НЕТ (строка в потоке шапки, см. ccResumePillClearsBottomNav) — отступ стал бы
// пустой полосой в 152px под контентом Задач/Коуча. Сторож закрепляет, что отступ УБРАН и
// холостой спейсер снаружи не вернулся.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("отступа под fixed-пилюлю на телефоне больше нет", () => {
  it("скроллер контента без paddingBottom с условием пилюли", () => {
    // 12.10.2026: условие пилюли переехало в pokazatVozvratVPartiyu, и дословный
    // образец перестал бы ловить возврат отступа, оставаясь ЗЕЛЁНЫМ. Образец
    // теперь привязан к самому отступу, а не к написанию условия; ниже — контроль,
    // что он ловит обе формы (иначе сторож молча охраняет пустоту).
    const ОБРАЗЕЦ = /paddingBottom:\(.{0,220}?vwPx<769\)\?\d+:0/s;
    expect('paddingBottom:(on&&!over&&tab!=="play"&&!isHumanGame&&vwPx<769)?152:0', "контроль: старое написание ловится").toMatch(ОБРАЗЕЦ);
    expect('paddingBottom:(pokazatVozvratVPartiyu({идётПартия:on,конецПартии:!!over,вкладка:tab,партияСЧеловеком:!!isHumanGame,задачаНаДоске:!!pzCurrent})&&vwPx<769)?152:0', "контроль: новое написание ловится").toMatch(ОБРАЗЕЦ);
    expect("paddingBottom:0", "отрицательный контроль: безусловный отступ не считается").not.toMatch(ОБРАЗЕЦ);
    expect(src).not.toMatch(ОБРАЗЕЦ);
    expect(src).toMatch(/overflowY:"auto",marginBottom:16,[^\n]*marginInline:"auto"\}\}/);
  });
  it("холостой спейсер ПОСЛЕ </ProductPageShell> не вернулся", () => {
    expect(src).not.toMatch(/vwPx<769&&<div aria-hidden style=\{\{height:\d+\}\}\/>/);
  });
});

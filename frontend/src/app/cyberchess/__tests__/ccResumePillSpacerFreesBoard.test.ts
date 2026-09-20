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
    expect(src).not.toMatch(/paddingBottom:\(on&&!over&&tab!=="play"&&!isHumanGame&&vwPx<769\)\?\d+:0/);
    expect(src).toMatch(/overflowY:"auto",marginBottom:16,[^\n]*marginInline:"auto"\}\}/);
  });
  it("холостой спейсер ПОСЛЕ </ProductPageShell> не вернулся", () => {
    expect(src).not.toMatch(/vwPx<769&&<div aria-hidden style=\{\{height:\d+\}\}\/>/);
  });
});

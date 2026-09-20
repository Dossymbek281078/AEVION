// Буквы a–h под доской на телефоне занимают всю ширину доски и стоят под своими вертикалями.
// Тестер 20.09.2026 (скрин 390): в одном ряду с палитрой тем (8 кружков) и масштабом «− 100% +»
// сетке букв оставалось ~70px, и «ABCDEFGH» слипалось у левого края — буквы не соответствовали
// вертикалям. На <769 палитра/масштаб переносятся на вторую строку, сетка букв — flex 1 1 100%.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("ряд букв a–h под доской на телефоне", () => {
  it("контейнер переносит строки на <769, сетка букв — на всю ширину", () => {
    expect(src).toContain('paddingLeft:23,width:bw,gap:4,flexWrap:vwPx<769?"wrap":"nowrap"}}>');
    expect(src).toContain('gridTemplateColumns:"repeat(8,1fr)",flex:vwPx<769?"1 1 100%":1,marginTop:4}}>');
  });
  it("прежняя форма (одна строка на любой ширине) не вернулась", () => {
    expect(src).not.toContain('paddingLeft:23,width:bw,gap:4}}>');
  });
});

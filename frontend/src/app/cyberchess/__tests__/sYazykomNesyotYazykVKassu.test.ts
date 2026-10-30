// Ссылка «купить» из CyberChess несёт язык посетителя на /pricing.
// Замер прода 30.10.2026: с /kk/cyberchess кнопка «$50» открывала русские цены.
// Функция живёт inline в page.tsx (отдельный модуль рвал храповик размера импортов
// на 288 байт — запас там был меньше любого нового файла); здесь её вынимаем из
// исходника и гоняем как чистую функцию.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const m = src.match(/const sYazykom=\(href:string,locale:string\)=>\{(.*?)\};\n/);
const sYazykom: (href: string, locale: string) => string = m
  ? (new Function("href", "locale", m[1]) as (h: string, l: string) => string)
  : () => { throw new Error("sYazykom в page.tsx не найдена"); };

const БАЗА = "/pricing?app=cyberchess&c=yt#apps";

describe("sYazykom: язык в ссылке на цены", () => {
  it("функция найдена в page.tsx и подключена к ccBuyHref", () => {
    expect(m).toBeTruthy();
    expect(src).toContain("sCcBuyHref(sYazykom(keepChannel(");
  });
  it("kk → ?lang=kk, метка и якорь на месте", () => {
    expect(sYazykom(БАЗА, "kk")).toBe("/pricing?app=cyberchess&c=yt&lang=kk#apps");
  });
  it("en → ?lang=en", () => {
    expect(sYazykom(БАЗА, "en")).toBe("/pricing?app=cyberchess&c=yt&lang=en#apps");
  });
  it("ru — без параметра (умолчание страницы цен)", () => {
    expect(sYazykom(БАЗА, "ru")).toBe(БАЗА);
  });
  it("без строки запроса и без якоря", () => {
    expect(sYazykom("/pricing", "kk")).toBe("/pricing?lang=kk");
  });
  it("уже заданный lang перезаписывается, а не дублируется", () => {
    expect(sYazykom("/pricing?lang=ru#apps", "kk")).toBe("/pricing?lang=kk#apps");
  });
});

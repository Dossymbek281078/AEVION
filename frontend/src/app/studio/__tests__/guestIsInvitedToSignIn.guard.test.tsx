// Гостю студии предлагают ВХОД, вошедшему без оплаты — покупку.
//
// ЗАМЕР 28.09.2026: заявок за всё время 1, активных подписчиков 1 (сам
// основатель). Бесплатный человек пользовался студией анонимно и уходил, не
// оставив даже почты, — значит ни списка, ни второго касания, ни продажи.
//
// Проверяется ИСХОДНИК страницы, потому что оба призыва живут в разметке
// одного клиентского компонента: рендер тянет за собой половину модуля и
// проверял бы окружение, а не условие. Условие здесь и есть предмет.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("призывы в студии различают гостя и вошедшего", () => {
  it("прибор видит предмет: страница вообще ветвится по ступени", () => {
    expect(src).toMatch(/credits\.tier === "free"/);
    expect(src).toMatch(/credits\.tier === "registered"/);
  });

  it("гостю предлагают вход по почте, а не покупку", () => {
    const блок = src.slice(src.indexOf('credits.tier === "free"'), src.indexOf('credits.tier === "registered"'));
    expect(блок).toContain('href="/auth"');
    expect(блок, "гостю показывают покупку вместо входа").not.toContain('href="#upgrade"');
  });

  it("вошедшему без оплаты предлагают покупку", () => {
    const i = src.indexOf('credits.tier === "registered"');
    const блок = src.slice(i, i + 900);
    expect(блок).toContain('href="#upgrade"');
  });
});

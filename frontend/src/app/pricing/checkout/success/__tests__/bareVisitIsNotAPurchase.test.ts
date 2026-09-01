/**
 * Простой заход на «оплата принята» — не покупка.
 *
 * Адрес публичный: его открывает бот, поисковик, любопытный, человек, которому
 * переслали ссылку. Событие отправлялось безусловно, и каждый такой заход шёл в
 * сводку «покупки по каналам», а при включённой рекламе — в Purchase для Meta и
 * TikTok. По этим числам решают, куда тратить бюджет; завышение выглядит как
 * успех и подталкивает платить за канал, который ничего не заработал.
 *
 * Признак должен пропускать ВСЕ четыре кассы и не пропускать голый заход.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Тот же признак, что на странице. Держим рядом с проверкой всех четырёх касс. */
function следОплаты(p: {
  provider?: string | null;
  ref?: string | null;
  total?: number | null;
  stub?: boolean;
}): boolean {
  return (
    Boolean(p.provider) ||
    Boolean(p.ref) ||
    (typeof p.total === "number" && p.total > 0) ||
    Boolean(p.stub)
  );
}

describe("след оплаты", () => {
  it("голый заход покупкой не считается", () => {
    expect(следОплаты({})).toBe(false);
  });

  it("возврат каждой из четырёх касс распознаётся", () => {
    expect(следОплаты({ provider: "paybox", ref: "abc" }), "PayBox").toBe(true);
    expect(следОплаты({ provider: "paypal", ref: "abc" }), "PayPal").toBe(true);
    expect(следОплаты({ provider: "gumroad" }), "Gumroad").toBe(true);
    // У LemonSqueezy в адресе НЕТ провайдера — только tier/period/total.
    expect(следОплаты({ total: 49 }), "LemonSqueezy").toBe(true);
  });

  it("бесплатный возврат Gumroad не выдаёт себя за покупку суммой", () => {
    // total=0 — признак не должен срабатывать ПО СУММЕ; провайдер там есть,
    // и покупкой это не станет уже ниже по цепочке, по правилу «ноль — не покупка».
    expect(следОплаты({ total: 0 })).toBe(false);
  });

  it("страница действительно применяет признак, а не только объявляет", () => {
    const s = readFileSync(
      join(process.cwd(), "src/app/pricing/checkout/success/page.tsx"),
      "utf8",
    );
    expect(s).toContain("if (!естьСледОплаты) return;");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { сКассойПартнёра, LS_AFFILIATE_COOKIE } from "@/lib/lsAffiliate";

const КАССА = "https://aevion.lemonsqueezy.com/buy/8c1f0a2e-0000-0000-0000-000000000000";
const w = window as unknown as { LemonSqueezy?: unknown };

function чистка() {
  delete w.LemonSqueezy;
  document.cookie = `${LS_AFFILIATE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
afterEach(чистка);

describe("сКассойПартнёра", () => {
  it("без партнёра и без API адрес не меняется", () => {
    expect(сКассойПартнёра(КАССА)).toBe(КАССА);
  });

  it("id из GetId дописывается как aff_ref, чужие параметры целы", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => "abc_123" } };
    const r = new URL(сКассойПартнёра(КАССА + "?x=1"));
    expect(r.searchParams.get("aff_ref")).toBe("abc_123");
    expect(r.searchParams.get("x")).toBe("1");
  });

  it("запасной источник: Url.Build", () => {
    w.LemonSqueezy = { Url: { Build: (u: string) => u + "?aff_ref=zzz9" } };
    expect(сКассойПартнёра(КАССА)).toBe(КАССА + "?aff_ref=zzz9");
  });

  it("cookie ls_aff_ref (то, что реально ставит affiliate.js)", () => {
    document.cookie = `${LS_AFFILIATE_COOKIE}=clk_0a1b2c3d; path=/`;
    expect(сКассойПартнёра(КАССА)).toBe(КАССА + "?aff_ref=clk_0a1b2c3d");
  });

  it("не дублирует aff_ref и aff", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => "new" } };
    const a = КАССА + "?aff_ref=old";
    const b = КАССА + "?aff=old";
    expect(сКассойПартнёра(a)).toBe(a);
    expect(сКассойПартнёра(b)).toBe(b);
  });

  it("чужой хост не трогаем (в том числе похожий)", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => "abc" } };
    expect(сКассойПартнёра("https://gumroad.com/l/x")).toBe("https://gumroad.com/l/x");
    expect(сКассойПартнёра("https://evillemonsqueezy.com/x")).toBe("https://evillemonsqueezy.com/x");
    expect(сКассойПартнёра("/pricing")).toBe("/pricing");
  });

  it("подписанный адрес: aff_ref дописывается (замер 30.10: 200), подпись цела", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => "abc" } };
    const s = "https://aevion.lemonsqueezy.com/checkout/custom/77dae7fb?signature=1056d5";
    expect(сКассойПартнёра(s)).toBe(s + "&aff_ref=abc");
  });

  it("недопустимый id отбрасывается", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => "a b&c=d" } };
    expect(сКассойПартнёра(КАССА)).toBe(КАССА);
  });

  it("падение чужого API не роняет кассу", () => {
    w.LemonSqueezy = { Affiliate: { GetId: () => { throw new Error("x"); } } };
    expect(сКассойПартнёра(КАССА)).toBe(КАССА);
  });
});

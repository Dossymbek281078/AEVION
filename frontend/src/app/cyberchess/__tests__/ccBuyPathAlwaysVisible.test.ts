// Настоящая касса CyberChess (карта, $) доступна с любой ширины и любому гостю.
// Замер 20.09.2026 по проду: единственная цена жила в баннере проектов — только ≥1100px и
// только без онбординга; на 390 и у нового посетителя цены/ссылки в кассу было 0 (контроль
// /qright — 3 и 2). Магазин Chessy продавал Pro/Ultimate за AEV через биллинг «не настроен».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { productById, PRICING_APP } from "@/lib/products";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("путь к кассе CyberChess всегда на экране", () => {
  it("цена и адрес берутся из каталога, а не зашиты", () => {
    const p = productById("cyberchess");
    expect(p).toBeTruthy();
    expect(p!.format).toMatch(/^приложение · от \$\d+\/мес$/);
    expect(p!.href).toBe(PRICING_APP("cyberchess"));
    expect(page).toContain('const ccBuyProduct=productById("cyberchess");');
    expect(page).toContain('const ccBuyLabel=(ccBuyProduct?.format||"").replace(/^приложение · /,"")||"купить";');
    // метка канала — после отрисовки, как в ModulePricingChip
    expect(page).toContain('sCcBuyHref(keepChannel(ccBuyProduct?.href||"/pricing#apps",channelNow()))');
  });
  it("шапка ≥769: ссылка в кассу рядом с «Помощь»", () => {
    expect(page).toContain('{vwPx>=769&&<a href={ccBuyHref} data-cc-buy="header"');
  });
  it("телефон <769: первый пункт меню «Ещё» — купить", () => {
    const i = page.indexOf("...(vwPx<769?[\n");
    expect(i).toBeGreaterThan(0);
    expect(page.slice(i, i + 400)).toContain("lbl:`Купить CyberChess · ${ccBuyLabel}`,act:()=>{window.location.href=ccBuyHref}");
  });
  it("магазин Chessy: карточка настоящей кассы стоит ВЫШЕ лестницы AEV", () => {
    const shop = page.indexOf('data-cc-buy="shop"');
    const aev = page.indexOf("Билет в AEVION CyberChess");
    expect(shop).toBeGreaterThan(0);
    expect(aev).toBeGreaterThan(shop);
    expect(page.slice(shop, aev)).toContain("<a href={ccBuyHref}");
  });
  it("контроль: в этих блоках нет зашитой цены в долларах", () => {
    for (const anchor of ['data-cc-buy="header"', 'data-cc-buy="shop"', "Купить CyberChess · ${ccBuyLabel}"]) {
      const i = page.indexOf(anchor);
      expect(page.slice(i, i + 700)).not.toMatch(/\$\d/);
    }
  });
});

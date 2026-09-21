import { describe, it, expect } from "vitest";
import { разметкаТоваров, разовыеТовары } from "@/lib/shopJsonLd";
import { GUIDES, SUBSCRIPTIONS, type Product } from "@/lib/products";

/**
 * 🔴 Цена в разметке для поисковика обязана равняться цене каталога.
 *
 * ЗАЧЕМ. Разметка — это ОБЕЩАНИЕ, которое Google покажет в выдаче ещё до того,
 * как человек зайдёт на сайт. Если она разойдётся с каталогом, мы пообещаем
 * одну цену, а в кассе будет другая — это ровно то расхождение «обещание против
 * продукта», за которым правило «ворота запуска» и заведено. Разойтись легко:
 * цену правят в каталоге, а число в разметке остаётся прежним.
 *
 * Поэтому проверяем не «разметка есть», а «каждая цена взята из каталога».
 */
describe("разметка товаров для поисковика не расходится с каталогом", () => {
  const схема = разметкаТоваров() as {
    itemListElement: Array<{ item: { sku: string; name: string; offers: { price: string; priceCurrency: string; url: string } } }>;
  } | null;

  it("прибор видит предмет: разовые товары в каталоге есть", () => {
    // без этого «расхождений нет» означало бы «я не нашёл ни одного товара»
    expect(разовыеТовары().length).toBeGreaterThan(0);
    expect(схема).not.toBeNull();
  });

  it("каждая цена в разметке равна цене каталога", () => {
    const каталог = new Map(разовыеТовары().map((p) => [p.id, p]));
    const расхождения: string[] = [];
    for (const строка of схема!.itemListElement) {
      const p = каталог.get(строка.item.sku);
      if (!p) { расхождения.push(`${строка.item.sku} — в разметке есть, в каталоге нет`); continue; }
      if (строка.item.offers.price !== p.priceUsd.toFixed(2)) {
        расхождения.push(`${p.id}: в разметке ${строка.item.offers.price}, в каталоге ${p.priceUsd.toFixed(2)}`);
      }
      if (строка.item.offers.url !== p.href) {
        расхождения.push(`${p.id}: ссылка в разметке не совпадает с каталогом`);
      }
    }
    expect(расхождения, расхождения.join("\n")).toEqual([]);
  });

  it("ни один товар каталога не потерян", () => {
    expect(схема!.itemListElement.length).toBe(разовыеТовары().length);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: подписка в список не попадает", () => {
    // У подписки цена зависит от срока: один Offer обещал бы поисковику
    // месячную цену как цену покупки. Лучше не обещать вовсе.
    const sku = new Set(схема!.itemListElement.map((s) => s.item.sku));
    for (const s of SUBSCRIPTIONS) expect(sku.has(s.id)).toBe(false);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: прибор умеет краснеть на подделанной цене", () => {
    const подделка: Product[] = GUIDES.filter((p) => p.billing === "once" && p.priceUsd > 0)
      .map((p, i) => (i === 0 ? { ...p, priceUsd: p.priceUsd + 1 } : p));
    const с = разметкаТоваров(подделка) as { itemListElement: Array<{ item: { offers: { price: string } } }> };
    const настоящая = разовыеТовары()[0].priceUsd.toFixed(2);
    expect(с.itemListElement[0].item.offers.price).not.toBe(настоящая);
  });

  it("пустой каталог даёт НЕТ РАЗМЕТКИ, а не пустой список", () => {
    // Пустой ItemList — это утверждение «товаров нет». Молчание честнее.
    expect(разметкаТоваров([])).toBeNull();
  });
});

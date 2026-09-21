import { GUIDES, type Product } from "./products";

/**
 * Разметка товаров для поисковика.
 *
 * 🔴 ЗАЧЕМ. Замер 20.09.2026 по проду: на `/shop`, `/go`, `/pricing` и
 * `/devhub` в разметке есть только `Organization` и `WebSite` — ни одного
 * `Product` с ценой. Google не может показать цену в выдаче, а именно цена и
 * наличие делают строку выдачи кликабельной. Трафика почти нет (за двое суток
 * ни одной начатой оплаты человеком), и поиск — единственный канал, который
 * заводится без чужих логинов и без публикаций.
 *
 * ЦЕНЫ БЕРЁМ ИЗ КАТАЛОГА, а не переписываем числами: иначе разметка и витрина
 * разойдутся при первой правке цены, и поисковику мы пообещаем одно, а в кассе
 * будет другое.
 *
 * Только разовые товары (`billing === "once"`): у них цена — это цена покупки.
 * У подписки цена зависит от срока, и один `Offer` соврал бы.
 */
const SITE = "https://aevion.app";

export function разовыеТовары(источник: Product[] = GUIDES): Product[] {
  return источник.filter((p) => p.billing === "once" && p.priceUsd > 0);
}

export function разметкаТоваров(источник: Product[] = GUIDES): object | null {
  const товары = разовыеТовары(источник);
  if (товары.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Магазин AEVION",
    itemListElement: товары.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        "@id": `${SITE}/shop#${p.id}`,
        name: p.title,
        description: p.desc,
        sku: p.id,
        brand: { "@type": "Organization", name: "AEVION", url: SITE },
        offers: {
          "@type": "Offer",
          price: p.priceUsd.toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: p.href,
        },
      },
    })),
  };
}

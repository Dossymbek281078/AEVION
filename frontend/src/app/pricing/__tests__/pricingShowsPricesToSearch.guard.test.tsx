// Главная продающая страница обязана показывать цену ПОИСКОВИКУ.
//
// ЗАМЕР 23.09.2026 по проду: `/pricing` отдаёт роботу 35 547 знаков, названия
// товаров в них есть, а цен нет ни одной — их рисует браузер. В выдаче страница
// выглядит как страница без цены, и это её главный товарный признак.
//
// Проверяется СЛЕДСТВИЕ: в дереве два блока разметки, в них цены из каталога и
// только оплачиваемые приложения. Контроль: касса молчит — блок приложений
// исчезает целиком, а не превращается в «в наличии».
import { describe, it, expect, vi, afterEach } from "vitest";
import PricingLayout from "../layout";
import { разовыеТовары } from "@/lib/shopJsonLd";

const НАСТРОЕНО = ["cyberchess", "devhub", "multichat", "ip_bureau", "qventure"]
  .flatMap((s) => ["lite", "medium", "pro", "full", "max"].map((t) => `app_${s}_${t}`));

function касса(configured: string[]) {
  return {
    ok: true,
    json: async () => ({ providers: { lemonsqueezy: { sellable: { configured } } } }),
  } as unknown as Response;
}

async function блоки(): Promise<string[]> {
  const дерево = await PricingLayout({ children: null });
  const дети = (дерево as { props?: { children?: unknown } })?.props?.children;
  const список = Array.isArray(дети) ? дети : [дети];
  return список
    .map((ребёнок) => {
      const el = ребёнок as {
        type?: string;
        props?: { type?: string; dangerouslySetInnerHTML?: { __html?: string } };
      };
      return el?.type === "script" && el.props?.type === "application/ld+json"
        ? el.props.dangerouslySetInnerHTML?.__html ?? ""
        : "";
    })
    .filter(Boolean);
}

afterEach(() => vi.unstubAllGlobals());

describe("/pricing отдаёт поисковику цены", () => {
  it("несёт два блока: разовые товары и оплачиваемые приложения", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => касса(НАСТРОЕНО)));
    const найдено = await блоки();
    expect(найдено).toHaveLength(2);
    const все = найдено.join(" ");
    expect(все).toContain("AggregateOffer");
    expect(все).not.toContain("qskyway");
  });

  it("цены разовых товаров равны каталожным", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => касса(НАСТРОЕНО)));
    const [товары] = await блоки();
    const схема = JSON.parse(товары) as {
      itemListElement: Array<{ item: { sku: string; offers: { price: string } } }>;
    };
    const каталог = new Map(разовыеТовары().map((p) => [p.id, p.priceUsd.toFixed(2)]));
    expect(схема.itemListElement.length).toBe(разовыеТовары().length);
    for (const строка of схема.itemListElement) {
      expect(строка.item.offers.price).toBe(каталог.get(строка.item.sku));
    }
  });

  it("касса молчит — блок приложений исчезает, товары остаются", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("сеть"); }));
    const найдено = await блоки();
    expect(найдено).toHaveLength(1);
    expect(найдено[0]).not.toContain("AggregateOffer");
  });
});

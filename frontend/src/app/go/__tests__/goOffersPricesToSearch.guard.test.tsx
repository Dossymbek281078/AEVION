// `/go` обязана отдавать поисковику цены, а не только название.
//
// ЗАМЕР 23.09.2026 по боевому проду: страница, куда ведут все описания роликов
// YouTube, отдавала роботу 52 200 знаков и НИ ОДНОГО блока Product — только
// Organization и WebSite. Значит в выдаче нет ни цены, ни наличия, а это две
// строки, которые делают результат кликабельным.
//
// Проверяется СЛЕДСТВИЕ: в дереве страницы есть скрипт разметки, и в нём
// лежат те же цены, что в каталоге. Отдельный отрицательный контроль ловит
// подмену «разметка есть, но пустая».
import { describe, it, expect } from "vitest";
import GoLayout from "../layout";
import { разовыеТовары } from "@/lib/shopJsonLd";

function найтиРазметку(узел: unknown): string | null {
  const дети = (узел as { props?: { children?: unknown } })?.props?.children;
  const список = Array.isArray(дети) ? дети : [дети];
  for (const ребёнок of список) {
    const el = ребёнок as {
      type?: string;
      props?: { type?: string; dangerouslySetInnerHTML?: { __html?: string } };
    };
    if (el?.type === "script" && el.props?.type === "application/ld+json") {
      return el.props.dangerouslySetInnerHTML?.__html ?? null;
    }
  }
  return null;
}

describe("/go отдаёт поисковику цены", () => {
  const html = найтиРазметку(GoLayout({ children: null }));

  it("прибор видит предмет: разовые товары в каталоге есть", () => {
    expect(разовыеТовары().length).toBeGreaterThan(0);
  });

  it("страница несёт блок разметки товаров", () => {
    expect(html).not.toBeNull();
  });

  it("в разметке столько же товаров, сколько в каталоге, и цены совпадают", () => {
    const схема = JSON.parse(html!) as {
      itemListElement: Array<{ item: { sku: string; offers: { price: string } } }>;
    };
    expect(схема.itemListElement.length).toBe(разовыеТовары().length);
    const каталог = new Map(разовыеТовары().map((p) => [p.id, p.priceUsd.toFixed(2)]));
    const расхождения = схема.itemListElement
      .filter((с) => каталог.get(с.item.sku) !== с.item.offers.price)
      .map((с) => с.item.sku);
    expect(расхождения, расхождения.join(", ")).toEqual([]);
  });
});

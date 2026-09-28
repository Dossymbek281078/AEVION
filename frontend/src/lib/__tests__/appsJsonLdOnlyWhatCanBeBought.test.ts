// Разметка каталога обещает поисковику ТОЛЬКО то, что можно оплатить.
//
// ЗАМЕР 23.09.2026: из девяти приложений витрины касса настроена у пяти
// (`/api/pricing/checkout/healthz`: 30 вариантов из 50). Если бы разметка шла
// от нашего списка, Google получил бы «в наличии» на четыре приложения, оплата
// которых отвечает 503. Поэтому источник наличия — касса.
import { describe, it, expect, vi, afterEach } from "vitest";
import { разметкаПриложений, slugиИзКассы } from "@/lib/appsJsonLd";
import { STANDALONE_APPS, fromPricePerMonth } from "@/lib/termPricing";

const НАСТРОЕНО = ["cyberchess", "devhub", "multichat", "ip_bureau", "qventure"]
  .flatMap((s) => ["lite", "medium", "pro", "full", "max"].map((t) => `app_${s}_${t}`));

function ответКассы(configured: string[]) {
  return {
    ok: true,
    json: async () => ({ providers: { lemonsqueezy: { sellable: { configured } } } }),
  } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("разметка каталога приложений", () => {
  it("прибор видит предмет: в каталоге приложений больше, чем настроено в кассе", () => {
    expect(STANDALONE_APPS.length).toBeGreaterThan(5);
    expect(slugиИзКассы(НАСТРОЕНО).size).toBe(5);
  });

  it("несёт только оплачиваемые приложения", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ответКассы(НАСТРОЕНО)));
    const схема = (await разметкаПриложений()) as {
      itemListElement: Array<{ item: { sku: string; offers: { lowPrice: string; highPrice: string } } }>;
    };
    const sku = схема.itemListElement.map((э) => э.item.sku).sort();
    expect(sku).toEqual(["cyberchess", "devhub", "ip_bureau", "multichat", "qventure"]);
    expect(sku).not.toContain("qskyway");
    expect(sku).not.toContain("qsign");
  });

  it("вилка цен берётся из лестницы, а не из числа в разметке", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ответКассы(НАСТРОЕНО)));
    const схема = (await разметкаПриложений()) as {
      itemListElement: Array<{ item: { sku: string; offers: { lowPrice: string; highPrice: string } } }>;
    };
    const каталог = new Map(STANDALONE_APPS.map((a) => [a.slug, a]));
    for (const э of схема.itemListElement) {
      const app = каталог.get(э.item.sku)!;
      expect(э.item.offers.highPrice).toBe(app.baseMonthly.toFixed(2));
      expect(э.item.offers.lowPrice).toBe(fromPricePerMonth(app.baseMonthly).toFixed(2));
    }
  });

  it("касса не ответила — разметки нет вовсе, а не «в наличии»", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("сеть"); }));
    expect(await разметкаПриложений()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await разметкаПриложений()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => ответКассы([])));
    expect(await разметкаПриложений()).toBeNull();
  });
});

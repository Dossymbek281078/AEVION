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
    /*
     * 🔴 12.10.2026: ip_bureau ушёл из списка по прямому слову основателя
     * «убрать кнопку бюро». Касса его вариант по-прежнему знает (в Lemon
     * Squeezy ничего не трогали), поэтому проверка «только то, что касса
     * продаёт» сама по себе его бы оставила. Разметка — ТРЕТЬЯ точка
     * предложения: обещать поисковику покупку того, чего нет на витрине,
     * значит звать человека из выдачи в тупик.
     * Причина запрета — в lib/neProdayotsyaOtdelno.ts: модуль открыт
     * бесплатно, а Verified купить нельзя (kyc заглушка, платежи настроены
     * неверно).
     */
    // 19.10.2026: один план — в разметке только шахматы.
    expect(sku).toEqual(["cyberchess"]);
    expect(sku).not.toContain("devhub");
    expect(sku, "бюро вернулось в разметку — витрина и выдача разошлись").not.toContain("ip_bureau");
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
      // 19.10.2026: у годового приложения одна цена — $50/год, offerCount 1.
      expect(э.item.offers.highPrice).toBe((app.yearOnlyUsd ?? app.baseMonthly).toFixed(2));
      expect(э.item.offers.lowPrice).toBe((app.yearOnlyUsd ?? fromPricePerMonth(app.baseMonthly)).toFixed(2));
      expect(э.item.offers.offerCount).toBe(app.yearOnlyUsd != null ? 1 : 5);
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

import { describe, expect, it } from "vitest";
import { ALL_PRODUCTS, MODULES, SUBSCRIPTIONS } from "@/lib/products";
import { STANDALONE_APPS } from "@/lib/termPricing";

/**
 * У каждого товара каталога должна быть цена И путь к оплате.
 *
 * Класс, ради которого сторож: «кнопка купить ведёт в никуда». Он уже случался
 * дважды — 10.08 девять кнопок Lemon Squeezy считали мёртвыми (оказалось ложной
 * тревогой от User-Agent), а 23.08 на странице QCoreAI кнопка оплаты вела в
 * поля карты, которые никуда не отправлялись.
 *
 * ⚠️ 15.09.2026 — новая ценовая политика. Путь к оплате теперь двух видов:
 *   · прямая ссылка продавца (Gumroad) — гайды и книги, разовая покупка;
 *   · наша касса через страницу цен — подписка на всю планету (/pricing#tiers)
 *     и пять отдельных приложений (/pricing?app=<slug>#apps).
 * Сторож исполняет настоящие объекты каталога, а не грепает исходник: цена и
 * адрес приложений вычисляются из лестницы сроков, литерала в файле нет.
 *
 * ЧЕГО ОН НЕ ДЕЛАЕТ. Он не ходит в сеть: живость ссылок проверяется отдельно.
 * Здесь проверяется НАЛИЧИЕ пути к оплате, а не его работа.
 */

const EXTERNAL = /^https:\/\/aevion\.(gumroad\.com\/l\/|lemonsqueezy\.com\/checkout\/buy\/)[A-Za-z0-9-]{4,}/;
const PRICING = /^\/pricing(\?app=[a-z_]+)?#(tiers|apps)$/;

describe("каждый товар каталога можно купить", () => {
  // Контроль охвата: пустой каталог ответил бы «нарушений нет».
  it("контроль прибора: каталог собран", () => {
    expect(ALL_PRODUCTS.length, "каталог пуст или потерял товары").toBeGreaterThanOrEqual(10);
    expect(ALL_PRODUCTS.some((p) => p.id === "cyberchess"), "не нашёл известный товар").toBe(true);
  });

  it("у каждого есть цена", () => {
    const noPrice = ALL_PRODUCTS.filter((p) => !(Number.isFinite(p.priceUsd) && p.priceUsd > 0)).map((p) => p.id);
    expect(noPrice, `товар без цены — купить нельзя: ${noPrice.join(", ")}`).toEqual([]);
  });

  it("у каждого есть путь к оплате: ссылка продавца или страница цен", () => {
    const noHref = ALL_PRODUCTS.filter((p) => !EXTERNAL.test(p.href) && !PRICING.test(p.href)).map(
      (p) => `${p.id} -> ${p.href}`,
    );
    expect(noHref, `товар без пути к оплате — кнопка ведёт в никуда: ${noHref.join(", ")}`).toEqual([]);
  });

  it("срочный доступ продаётся ТОЛЬКО через страницу цен, разовое — только ссылкой продавца", () => {
    const wrong = ALL_PRODUCTS.filter((p) =>
      p.billing === "term" ? !PRICING.test(p.href) : !EXTERNAL.test(p.href),
    ).map((p) => `${p.id} (${p.billing}) -> ${p.href}`);
    expect(wrong, "способ оплаты не совпадает с тем, как списываются деньги").toEqual([]);
  });

  it("отдельно продаются ровно пять приложений лестницы, остальное — одна подписка", () => {
    expect(MODULES.map((m) => m.href).sort()).toEqual(
      STANDALONE_APPS.map((a) => `/pricing?app=${a.slug}#apps`).sort(),
    );
    expect(SUBSCRIPTIONS.map((s) => s.href)).toEqual(["/pricing#tiers"]);
  });
});

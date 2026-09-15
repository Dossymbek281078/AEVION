import { describe, test, expect, vi, afterEach, afterAll } from "vitest";

/**
 * Что касса Gumroad считает «продаётся», то вебхук обязан уметь выдать.
 *
 * Замер 15.09.2026. `gumroadSellable` (касса и /checkout/healthz) считает
 * позицию продаваемой, если задана GUMROAD_PERMALINK_<ССЫЛКА>. Правил 17 позиций:
 * восемь тарифов и девять приложений. А вебхук узнавал только шесть тарифов
 * (lite/medium/full) — Planet и приложения человек мог оплатить, а в ответ
 * Gumroad получал 500 «неизвестный товар», и доступ не открывался. Своя
 * догадка тарифа по словам вдобавок отправляла Planet в lite.
 *
 * Проверяется по каждой позиции: продаётся → узнаётся → даёт ровно то же,
 * что за неё же выдаёт вебхук Lemon Squeezy (общие функции).
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const прежняяОбщая = process.env.GUMROAD_DEFAULT_PERMALINK;
delete process.env.GUMROAD_DEFAULT_PERMALINK;

const { __testables } = await import("../src/routes/gumroadWebhook");
const { gumroadSellable } = await import("../src/lib/payment/gumroadProvider");
const { STOREFRONT_NAME_TO_REFERENCE, tierForLemonSqueezyReference, appSlugForReference } = await import(
  "../src/data/lemonSqueezyVariants"
);

const ВСЕ = [...new Set(Object.values(STOREFRONT_NAME_TO_REFERENCE))];
const ключ = (ref: string) => `GUMROAD_PERMALINK_${ref.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
const слаг = (ref: string) => `t-${ref.replace(/_/g, "-")}`;
const поставлено: string[] = [];

function задать(ref: string) {
  process.env[ключ(ref)] = `https://aevion.gumroad.com/l/${слаг(ref)}`;
  поставлено.push(ключ(ref));
}

afterEach(() => {
  for (const k of поставлено.splice(0)) delete process.env[k];
});
afterAll(() => {
  if (прежняяОбщая !== undefined) process.env.GUMROAD_DEFAULT_PERMALINK = прежняяОбщая;
});

describe("что продаётся через Gumroad, то вебхук выдаёт", () => {
  test("контроль: позиций 17, среди них и тарифы (с Planet), и приложения", () => {
    expect(ВСЕ.length).toBe(17);
    expect(ВСЕ).toContain("tier_planet_monthly");
    expect(ВСЕ.filter((r) => r.startsWith("app_")).length).toBe(9);
  });

  test("КОНТРОЛЬ: без переменной позиция не продаётся и не узнаётся", () => {
    for (const ref of ВСЕ) {
      expect(gumroadSellable([ref]).configured, `${ref} продаётся без переменной`).toEqual([]);
      expect(__testables.resolveReference({ product_permalink: слаг(ref) }), `${ref} узнан без переменной`).toBe("unknown");
    }
  });

  for (const ref of ВСЕ) {
    test(`${ref}: продаётся → узнаётся → выдаёт то же, что Lemon Squeezy`, () => {
      задать(ref);
      expect(gumroadSellable([ref]).configured, "касса не считает позицию продаваемой").toEqual([ref]);
      expect(__testables.resolveReference({ product_permalink: слаг(ref) }), "вебхук не узнал оплаченный товар").toBe(ref);
      if (ref.startsWith("tier_")) {
        expect(__testables.tierForReference(ref), "тариф не совпал с Lemon Squeezy").toBe(tierForLemonSqueezyReference(ref));
        expect(__testables.moduleSlugForReference(ref), "тариф принят за приложение").toBeNull();
      } else {
        expect(__testables.moduleSlugForReference(ref), "приложение не совпало с Lemon Squeezy").toBe(appSlugForReference(ref));
      }
    });
  }

  test("КОНТРОЛЬ: похожий, но другой адрес товара не узнаётся", () => {
    задать("tier_lite_monthly");
    expect(__testables.resolveReference({ product_permalink: `${слаг("tier_lite_monthly")}-x` })).toBe("unknown");
  });
});

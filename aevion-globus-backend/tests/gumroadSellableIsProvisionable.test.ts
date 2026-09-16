import { describe, test, expect, vi, afterEach, afterAll } from "vitest";

/**
 * Что касса Gumroad считает «продаётся», то вебхук обязан уметь выдать.
 *
 * Замер 15.09.2026. `gumroadSellable` (касса и /checkout/healthz) считает
 * позицию продаваемой, если задана GUMROAD_PERMALINK_<ССЫЛКА>. А вебхук узнавал
 * только часть тарифов — остальное человек мог оплатить, а в ответ Gumroad
 * получал 500 «неизвестный товар», и доступ не открывался.
 *
 * С 15.09.2026 позиций 30: пять ступеней срока всей планеты (tier_lite … tier_max)
 * и пять ступеней каждого из пяти отдельных приложений (app_<slug>_<ступень>).
 * Проверяется по каждой: продаётся → узнаётся → даёт ровно то же, что за неё же
 * выдаёт вебхук Lemon Squeezy (общие функции).
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const прежняяОбщая = process.env.GUMROAD_DEFAULT_PERMALINK;
delete process.env.GUMROAD_DEFAULT_PERMALINK;

const { __testables, gumroadProvisionable } = await import("../src/routes/gumroadWebhook");
const { gumroadSellable } = await import("../src/lib/payment/gumroadProvider");
const { STOREFRONT_NAME_TO_REFERENCE, tierForLemonSqueezyReference, appSlugForReference } = await import(
  "../src/data/lemonSqueezyVariants"
);
const { TERM_TIERS, STANDALONE_APPS, TIERS, termTotal } = await import("../src/data/pricing");

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

const ОЖИДАЕМО = TERM_TIERS.length * (1 + STANDALONE_APPS.length);

describe("что продаётся через Gumroad, то вебхук выдаёт", () => {
  test("контроль: позиций 30 — пять сроков планеты и пять сроков у каждого из пяти приложений", () => {
    expect(ОЖИДАЕМО).toBe(30);
    expect(ВСЕ.length).toBe(ОЖИДАЕМО);
    for (const t of TERM_TIERS) expect(ВСЕ).toContain(`tier_${t}`);
    expect(ВСЕ.filter((r) => r.startsWith("app_")).length).toBe(25);
    expect(ВСЕ).toContain("app_ip_bureau_max");
    // Прежние позиции витрины не продаются.
    expect(ВСЕ).not.toContain("tier_lite_monthly");
    expect(ВСЕ).not.toContain("app_smeta");
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
        // Ступень срока выдаётся САМА, а не входным тарифом.
        expect(__testables.tierForReference(ref)).toBe(ref.slice(5));
        expect(__testables.moduleSlugForReference(ref), "тариф принят за приложение").toBeNull();
      } else {
        expect(__testables.moduleSlugForReference(ref), "приложение не совпало с Lemon Squeezy").toBe(appSlugForReference(ref));
      }
    });
  }

  test("пара для healthz: что продаётся, то и выдаётся — по всем 30", () => {
    for (const ref of ВСЕ) задать(ref);
    expect(gumroadProvisionable(ВСЕ).configured).toEqual(gumroadSellable(ВСЕ).configured);
    expect(gumroadProvisionable(ВСЕ).configured.length).toBe(ОЖИДАЕМО);
  });

  test("КОНТРОЛЬ: общий товар по умолчанию — «продаётся» всё, «выдаётся» ничего", () => {
    process.env.GUMROAD_DEFAULT_PERMALINK = "https://aevion.gumroad.com/l/obshchij";
    поставлено.push("GUMROAD_DEFAULT_PERMALINK");
    expect(gumroadSellable(ВСЕ).configured.length, "касса должна объявить всё продаваемым").toBe(ОЖИДАЕМО);
    expect(gumroadProvisionable(ВСЕ).configured, "расхождение не видно — прибор слеп").toEqual([]);
  });

  describe("один товар Gumroad на несколько сроков (15.09.2026)", () => {
    // Gumroad умеет у одной подписки месяц, квартал, полгода и год (девяти месяцев
    // не умеет). Вебхук узнаёт по адресу ПЕРВУЮ ступень — самую короткую, а
    // настоящий срок обязана решить ПРОВЕРЕННАЯ продажа. Иначе заплативший за год
    // получает месяц.
    const ОБЩИЙ = "https://aevion.gumroad.com/l/aevion-planet";
    const общий = (ступени: readonly string[] = ["lite", "medium", "pro", "max"]) => {
      for (const t of ступени) {
        process.env[ключ(`tier_${t}`)] = ОБЩИЙ;
        поставлено.push(ключ(`tier_${t}`));
      }
    };
    const срок = (s: Record<string, unknown> | null, usd?: number) =>
      __testables.срокПоПродаже("tier_lite", s, usd);
    const платёж = (t: string) => TIERS.find((x) => x.id === t)!.priceTermTotal!;

    test("healthz: все ступени общего товара и продаются, и выдаются", () => {
      общий();
      const refs = ["tier_lite", "tier_medium", "tier_pro", "tier_max"];
      expect(gumroadProvisionable(refs).configured).toEqual(gumroadSellable(refs).configured);
      expect(gumroadProvisionable(refs).configured.length).toBe(4);
    });
    test("адрес общего товара узнаётся как самая короткая ступень", () => {
      общий();
      expect(__testables.resolveReference({ product_permalink: "aevion-planet" })).toBe("tier_lite");
    });
    test("проверенная продажа говорит yearly — Max (12 месяцев)", () => {
      общий();
      expect(срок({ recurrence: "yearly" }, undefined)).toBe("tier_max");
    });
    test("quarterly — Medium, biannually — Pro, monthly — Lite", () => {
      общий();
      expect(срок({ recurrence: "quarterly" }, undefined)).toBe("tier_medium");
      expect(срок({ recurrence: "biannually" }, undefined)).toBe("tier_pro");
      expect(срок({ recurrence: "monthly" }, undefined)).toBe("tier_lite");
    });
    test("повтора нет — решает сумма: платёж за год даёт Max, за квартал Medium", () => {
      общий();
      expect(срок({ price: String(платёж("max") * 100) }, платёж("max"))).toBe("tier_max");
      expect(срок({}, платёж("medium"))).toBe("tier_medium");
      expect(срок({}, платёж("lite"))).toBe("tier_lite");
    });
    test("КОНТРОЛЬ: сумма не похожа ни на один срок — самая короткая ступень, а не догадка", () => {
      общий();
      // $700: дальше 10% от любого платежа за срок (400 / 1050 / 1800 / 2400).
      expect(срок({}, 700)).toBe("tier_lite");
    });
    test("КОНТРОЛЬ: продажа не проверена — самая короткая ступень", () => {
      общий();
      expect(срок(null, undefined)).toBe("tier_lite");
    });
    test("КОНТРОЛЬ: yearly, а Max на этом товаре не заведён — срок не придумываем", () => {
      общий(["lite", "medium"]);
      expect(срок({ recurrence: "yearly" }, undefined)).toBe("tier_lite");
    });
    test("КОНТРОЛЬ: у Max свой товар — ступень Lite не трогаем", () => {
      process.env[ключ("tier_lite")] = "aevion-lite";
      process.env[ключ("tier_max")] = "aevion-max";
      поставлено.push(ключ("tier_lite"), ключ("tier_max"));
      expect(срок({ recurrence: "yearly" }, платёж("max"))).toBe("tier_lite");
    });
    test("приложение на общем товаре: сумма за год CyberChess даёт app_cyberchess_max", () => {
      for (const t of ["lite", "max"]) {
        process.env[ключ(`app_cyberchess_${t}`)] = "https://aevion.gumroad.com/l/cyberchess";
        поставлено.push(ключ(`app_cyberchess_${t}`));
      }
      const годCyberChess = termTotal(24, "max");
      expect(__testables.срокПоПродаже("app_cyberchess_lite", {}, годCyberChess)).toBe("app_cyberchess_max");
      expect(__testables.срокПоПродаже("app_cyberchess_lite", {}, termTotal(24, "lite"))).toBe("app_cyberchess_lite");
    });
  });

  test("КОНТРОЛЬ: похожий, но другой адрес товара не узнаётся", () => {
    задать("tier_lite");
    expect(__testables.resolveReference({ product_permalink: `${слаг("tier_lite")}-x` })).toBe("unknown");
  });
});

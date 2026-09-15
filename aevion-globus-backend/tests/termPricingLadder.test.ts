import { describe, test, expect } from "vitest";
import {
  TIERS,
  TERM_TIERS,
  PLANET_BASE_MONTHLY,
  STANDALONE_APPS,
  MODULES_PRICING,
  termPricePerMonth,
  termTotal,
  buildQuote,
} from "../src/data/pricing";
import { termMonthsForReference, tierIdForReference } from "../src/lib/payment/billingPeriod";
import { ссылкаПодписки } from "../src/lib/payment/subscriptionReference";
import {
  priceForReference,
  TERM_REFERENCES,
  STOREFRONT_NAME_TO_REFERENCE,
  appSlugForReference,
  tierForLemonSqueezyReference,
} from "../src/data/lemonSqueezyVariants";

/**
 * Лестница сроков — слово основателя 15.09.2026: «Вся планета Аевион стоит в месяц
 * 400 долларов, если на 3 месяца то по 350, если на полгода то по 300, если на
 * 9 месяцев 250, если на 12 месяцев то 200». Тарифы по сроку: Lite 1 месяц,
 * Medium 3, Pro 6, Full 9, Max 12. Отдельно продаются только пять приложений.
 *
 * Числа планеты здесь записаны ЛИТЕРАЛАМИ намеренно: это решение человека, а не
 * формула. Сторож, который сравнивает данные с той же формулой, что их породила,
 * зеленеет на любой ошибке в формуле.
 */
const term = (id: string) => TIERS.find((t) => t.id === id)!;

describe("лестница сроков AEVION", () => {
  test("планета: $400 / $350 / $300 / $250 / $200 в месяц на 1 / 3 / 6 / 9 / 12 месяцев", () => {
    expect(TERM_TIERS.map((t) => term(t).priceMonthly)).toEqual([400, 350, 300, 250, 200]);
    expect(TERM_TIERS.map((t) => term(t).termMonths)).toEqual([1, 3, 6, 9, 12]);
    expect(TERM_TIERS.map((t) => term(t).priceTermTotal)).toEqual([400, 1050, 1800, 2250, 2400]);
    expect(TERM_TIERS.map((t) => term(t).name)).toEqual(["Lite", "Medium", "Pro", "Full", "Max"]);
    expect(PLANET_BASE_MONTHLY).toBe(400);
  });

  test("отдельно продаются ровно пять приложений: шахматы, мультичат, бизнес-анализатор, бюро, DevHub", () => {
    expect(STANDALONE_APPS.map((a) => a.moduleId).sort()).toEqual(
      ["aevion-ip-bureau", "cyberchess", "devhub", "multichat-engine", "qventure"],
    );
    const standalone = new Set(STANDALONE_APPS.map((a) => a.moduleId));
    const soldAsAddon = MODULES_PRICING.filter((m) => (m.addonMonthly ?? 0) > 0).map((m) => m.id);
    expect(soldAsAddon.filter((id) => !standalone.has(id)), "модуль продаётся отдельно, хотя не входит в пять").toEqual([]);
    for (const id of soldAsAddon) {
      expect(MODULES_PRICING.find((m) => m.id === id)!.addonMonthly).toBe(STANDALONE_APPS.find((a) => a.moduleId === id)!.baseMonthly);
    }
  });

  test("вся планета дешевле пяти приложений по отдельности — на КАЖДОМ сроке", () => {
    for (const t of TERM_TIERS) {
      const sum = STANDALONE_APPS.reduce((s, a) => s + termPricePerMonth(a.baseMonthly, t), 0);
      expect(sum, `срок ${t}`).toBeGreaterThan(termPricePerMonth(PLANET_BASE_MONTHLY, t));
    }
  });

  test("на каждой ступени целые доллары; нецелая база — ошибка данных, а не округление", () => {
    for (const a of STANDALONE_APPS) for (const t of TERM_TIERS) expect(Number.isInteger(termPricePerMonth(a.baseMonthly, t))).toBe(true);
    expect(() => termPricePerMonth(25, "medium")).toThrow();
  });

  test("смета тарифа = платёж за весь срок вперёд, без второй скидки", () => {
    for (const t of TERM_TIERS) {
      const q = buildQuote({ tierId: t });
      expect(q.total, t).toBe(term(t).priceTermTotal);
      expect(q.termMonths, t).toBe(term(t).termMonths);
      expect(q.discount, t).toBe(0);
    }
  });
});

describe("ссылка заказа → тариф и срок", () => {
  const cases: Array<[string, string | null, number]> = [
    ["tier_lite", "lite", 1],
    ["tier_medium", "medium", 3],
    ["tier_pro", "pro", 6],
    ["tier_full", "full", 9],
    ["tier_max", "max", 12],
    // прежние ссылки: по ним уже могли купить, продление придёт с ними же
    ["tier_lite_monthly", "lite", 1],
    ["tier_lite_annual", "lite", 12],
    ["tier_pro_monthly", "full", 1],
    ["tier_planet_annual", "full", 12],
    // КОНТРОЛЬ: «promo» содержит «pro», но это не наша ссылка
    ["promo-2026-09", null, 1],
    ["tier_promo", null, 1],
  ];
  for (const [ref, tier, months] of cases) {
    test(`${ref} → ${tier ?? "не наша"}, ${months} мес`, () => {
      expect(tierIdForReference(ref)).toBe(tier);
      expect(termMonthsForReference(ref)).toBe(months);
    });
  }

  test("приложение на ступени: срок из ступени, slug без неё", () => {
    expect(termMonthsForReference("app_cyberchess_full")).toBe(9);
    expect(appSlugForReference("app_cyberchess_full")).toBe("cyberchess");
    expect(termMonthsForReference("app_ip_bureau_max")).toBe(12);
    expect(appSlugForReference("app_ip_bureau_max")).toBe("ip_bureau");
    expect(appSlugForReference("app_devhub")).toBe("devhub");
    expect(termMonthsForReference("app_devhub")).toBe(1);
  });

  test("покупка приложения не выдаёт тариф в вебхуках карт (PayBox, PayPal)", () => {
    // app_cyberchess_full несёт слово ступени «full»: токенный поиск принял бы его
    // за тариф, и оплата шахмат открыла бы всю планету на 9 месяцев.
    for (const a of STANDALONE_APPS) for (const t of TERM_TIERS) {
      expect(ссылкаПодписки(`app_${a.slug}_${t}`), `app_${a.slug}_${t}`).toBe(false);
    }
    // КОНТРОЛЬ: настоящие ссылки тарифов по-прежнему подписки
    for (const t of TERM_TIERS) expect(ссылкаПодписки(`tier_${t}`)).toBe(true);
  });

  test("вебхук Lemon Squeezy выдаёт купленный срок, а не Lite по умолчанию", () => {
    for (const t of TERM_TIERS) expect(tierForLemonSqueezyReference(`tier_${t}`)).toBe(t);
  });

  test("касса не должна брать больше платежа за срок — по каждой продаваемой ссылке", () => {
    expect(TERM_REFERENCES.length).toBe(5 + 5 * STANDALONE_APPS.length);
    for (const ref of TERM_REFERENCES) {
      const t = ref.slice(ref.lastIndexOf("_") + 1) as (typeof TERM_TIERS)[number];
      const expected = ref.startsWith("tier_")
        ? term(t).priceTermTotal
        : termTotal(STANDALONE_APPS.find((a) => a.slug === appSlugForReference(ref))!.baseMonthly, t);
      expect(priceForReference(ref), ref).toBe(expected);
    }
    expect(priceForReference("app_devhub"), "прежняя ссылка — без потолка").toBeNull();
  });

  test("витрина магазина называет каждую продаваемую ссылку ровно одним товаром", () => {
    const values = Object.values(STOREFRONT_NAME_TO_REFERENCE);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...TERM_REFERENCES].sort());
  });
});

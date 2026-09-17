import { describe, it, expect } from "vitest";
import { resolvePromoCode, getTier, buildQuote, TERM_TIERS, MAX_PROMO_DISCOUNT_RATIO } from "../src/data/pricing";

describe("resolvePromoCode", () => {
  it("resolves a known code", () => {
    const { promo } = resolvePromoCode("AEVION20", "lite");
    expect(promo?.code).toBe("AEVION20");
  });

  it("rejects an unknown code", () => {
    const { promo, reason } = resolvePromoCode("NOPE", "lite");
    expect(promo).toBeNull();
    expect(reason).toBe("promo_not_found");
  });

  it("rejects a code restricted to a different tier", () => {
    const { promo, reason } = resolvePromoCode("STARTUP50", "full"); // STARTUP50 is lite-only
    expect(promo).toBeNull();
    expect(reason).toBe("promo_tier_mismatch");
  });

  it("rejects an expired code", () => {
    const { promo, reason } = resolvePromoCode("EARLYBIRD", "lite"); // validUntil 2026-06-30
    expect(promo).toBeNull();
    expect(reason).toBe("promo_expired");
  });
});

describe("promo discount cap (MAX_PROMO_DISCOUNT_RATIO)", () => {
  // Regression for a real bug found 2026-07-23: TEAM100 (fixed -$100, Full-only)
  // zeroed Full's price entirely, because the fixed discount was scaled by the
  // billed months and exceeded the subtotal.
  //
  // С 15.09.2026 тариф — это срок, а фиксированный промокод применяется ОДИН раз
  // за покупку (buildQuote, шаг 6): «до $100» — это $100, а не $100 × 9 месяцев.
  // Потолок MAX_PROMO_DISCOUNT_RATIO по-прежнему держит любую скидку.
  function discountFor(subtotal: number, fixedAmount: number) {
    const raw = Math.min(subtotal, fixedAmount);
    return Math.min(raw, subtotal * MAX_PROMO_DISCOUNT_RATIO);
  }

  it("TEAM100 на Full (9 месяцев) срезает ровно $100 — один раз, а не за каждый месяц", () => {
    // Настоящий расчёт, а не пересказ формулы: так ловится и расхождение формулы с buildQuote.
    const full = getTier("full")!;
    const q = buildQuote({ tierId: "full", promoCode: "TEAM100" });
    expect(q.promo?.code, "TEAM100 не применился к Full").toBe("TEAM100");
    expect(q.subtotal).toBe(full.priceTermTotal);
    expect(q.promo!.applied, "фиксированная скидка умножена на срок").toBe(100);
    expect(q.promo!.applied).not.toBe(100 * full.termMonths!);
    expect(q.promo!.applied).toBeLessThanOrEqual(q.subtotal * MAX_PROMO_DISCOUNT_RATIO);
    expect(q.total, "промо-код обнулил тариф").toBeGreaterThan(0);
  });

  it("FRIEND10 на Max (12 месяцев) — $10, а не $120", () => {
    const q = buildQuote({ tierId: "max", promoCode: "FRIEND10" });
    expect(q.promo?.applied).toBe(10);
    expect(q.total).toBe(getTier("max")!.priceTermTotal! - 10);
  });

  it("never lets a fixed discount exceed the cap ratio of the subtotal — on every term", () => {
    for (const id of TERM_TIERS) {
      const total = getTier(id)!.priceTermTotal!;
      // Заведомо огромная фиксированная скидка: без потолка она обнулила бы счёт.
      const d = discountFor(total, 100_000);
      expect(d, `${id}: скидка выше потолка`).toBeLessThanOrEqual(total * MAX_PROMO_DISCOUNT_RATIO);
      expect(total - d, `${id}: счёт обнулён`).toBeGreaterThan(0);
    }
  });

  it("does not affect a small fixed discount that's already under the cap", () => {
    // FRIEND10 на Medium: $10 при половине счёта $525.
    const medium = getTier("medium")!;
    expect(discountFor(medium.priceTermTotal!, 10)).toBe(10);
    const q = buildQuote({ tierId: "medium", promoCode: "FRIEND10" });
    expect(q.promo?.applied, "маленькая скидка обрезана потолком или умножена на срок").toBe(10);
  });

  it("FRIEND10 на Lite больше НЕ обрезается — следствие переоценки 15.09.2026", () => {
    // До 15.09 Lite стоил $19, и $10 были больше половины чека — потолок срезал их.
    // При $400 за месяц $10 — мелочь, и срезать её значило бы недодать обещанное.
    const lite = getTier("lite")!;
    const q = buildQuote({ tierId: "lite", promoCode: "FRIEND10" });
    expect(q.promo?.applied).toBe(10);
    expect(lite.priceTermTotal! * MAX_PROMO_DISCOUNT_RATIO).toBeGreaterThan(10);
  });

  it("КОНТРОЛЬ: фиксированная скидка больше половины Lite — обрезается ровно до потолка", () => {
    // Без этого случая «потолок работает» проверялось бы только там, где он не нужен.
    const lite = getTier("lite")!;
    const d = discountFor(lite.priceTermTotal!, 300);
    expect(d).toBe(lite.priceTermTotal! * MAX_PROMO_DISCOUNT_RATIO);
    expect(d).toBeLessThan(300);
  });

  it("does not affect a percent discount already at exactly the cap", () => {
    const lite = getTier("lite")!;
    const raw = Math.round(lite.priceTermTotal! * 50) / 100; // STARTUP50 = 50%
    const capped = Math.min(raw, lite.priceTermTotal! * MAX_PROMO_DISCOUNT_RATIO);
    expect(capped).toBe(raw);
  });
});

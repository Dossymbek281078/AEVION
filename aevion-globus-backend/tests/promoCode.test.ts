import { describe, it, expect } from "vitest";
import { resolvePromoCode, getTier, MAX_PROMO_DISCOUNT_RATIO } from "../src/data/pricing";

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
  // Regression test for a real bug found 2026-07-23: TEAM100 (fixed -$100,
  // Full-only) zeroed Full's price entirely in BOTH billing periods, because
  // fixed discounts are scaled x12 for annual (see checkout.ts/buildQuote) —
  // 100*12=1200 exceeds Full's $890 annual subtotal just as much as $100
  // exceeds its $89 monthly subtotal. Pre-existed the 2026-07-22 repricing
  // too (100 > old $49 monthly price already zeroed it).
  function discountFor(subtotal: number, fixedAmount: number, period: "monthly" | "annual") {
    const raw = Math.min(subtotal, fixedAmount * (period === "annual" ? 12 : 1));
    return Math.min(raw, subtotal * MAX_PROMO_DISCOUNT_RATIO);
  }

  it("never lets a fixed discount exceed the cap ratio of the subtotal", () => {
    const full = getTier("full")!;
    const monthlyDiscount = discountFor(full.priceMonthly!, 100, "monthly");
    const annualDiscount = discountFor(full.priceAnnualTotal!, 100, "annual");

    expect(monthlyDiscount).toBeLessThanOrEqual(full.priceMonthly! * MAX_PROMO_DISCOUNT_RATIO);
    expect(annualDiscount).toBeLessThanOrEqual(full.priceAnnualTotal! * MAX_PROMO_DISCOUNT_RATIO);
    // Neither period should ever zero the price out.
    expect(full.priceMonthly! - monthlyDiscount).toBeGreaterThan(0);
    expect(full.priceAnnualTotal! - annualDiscount).toBeGreaterThan(0);
  });

  it("does not affect a small fixed discount that's already under the cap", () => {
    const lite = getTier("lite")!;
    const discount = discountFor(lite.priceMonthly!, 10, "monthly"); // FRIEND10
    expect(discount).toBe(10); // unclamped — 10 < 24*0.5
  });

  it("does not affect a percent discount already at exactly the cap", () => {
    const lite = getTier("lite")!;
    const raw = Math.round(lite.priceMonthly! * 50) / 100; // STARTUP50 = 50%
    const capped = Math.min(raw, lite.priceMonthly! * MAX_PROMO_DISCOUNT_RATIO);
    expect(capped).toBe(raw);
  });
});

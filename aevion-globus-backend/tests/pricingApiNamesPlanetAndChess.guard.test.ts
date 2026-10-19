/*
 * 🔴 19.10.2026 (цены «Планета», шаг 1): GET /api/pricing отдаёт ОДИН план явными полями
 * (perMonthUsd/totalUsd по пяти срокам) и шахматы отдельной карточкой $50/год.
 * Приёмка оркестратора (2026-10-19-priemka-ceny-planeta.mjs) читает именно эти поля;
 * подстрока «250» в большом JSON ничего не доказывает — числа здесь записаны литералами.
 */
import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { pricingRouter } from "../src/routes/pricing";

const app = () => { const a = express(); a.use(express.json()); a.use("/api/pricing", pricingRouter); return a; };

describe("/api/pricing: план «Планета» и шахматы явными полями", () => {
  test("🔴 plan.terms: 5 сроков, итоги 250/675/1200/1575/1800, месяц 250/225/200/175/150", async () => {
    const r = await request(app()).get("/api/pricing");
    expect(r.status).toBe(200);
    expect(r.body.plan?.id).toBe("planet");
    const terms = r.body.plan?.terms as Array<{ tierId: string; months: number; perMonthUsd: number; totalUsd: number }>;
    expect(terms?.length, "сроков").toBe(5);
    expect(terms.map((t) => t.tierId)).toEqual(["lite", "medium", "pro", "full", "max"]);
    expect(terms.map((t) => t.months)).toEqual([1, 3, 6, 9, 12]);
    expect(terms.map((t) => t.perMonthUsd)).toEqual([250, 225, 200, 175, 150]);
    expect(terms.map((t) => t.totalUsd)).toEqual([250, 675, 1200, 1575, 1800]);
    for (const t of terms) expect(t.totalUsd, `${t.tierId}: итог ≠ месяц × месяцы`).toBe(t.perMonthUsd * t.months);
  });
  test("🔴 19.10 помесячно при обязательстве: billing monthly, число платежей, цена вперёд со скидкой, лесенка отмены", async () => {
    const r = await request(app()).get("/api/pricing");
    expect(r.body.plan?.billing).toBe("monthly");
    const terms = r.body.plan.terms as Array<{ months: number; paymentsCount: number; prepayUsd: number; prepayDiscountPercent: number; totalUsd: number }>;
    expect(terms.map((t) => t.paymentsCount)).toEqual([1, 3, 6, 9, 12]);
    expect(terms.map((t) => t.prepayDiscountPercent)).toEqual([0, 5, 7.5, 10, 12.5]);
    expect(terms.map((t) => t.prepayUsd)).toEqual([250, 641.25, 1110, 1417.5, 1575]);
    for (const t of terms) expect(t.prepayUsd, `${t.months} мес: вперёд не дороже суммы платежей`).toBeLessThanOrEqual(t.totalUsd);
    const c = r.body.plan.earlyCancellation;
    expect(c.daysPerMonth).toBe(30);
    expect(c.daysPerYear).toBe(365);
    expect(c.ladder).toEqual([
      { tierId: "lite", fromDay: 0, usdPerMonth: 250 }, { tierId: "medium", fromDay: 90, usdPerMonth: 225 },
      { tierId: "pro", fromDay: 180, usdPerMonth: 200 }, { tierId: "full", fromDay: 270, usdPerMonth: 175 }, { tierId: "max", fromDay: 365, usdPerMonth: 150 },
    ]);
    expect(c.monthlySurcharge).toBe(true);
    expect(c.prepaidSurcharge).toBe(false);
    // FAQ больше не обещает «paid upfront» как единственный путь
    const faq = await request(app()).get("/api/pricing/faq");
    const texts = JSON.stringify(faq.body);
    expect(texts.includes("paid upfront")).toBe(false);
    expect(texts.includes("billed monthly")).toBe(true);
  });
  test("🔴 chess: $50 в год", async () => {
    const r = await request(app()).get("/api/pricing");
    expect(r.body.chess).toEqual({ id: "cyberchess", priceUsd: 50, period: "year" });
  });
  test("tiers (старое поле) согласованы с plan: те же месяцы и итоги", async () => {
    const r = await request(app()).get("/api/pricing");
    const tiers = (r.body.tiers as Array<{ id: string; priceMonthly: number; priceTermTotal: number }>).filter((t) => ["lite", "medium", "pro", "full", "max"].includes(t.id));
    const plan = r.body.plan.terms as Array<{ tierId: string; perMonthUsd: number; totalUsd: number }>;
    for (const p of plan) {
      const t = tiers.find((x) => x.id === p.tierId)!;
      expect(t.priceMonthly, p.tierId).toBe(p.perMonthUsd);
      expect(t.priceTermTotal, p.tierId).toBe(p.totalUsd);
    }
  });
});

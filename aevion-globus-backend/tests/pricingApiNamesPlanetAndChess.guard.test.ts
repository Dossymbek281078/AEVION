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

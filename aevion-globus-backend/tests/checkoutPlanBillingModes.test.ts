/*
 * 🔴 19.10.2026, вариант «Б» (оркестратор 23:1x): план «Планета» продаётся без новых
 * товаров в кассе. Помесячно при обязательстве — вариантом tier_lite (интервал месяц)
 * с подменой цены на цену месяца срока и custom_data {term, billing}; вперёд —
 * вариантом своего срока с подменой цены на скидочную сумму. Без поля billing —
 * прежний путь (смета за срок). Помесячно умеет только LS: без него — 503, а не
 * разовая касса с ценой месяца.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

process.env.NODE_ENV = "test";
process.env.LEMON_SQUEEZY_API_KEY = "k";
process.env.LEMON_SQUEEZY_STORE_ID = "s";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "w";
process.env.LEMON_SQUEEZY_VARIANT_LITE = "7001";
process.env.LEMON_SQUEEZY_VARIANT_MEDIUM = "7003";
process.env.LEMON_SQUEEZY_VARIANT_MAX = "7012";
delete process.env.LEMON_SQUEEZY_VARIANT_PRO;
for (const k of ["PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET"]) delete process.env[k];
// Разовой кассы Gumroad здесь нет намеренно: план вперёд без варианта срока обязан
// дать 503, а не уйти в Gumroad с ценой ЕГО товара (сумма туда не доезжает).
delete process.env.GUMROAD_DEFAULT_PERMALINK;

type Intent = { reference: string; amountCents: number; customPriceCents?: number; customData?: Record<string, string>; description: string };
const { seen } = vi.hoisted(() => ({ seen: { ls: null as Intent | null, gumroad: null as Intent | null } }));
vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    createIntent: async (input: Intent) => { seen.ls = input; return { intentId: "ls1", checkoutUrl: "https://ls.test/checkout" }; },
  },
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: {
    id: "gumroad",
    createIntent: async (input: Intent) => { seen.gumroad = input; return { intentId: "g1", checkoutUrl: "https://gumroad.test/l/x" }; },
  },
  gumroadSellable: () => ({ configured: [], missing: [] }),
}));

const { checkoutRouter } = await import("../src/routes/checkout");
const { planetCheckoutVariant, planetBillingSellable, expectedPlanetChargeUsd } = await import("../src/data/lemonSqueezyVariants");

function app() { const a = express(); a.use(express.json()); a.use("/api/pricing/checkout", checkoutRouter); return a; }
async function post(body: Record<string, unknown>) {
  seen.ls = null; seen.gumroad = null;
  return request(app()).post("/api/pricing/checkout/session").set("accept-language", "ru").send(body);
}

beforeEach(() => { seen.ls = null; seen.gumroad = null; });

describe("данные варианта Б", () => {
  test("помесячно — вариант tier_lite и цена месяца срока; вперёд — свой срок и скидочная сумма", () => {
    expect(planetCheckoutVariant("medium", "monthly")).toEqual({ reference: "tier_lite", variantId: "7001", chargeUsd: 225, customData: { term: "medium", billing: "monthly" } });
    expect(planetCheckoutVariant("max", "monthly")).toMatchObject({ reference: "tier_lite", chargeUsd: 150 });
    expect(planetCheckoutVariant("medium", "prepaid")).toEqual({ reference: "tier_medium", variantId: "7003", chargeUsd: 641.25, customData: { term: "medium", billing: "prepaid" } });
    expect(planetCheckoutVariant("max", "prepaid")).toMatchObject({ reference: "tier_max", variantId: "7012", chargeUsd: 1575 });
    // без срока «вперёд» сводится к помесячному — скидки нет
    expect(planetCheckoutVariant("lite", "prepaid")).toMatchObject({ reference: "tier_lite", chargeUsd: 250, customData: { term: "lite", billing: "monthly" } });
  });
  test("продаваемость: помесячно держится на tier_lite, вперёд — на варианте срока", () => {
    expect(planetBillingSellable("medium")).toEqual({ monthly: true, prepaid: true });
    expect(planetBillingSellable("pro")).toEqual({ monthly: true, prepaid: false }); // PRO не задан
    expect(planetBillingSellable("lite")).toEqual({ monthly: true, prepaid: false });
  });
  test("ожидаемая сумма вебхука: пара {term, billing}; чужое — null", () => {
    expect(expectedPlanetChargeUsd("max", "monthly")).toBe(150);
    expect(expectedPlanetChargeUsd("max", "prepaid")).toBe(1575);
    expect(expectedPlanetChargeUsd("lite", "prepaid")).toBeNull();
    expect(expectedPlanetChargeUsd("enterprise", "monthly")).toBeNull();
    expect(expectedPlanetChargeUsd("max", "weekly")).toBeNull();
    expect(expectedPlanetChargeUsd(undefined, "monthly")).toBeNull();
  });
});

describe("касса: режим списания плана", () => {
  test("medium помесячно → вариант Lite, custom_price 22500, custom_data term/billing, имя называет режим", async () => {
    const r = await post({ tierId: "medium", billing: "monthly" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.provider).toBe("lemonsqueezy");
    expect(seen.ls?.reference).toBe("tier_lite");
    expect(seen.ls?.customPriceCents).toBe(22500);
    expect(seen.ls?.amountCents).toBe(22500);
    expect(seen.ls?.customData).toMatchObject({ term: "medium", billing: "monthly" });
    expect(seen.ls?.description).toContain("помесячно");
    expect(seen.gumroad).toBeNull();
  });
  test("max вперёд → вариант Max, custom_price 157500 (−12,5 %), имя «вперёд»", async () => {
    const r = await post({ tierId: "max", billing: "prepaid" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(seen.ls?.reference).toBe("tier_max");
    expect(seen.ls?.customPriceCents).toBe(157500);
    expect(seen.ls?.customData).toMatchObject({ term: "max", billing: "prepaid" });
    expect(seen.ls?.description).toContain("вперёд");
  });
  test("medium вперёд → 64125 центов, ровно 641.25", async () => {
    const r = await post({ tierId: "medium", billing: "prepaid" });
    expect(r.status).toBe(200);
    expect(seen.ls?.customPriceCents).toBe(64125);
  });
  test("без поля billing — прежний путь: вариант срока и сумма за срок из сметы (675)", async () => {
    const r = await post({ tierId: "medium" });
    expect(r.status).toBe(200);
    expect(seen.ls?.reference).toBe("tier_medium");
    expect(seen.ls?.customPriceCents).toBe(67500);
    expect(seen.ls?.customData?.term).toBeUndefined();
  });
  test("неизвестный режим — 400, касса не вызвана", async () => {
    const r = await post({ tierId: "medium", billing: "weekly" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_billing");
    expect(seen.ls).toBeNull();
  });
  test("вперёд на сроке без варианта (pro) — честный 503, не вариант Lite с чужим интервалом", async () => {
    const r = await post({ tierId: "pro", billing: "prepaid" });
    expect(r.status).toBe(503);
    expect(seen.ls).toBeNull();
  });
  test("помесячно, когда LS не выдаёт (нет секрета вебхука) — 503 monthly_billing_unavailable, разовая касса не вызвана", async () => {
    const было = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    try {
      const r = await post({ tierId: "medium", billing: "monthly" });
      expect(r.status).toBe(503);
      expect(r.body.error).toBe("monthly_billing_unavailable");
      expect(seen.ls).toBeNull();
      expect(seen.gumroad).toBeNull();
    } finally { process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = было; }
  });
  test("КОНТРОЛЬ старого пути: приложение без своего варианта по-прежнему идёт вариантом Lite с ценой приложения и module, без term", async () => {
    const { STANDALONE_APPS } = await import("../src/data/pricing");
    const { продаётсяОтдельно } = await import("../src/data/moduleAccess");
    const кандидат = STANDALONE_APPS.find((a) => a.yearOnlyUsd == null && продаётсяОтдельно(a.moduleId) && !process.env[`LEMON_SQUEEZY_VARIANT_${a.slug.toUpperCase()}_LITE`]);
    if (!кандидат) { console.warn("нет приложения на запасном пути — контроль не состоялся"); return; }
    const r = await post({ tierId: "lite", app: кандидат.slug });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(seen.ls?.reference).toBe("tier_lite");
    expect(seen.ls?.customPriceCents).toBe(Math.round(кандидат.baseMonthly * 100));
    expect(seen.ls?.customData).toMatchObject({ module: кандидат.slug });
    expect(seen.ls?.customData?.term).toBeUndefined();
  });
});

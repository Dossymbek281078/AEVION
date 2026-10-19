/**
 * 🔴 19.10.2026 — КАССА LEMON SQUEEZY СПИСЫВАЕТ НАШУ СУММУ, А НЕ ЦЕНУ ВАРИАНТА.
 *
 * Замер того дня (окно Продукт, railway run → GET /v1/variants): варианты планеты
 * в магазине несли прежнюю лесенку — Lite $400 / 1 мес, Max $2400 / 12 мес, —
 * а витрина уже показывала новую: $250 и $1800. Замер Продаж 18:26 браузером:
 * корзина открывалась на $400. Раньше `custom_price` уходил в кассу ТОЛЬКО
 * запасным путём (приложение без своего варианта); обычная покупка планеты
 * брала цену товара магазина, и покупатель платил не то, что ему назвали.
 *
 * Два уровня:
 *   1. routes/checkout.ts отдаёт провайдеру customPriceCents = totalCents всегда;
 *   2. lemonSqueezyProvider кладёт его в тело POST /checkouts как custom_price.
 * Плюс шахматы: продаются только на 12 месяцев за $50 — другой срок даёт 400
 * term_not_sold, и касса не вызывается вовсе.
 */
import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const созданные: any[] = [];
vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    async createIntent(input: any) {
      созданные.push(input);
      return { intentId: "test-intent", checkoutUrl: "https://example.test/checkout/custom/uuid" };
    },
  },
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const прежние = { ...process.env };

async function приложение() {
  const { checkoutRouter } = await import("../src/routes/checkout");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
  return app;
}

describe("касса LS получает НАШУ сумму (custom_price) — 19.10.2026", () => {
  beforeEach(() => {
    созданные.length = 0;
    vi.resetModules();
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "1";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-secret";
    for (const t of ["LITE", "MEDIUM", "PRO", "FULL", "MAX"]) process.env[`LEMON_SQUEEZY_VARIANT_${t}`] = "111111";
    process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_MAX = "222222";
    delete process.env.PAYBOX_MERCHANT_ID;
    delete process.env.PAYPAL_CLIENT_ID;
  });
  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in прежние)) delete process.env[k];
    Object.assign(process.env, прежние);
  });

  test("планета: каждая ступень уходит в кассу с суммой лесенки плана, а не с ценой товара магазина", async () => {
    const { planetTotal, TERM_TIERS } = await import("../src/data/pricing");
    const app = await приложение();
    const суммы: Record<string, number> = {};
    for (const t of TERM_TIERS) {
      созданные.length = 0;
      const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: t, seats: 1, currency: "USD" });
      expect(r.status, `${t}: ${JSON.stringify(r.body)}`).toBe(200);
      expect(созданные, `${t}: касса не вызвана`).toHaveLength(1);
      expect(созданные[0].reference).toBe(`tier_${t}`);
      expect(созданные[0].customPriceCents, `${t}: в кассу не ушла наша сумма`).toBe(planetTotal(t) * 100);
      expect(созданные[0].amountCents).toBe(созданные[0].customPriceCents);
      суммы[t] = созданные[0].customPriceCents;
    }
    // Литералы слова основателя 19.10 — чтобы лесенка в данных не уехала молча.
    expect(суммы).toEqual({ lite: 25000, medium: 67500, pro: 120000, full: 157500, max: 180000 });
  });

  test("шахматы: только 12 месяцев за $50 — в кассу уходит 5000 центов", async () => {
    const app = await приложение();
    const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: "max", app: "cyberchess", seats: 1, currency: "USD" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(созданные).toHaveLength(1);
    expect(созданные[0].reference).toBe("app_cyberchess_max");
    expect(созданные[0].customPriceCents).toBe(5000);
  });

  test("шахматы на другом сроке: 400 term_not_sold, касса не вызывается", async () => {
    const app = await приложение();
    for (const t of ["lite", "medium", "pro", "full"]) {
      созданные.length = 0;
      const r = await request(app).post("/api/pricing/checkout/session").send({ tierId: t, app: "cyberchess", seats: 1, currency: "USD" });
      expect(r.status, `${t}: ${JSON.stringify(r.body)}`).toBe(400);
      expect(r.body.error).toBe("term_not_sold");
      expect(r.body.soldMonths).toEqual([12]);
      expect(созданные, `${t}: касса вызвана на непродаваемом сроке`).toHaveLength(0);
    }
  });
});

describe("провайдер LS кладёт custom_price в тело запроса к магазину", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../src/lib/payment/lemonSqueezyProvider");
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "1";
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "111111";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(process.env)) if (!(k in прежние)) delete process.env[k];
    Object.assign(process.env, прежние);
  });

  async function телоЗапроса(customPriceCents: number | undefined) {
    const тела: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      тела.push(JSON.parse(String(init?.body ?? "{}")));
      return { ok: true, json: async () => ({ data: { id: "ls-1", attributes: { url: "https://aevion.lemonsqueezy.com/checkout/custom/x" } } }) } as Response;
    }));
    const { lemonSqueezyPaymentProvider } = await import("../src/lib/payment/lemonSqueezyProvider");
    await lemonSqueezyPaymentProvider.createIntent({
      reference: "tier_lite", amountCents: 25000, currency: "USD", description: "AEVION Planet Lite — 1 month",
      email: null, customPriceCents,
    } as any);
    expect(тела, "запрос к магазину не ушёл").toHaveLength(1);
    return тела[0];
  }

  test("наша сумма → custom_price в центах", async () => {
    const тело = await телоЗапроса(25000);
    expect(тело.data.attributes.custom_price).toBe(25000);
    expect(тело.data.relationships.variant.data.id).toBe("111111");
  });

  test("КОНТРОЛЬ: без суммы поля custom_price нет (касса возьмёт цену товара — так было до 19.10)", async () => {
    const тело = await телоЗапроса(undefined);
    expect("custom_price" in тело.data.attributes).toBe(false);
  });
});

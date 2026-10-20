/*
 * 🔴 20.10.2026: месячные варианты плана «Планета». Замер Продаж: помесячная касса
 * через вариант tier_lite показывала «(AEVION Planet — Lite (1 mo))» и серую строку
 * «$250.00 billed every month» при цене $150. Основатель заводит 4 варианта с
 * интервалом month; их id — в LEMON_SQUEEZY_VARIANT_PLANET_<T>_MONTHLY.
 *
 * Держим: переменная задана → свой месячный вариант; пуста/не задана → прежний
 * tier_lite. custom_price и custom_data {term, billing} — в ОБОИХ путях. lite всегда
 * tier_lite. Вебхук берёт ступень из custom_data.term, а не из variant_id.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

const SECRET = "test-ls-secret-monthly";
process.env.NODE_ENV = "test";
process.env.LEMON_SQUEEZY_API_KEY = "k";
process.env.LEMON_SQUEEZY_STORE_ID = "s";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "9001";
for (const k of ["PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET", "GUMROAD_DEFAULT_PERMALINK"]) delete process.env[k];

const МЕСЯЧНЫЕ = {
  medium: { env: "LEMON_SQUEEZY_VARIANT_PLANET_MEDIUM_MONTHLY", id: "9103", usd: 225 },
  pro: { env: "LEMON_SQUEEZY_VARIANT_PLANET_PRO_MONTHLY", id: "9106", usd: 200 },
  full: { env: "LEMON_SQUEEZY_VARIANT_PLANET_FULL_MONTHLY", id: "9109", usd: 175 },
  max: { env: "LEMON_SQUEEZY_VARIANT_PLANET_MAX_MONTHLY", id: "9112", usd: 150 },
} as const;
type Ступень = keyof typeof МЕСЯЧНЫЕ;
const СТУПЕНИ = Object.keys(МЕСЯЧНЫЕ) as Ступень[];
// Прежние переменные …_MEDIUM_MONTHLY на проде заданы старыми товарами — новый путь
// их НЕ читает. Ставим их сюда, чтобы контроль это держал.
const ПРЕЖНИЕ = { LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY: "8803", LEMON_SQUEEZY_VARIANT_PRO_MONTHLY: "8806", LEMON_SQUEEZY_VARIANT_FULL_MONTHLY: "8809" };

type Intent = { reference: string; amountCents: number; customPriceCents?: number; customData?: Record<string, string>; description: string };
const { seen, mockQuery, mockProvision } = vi.hoisted(() => ({
  seen: { ls: null as Intent | null },
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));
vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    createIntent: async (input: Intent) => { seen.ls = input; return { intentId: "ls1", checkoutUrl: "https://ls.test/checkout" }; },
  },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({ provisionSubscription: mockProvision, writeSubscription: vi.fn() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { checkoutRouter } = await import("../src/routes/checkout");
const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { planetCheckoutVariant, planetBillingSellable, resolveLemonSqueezyVariant, referenceForVariantId } =
  await import("../src/data/lemonSqueezyVariants");

function задатьМесячные(значение: (t: Ступень) => string | undefined) {
  for (const t of СТУПЕНИ) {
    const v = значение(t);
    if (v === undefined) delete process.env[МЕСЯЧНЫЕ[t].env];
    else process.env[МЕСЯЧНЫЕ[t].env] = v;
  }
}
async function касса(body: Record<string, unknown>) {
  seen.ls = null;
  const a = express(); a.use(express.json()); a.use("/api/pricing/checkout", checkoutRouter);
  return request(a).post("/api/pricing/checkout/session").set("accept-language", "ru").send(body);
}
let n = 0;
function вебхук(custom: Record<string, string>, variantId: string, totalCents: number) {
  n += 1;
  const raw = JSON.stringify({
    meta: { event_name: "subscription_created", custom_data: custom },
    data: { id: `sub_monthly_${n}`, attributes: { user_email: "buyer@test.aev", variant_id: variantId, total: totalCents } },
  });
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const a = express(); a.use(express.json()); a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(a).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

beforeEach(() => {
  Object.assign(process.env, ПРЕЖНИЕ);
  mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset(); mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
});
afterEach(() => { задатьМесячные(() => undefined); for (const k of Object.keys(ПРЕЖНИЕ)) delete process.env[k]; });

describe("planetCheckoutVariant: месячный вариант из переменной окружения", () => {
  for (const t of СТУПЕНИ) {
    test(`${t}: переменная задана → tier_${t}_monthly, ${МЕСЯЧНЫЕ[t].id}, $${МЕСЯЧНЫЕ[t].usd}`, () => {
      задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
      expect(planetCheckoutVariant(t, "monthly")).toEqual({
        reference: `tier_${t}_monthly`, variantId: МЕСЯЧНЫЕ[t].id, chargeUsd: МЕСЯЧНЫЕ[t].usd,
        customData: { term: t, billing: "monthly" },
      });
    });
    test(`${t}: переменная не задана → запасной tier_lite, $${МЕСЯЧНЫЕ[t].usd}`, () => {
      задатьМесячные(() => undefined);
      expect(planetCheckoutVariant(t, "monthly")).toEqual({
        reference: "tier_lite", variantId: "9001", chargeUsd: МЕСЯЧНЫЕ[t].usd,
        customData: { term: t, billing: "monthly" },
      });
    });
  }
  test("КОНТРОЛЬ: пустая строка и пробелы — как не задана (запасной tier_lite)", () => {
    задатьМесячные(() => "");
    for (const t of СТУПЕНИ) expect(planetCheckoutVariant(t, "monthly").reference).toBe("tier_lite");
    задатьМесячные(() => "   ");
    for (const t of СТУПЕНИ) expect(planetCheckoutVariant(t, "monthly").reference).toBe("tier_lite");
  });
  test("КОНТРОЛЬ: прежние …_MEDIUM_MONTHLY (товары до 15.09) не продаются", () => {
    задатьМесячные(() => undefined);
    expect(resolveLemonSqueezyVariant("tier_medium_monthly")).toBeNull();
    expect(planetCheckoutVariant("medium", "monthly").variantId).toBe("9001");
  });
  test("lite всегда tier_lite, даже при всех месячных и при prepaid", () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    expect(planetCheckoutVariant("lite", "monthly")).toMatchObject({ reference: "tier_lite", chargeUsd: 250 });
    expect(planetCheckoutVariant("lite", "prepaid")).toMatchObject({ reference: "tier_lite", customData: { billing: "monthly" } });
  });
  test("вперёд месячный вариант не берёт", () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    expect(planetCheckoutVariant("max", "prepaid").reference).toBe("tier_max");
  });
  test("sellable.monthly: месячный ИЛИ lite", () => {
    задатьМесячные(() => undefined);
    expect(planetBillingSellable("medium").monthly).toBe(true);
    const lite = process.env.LEMON_SQUEEZY_VARIANT_LITE;
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE;
    try {
      expect(planetBillingSellable("medium").monthly).toBe(false);
      process.env[МЕСЯЧНЫЕ.medium.env] = МЕСЯЧНЫЕ.medium.id;
      expect(planetBillingSellable("medium").monthly).toBe(true);
      expect(planetBillingSellable("pro").monthly).toBe(false);
    } finally { process.env.LEMON_SQUEEZY_VARIANT_LITE = lite; }
  });
  test("обратный поиск: новый и прежний id — одна ссылка tier_medium_monthly", () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    expect(referenceForVariantId("9103")).toBe("tier_medium_monthly");
    expect(referenceForVariantId("8803")).toBe("tier_medium_monthly");
    expect(referenceForVariantId("9112")).toBe("tier_max_monthly");
  });
});

describe("касса: custom_price и custom_data в обоих путях", () => {
  for (const t of СТУПЕНИ) {
    test(`${t} помесячно, месячный вариант задан → reference tier_${t}_monthly, custom_price ${МЕСЯЧНЫЕ[t].usd * 100}`, async () => {
      задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
      const r = await касса({ tierId: t, billing: "monthly" });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(seen.ls?.reference).toBe(`tier_${t}_monthly`);
      expect(seen.ls?.customPriceCents).toBe(МЕСЯЧНЫЕ[t].usd * 100);
      expect(seen.ls?.customData).toMatchObject({ term: t, billing: "monthly" });
    });
    test(`${t} помесячно, месячного нет → tier_lite, custom_price ${МЕСЯЧНЫЕ[t].usd * 100}`, async () => {
      задатьМесячные(() => undefined);
      const r = await касса({ tierId: t, billing: "monthly" });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(seen.ls?.reference).toBe("tier_lite");
      expect(seen.ls?.customPriceCents).toBe(МЕСЯЧНЫЕ[t].usd * 100);
      expect(seen.ls?.customData).toMatchObject({ term: t, billing: "monthly" });
    });
  }
});

describe("вебхук: ступень из custom_data.term, не из variant_id", () => {
  test("месячный вариант medium + term=medium/monthly + $225 → medium на 3 месяца", async () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    const r = await вебхук({ term: "medium", billing: "monthly" }, "9103", 22500);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.tierId).toBe("medium");
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "medium", termMonths: 3, amountUsd: 225 });
  });
  test("месячный вариант max + term=max/monthly + $150 → max на 12 месяцев", async () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    const r = await вебхук({ term: "max", billing: "monthly" }, "9112", 15000);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ tierId: "max", termMonths: 12 });
  });
  test("🔴 месячный вариант medium с подделанным term=max/prepaid и $225 → 409, доступа нет", async () => {
    задатьМесячные((x) => МЕСЯЧНЫЕ[x].id);
    const r = await вебхук({ term: "max", billing: "prepaid" }, "9103", 22500);
    expect(r.status).toBe(409);
    expect(mockProvision).not.toHaveBeenCalled();
  });
});

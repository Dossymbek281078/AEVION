/*
 * 🔴 19.10.2026 (замер Продаж 23:1x): касса не знала аккаунт покупателя — в LS уходил
 * email null, подписка привязывалась к адресу, набранному в кассе, а бесплатная норма
 * снимается по почте из токена: заплатил одним адресом, входит другим — норма 3, молча.
 * Теперь почта вошедшего (Bearer) предзаполняет кассу и едет в custom_data.accountEmail;
 * вебхук выдаёт доступ ей. Без входа — как прежде.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = "test-jwt-secret-account-email";
process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = SECRET;
process.env.LEMON_SQUEEZY_API_KEY = "k";
process.env.LEMON_SQUEEZY_STORE_ID = "s";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "wh-secret-account-email";
process.env.LEMON_SQUEEZY_VARIANT_LITE = "7101";
process.env.LEMON_SQUEEZY_VARIANT_MEDIUM = "7103";
for (const k of ["PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET", "GUMROAD_DEFAULT_PERMALINK"]) delete process.env[k];

type Intent = { reference: string; email: string | null; customData?: Record<string, string> };
const { seen, mockQuery, mockProvision } = vi.hoisted(() => ({ seen: { ls: null as Intent | null }, mockQuery: vi.fn(), mockProvision: vi.fn() }));
vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    createIntent: async (input: Intent) => { seen.ls = input; return { intentId: "ls1", checkoutUrl: "https://ls.test/checkout" }; },
  },
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: { id: "gumroad", createIntent: async () => ({ intentId: "g1", checkoutUrl: "https://gumroad.test/l/x" }) },
  gumroadSellable: () => ({ configured: [], missing: [] }),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({ provisionSubscription: mockProvision, writeSubscription: vi.fn() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { checkoutRouter } = await import("../src/routes/checkout");
const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

function app() { const a = express(); a.use(express.json()); a.use("/api/pricing/checkout", checkoutRouter); a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter); return a; }
const токен = (email: string) => jwt.sign({ sub: "u-1", email, role: "user" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });
async function checkout(body: Record<string, unknown>, bearer?: string) {
  seen.ls = null;
  const r = request(app()).post("/api/pricing/checkout/session").send(body);
  return bearer ? r.set("Authorization", `Bearer ${bearer}`) : r;
}
let n = 0;
function webhook(custom: Record<string, string> | undefined, userEmail: string) {
  n += 1;
  const payload = { meta: { event_name: "subscription_created", ...(custom ? { custom_data: custom } : {}) }, data: { id: `sub_ae_${n}`, attributes: { user_email: userEmail, variant_id: "7101", total: 25000 } } };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!).update(raw, "utf8").digest("hex");
  return request(app()).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); mockProvision.mockReset(); mockProvision.mockResolvedValue({ subscription: { id: "s1" } }); });

describe("касса знает аккаунт покупателя", () => {
  test("с Bearer: почта аккаунта предзаполняет кассу и едет в custom_data.accountEmail", async () => {
    const r = await checkout({ tierId: "medium", billing: "monthly" }, токен("Owner@Bureau.kz"));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(seen.ls?.email).toBe("owner@bureau.kz");
    expect(seen.ls?.customData).toMatchObject({ accountEmail: "owner@bureau.kz", term: "medium", billing: "monthly" });
  });
  test("с Bearer почта аккаунта сильнее адреса из тела", async () => {
    await checkout({ tierId: "lite", email: "typed@elsewhere.test" }, токен("owner@bureau.kz"));
    expect(seen.ls?.email).toBe("owner@bureau.kz");
  });
  test("КОНТРОЛЬ: без входа — как прежде: email из тела или null, accountEmail нет", async () => {
    await checkout({ tierId: "lite" });
    expect(seen.ls?.email).toBeNull();
    expect(seen.ls?.customData?.accountEmail).toBeUndefined();
    await checkout({ tierId: "lite", email: "typed@elsewhere.test" });
    expect(seen.ls?.email).toBe("typed@elsewhere.test");
  });
  test("КОНТРОЛЬ: чужой/битый токен не даёт почты", async () => {
    await checkout({ tierId: "lite" }, jwt.sign({ sub: "u-2", email: "evil@x.test", role: "user" }, "other-secret", { algorithm: "HS256" }));
    expect(seen.ls?.email).toBeNull();
  });
});

describe("вебхук: доступ открывается почте аккаунта", () => {
  test("custom_data.accountEmail есть → подписка на неё, а не на адрес из кассы", async () => {
    const r = await webhook({ accountEmail: "owner@bureau.kz" }, "card-holder@gmail.com");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ email: "owner@bureau.kz" });
  });
  test("КОНТРОЛЬ: accountEmail нет → как прежде, адрес из кассы", async () => {
    await webhook(undefined, "card-holder@gmail.com");
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ email: "card-holder@gmail.com" });
  });
  test("КОНТРОЛЬ: accountEmail не похож на адрес → игнорируется", async () => {
    await webhook({ accountEmail: "not-an-email" }, "card-holder@gmail.com");
    expect(mockProvision.mock.calls[0][0]).toMatchObject({ email: "card-holder@gmail.com" });
  });
});

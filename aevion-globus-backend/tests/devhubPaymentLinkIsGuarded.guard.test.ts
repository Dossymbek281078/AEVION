/**
 * POST /media/payment-link — три замка на денежной ручке.
 *
 * Дыра с 28.07.2026 (патч окна free-fleet лежал неприменённым 7 недель), доведена
 * до денег окном приёмки 14–15.09.2026: без входа создавалась ссылка в НАШЕМ
 * магазине LemonSqueezy на товар по умолчанию с ценой из тела от 50 центов; товар по
 * умолчанию на проде — DevHub Studio Pro, а вебхук по нему выдаёт Pro без сверки
 * суммы. Pro ($149/мес) за $0.50 любому посетителю.
 *
 * DevHub намеренно работает без входа (покупка привязывается к браузеру гостя через
 * /devhub/link), поэтому замок — по тарифу: бесплатному гостю 402 с адресом привязки,
 * вошедшему и гостю с покупкой — можно.
 *
 * Здесь закреплено: бесплатный гость — 402 и ноль обращений к LemonSqueezy; товар — только
 * отдельный (LEMON_SQUEEZY_PAYLINK_VARIANT_ID), никогда не Studio Pro и не товар по
 * умолчанию (503 «не настроено», не тихая подмена); адрес возврата — только свой домен.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __setUserTierForTest } from "../src/routes/devhub";

const ENV = ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_DEFAULT_VARIANT_ID", "LEMON_SQUEEZY_PAYLINK_VARIANT_ID", "LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO", "FRONTEND_URL", "AUTH_JWT_SECRET"];
const было: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let ip = 0;

function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => { ip += 1; req.headers["x-forwarded-for"] = `10.13.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`; next(); });
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}
function bearer(sub = "u-1") {
  return { Authorization: `Bearer ${jwt.sign({ sub, email: `${sub}@test.dev` }, "dev-auth-secret", { algorithm: "HS256" })}` };
}
function lsResp() {
  return { ok: true, status: 200, json: async () => ({ data: { id: "co_1", attributes: { url: "https://store.lemonsqueezy.com/checkout/co_1" } } }), text: async () => "" };
}

beforeEach(() => {
  __resetDevHubStore();
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  process.env.LEMON_SQUEEZY_API_KEY = "ls_fake";
  process.env.LEMON_SQUEEZY_STORE_ID = "1";
  fetchMock = vi.fn(async () => lsResp());
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
});

const GOOD = { name: "Консультация", amountCents: 5000 };

describe("замок 1: бесплатному гостю — 402; вошедшему и гостю с покупкой — можно", () => {
  test("без токена (бесплатный гость) — 402 с адресом привязки, к LemonSqueezy ни одного запроса", async () => {
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "paylink-1";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").send(GOOD);
    expect(r.status).toBe(402);
    expect(r.body.upgrade).toBe("/devhub/link");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("мусорный токен — тоже 402 (это гость)", async () => {
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "paylink-1";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set({ Authorization: "Bearer not-a-jwt" }).send(GOOD);
    expect(r.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("гость с тарифом pro (привязал покупку) — ссылка создаётся", async () => {
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "paylink-1";
    __setUserTierForTest("guest:guest-pro-1", "pro");
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set({ "x-devhub-guest": "guest-pro-1" }).send(GOOD);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });

  test("КОНТРОЛЬ: с токеном и отдельным товаром ссылка создаётся на ЭТОМ товаре с меткой paylink", async () => {
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "paylink-1";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "studio-pro-1";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set(bearer()).send(GOOD);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data.relationships.variant.data.id).toBe("paylink-1");
    expect(body.data.attributes.checkout_data.custom.aevion_paylink).toBe("1");
    expect(body.data.attributes.custom_price).toBe(5000);
  });
});

describe("замок 2: товар — только отдельный, никогда Studio Pro и не товар по умолчанию", () => {
  test("PAYLINK-переменная не задана, а DEFAULT есть — 503 «не настроено», подмены товаром по умолчанию НЕТ", async () => {
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "studio-pro-1";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set(bearer()).send(GOOD);
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/LEMON_SQUEEZY_PAYLINK_VARIANT_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("PAYLINK указывает на Studio Pro — 503, вебхук выдал бы Pro за любую цену", async () => {
    process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "studio-pro-1";
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "studio-pro-1";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set(bearer()).send(GOOD);
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/Studio Pro/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("PAYLINK равен товару по умолчанию — 503 (на проде они и есть Studio Pro)", async () => {
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "v-default";
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "v-default";
    const r = await request(makeApp()).post("/api/devhub/media/payment-link").set(bearer()).send(GOOD);
    expect(r.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("замок 3: адрес возврата — только свой домен", () => {
  test("чужой successUrl заменяется на свой; свой относительный — принимается", async () => {
    process.env.LEMON_SQUEEZY_PAYLINK_VARIANT_ID = "paylink-1";
    process.env.FRONTEND_URL = "https://aevion.app";
    const app = makeApp();
    await request(app).post("/api/devhub/media/payment-link").set(bearer()).send({ ...GOOD, successUrl: "https://evil.example/thanks" });
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data.attributes.product_options.redirect_url).toBe("https://aevion.app/devhub?payment=success");

    await request(app).post("/api/devhub/media/payment-link").set(bearer()).send({ ...GOOD, successUrl: "/devhub/p/123?paid=1" });
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.data.attributes.product_options.redirect_url).toBe("https://aevion.app/devhub/p/123?paid=1");
  });
});

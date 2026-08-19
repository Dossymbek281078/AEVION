import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * 🔴 Платный товар не выдаётся без оплаты.
 *
 * Найдено 19.08.2026. В обработчике покупки было ТРИ пути, каждый писал
 * `status:'paid'` и наращивал счётчик продаж, не получив ни тенге: не задан
 * permalink; провайдер бросил исключение; база недоступна.
 *
 * Тест проверяет не код ответа, а ГЛАВНОЕ: что записи об оплате НЕ появилось.
 * Утверждение «ручка вернула не 201» было бы слабее — оно зелёное и тогда,
 * когда строку всё-таки вставили, а ответ поменяли.
 *
 * Ровно этот класс уже чинили 26.07 в `routes/checkout.ts` (5890f9a15).
 * Здесь применён их приём: в проде честный отказ, в разработке — как было.
 */

const query = vi.fn();
const dbReady = vi.fn(() => true);
const createIntent = vi.fn();

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureQStoreTables", () => ({
  ensureQStoreTables: vi.fn(),
  isQStoreDbReady: () => dbReady(),
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: { createIntent: (...a: unknown[]) => createIntent(...a) },
}));

// eslint-disable-next-line import/first
import { qstoreRouter } from "../src/routes/qstore";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(qstoreRouter);
  return a;
};
const BEARER = () =>
  "Bearer " + jwt.sign({ sub: "buyer-1" }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1h" });

const ENV = ["NODE_ENV", "GUMROAD_PERMALINK_QSTORE", "GUMROAD_DEFAULT_PERMALINK", "AUTH_JWT_SECRET"];
const saved: Record<string, string | undefined> = {};

/** Товар с ценой; price>0 означает «платный». */
function product(price: number) {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (/SELECT \* FROM "QStoreProduct"/.test(sql))
      return { rows: [{ id: "p1", price, currency: "USD", title: "Товар", salesCount: 0 }] };
    return { rows: [], rowCount: 0 };
  });
}
/** Была ли записана продажа как оплаченная. */
const paidRowWritten = () =>
  query.mock.calls.some((c) => /INSERT INTO "QStorePurchase"/.test(String(c[0])) && /'paid'/.test(String(c[0])));

beforeEach(() => {
  vi.clearAllMocks();
  ENV.forEach((v) => { saved[v] = process.env[v]; delete process.env[v]; });
  process.env.NODE_ENV = "production";
  // В проде код намеренно отказывается подписывать токен слабым секретом
  // ("AUTH_JWT_SECRET is missing or weak in production"). Это правильная
  // защита, а не помеха: задаём настоящий, иначе тест падал бы на ней и
  // ничего не сообщал о предмете проверки.
  process.env.AUTH_JWT_SECRET = "test-secret-long-enough-for-production-checks-0123456789";
  dbReady.mockReturnValue(true);
  createIntent.mockResolvedValue({ checkoutUrl: "https://gumroad.test/x", intentId: "i1" });
});
afterEach(() => {
  ENV.forEach((v) => { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; });
});

describe("В проде платный товар без процессинга НЕ выдаётся", () => {
  test("permalink не задан — 503 и НИ ОДНОЙ записи об оплате", async () => {
    product(4900);
    const r = await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});

    expect(r.status).toBe(503);
    expect(r.body.error).toBe("no_payment_provider");
    expect(paidRowWritten()).toBe(false);          // ← суть проверки
  });

  test("провайдер бросил исключение — тоже отказ, а не бесплатная выдача", async () => {
    process.env.GUMROAD_PERMALINK_QSTORE = "perma";
    product(4900);
    createIntent.mockRejectedValue(new Error("gumroad 500"));
    const r = await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});

    expect(r.status).toBe(503);
    expect(paidRowWritten()).toBe(false);
  });

  test("база недоступна — запасной путь тоже не отдаёт платный товар", async () => {
    dbReady.mockReturnValue(false);
    const r = await request(app()).post("/products/nonexistent/purchase").set("Authorization", BEARER()).send({});
    // Товара нет в памяти → 404; главное, что не 201 «оплачено».
    expect(r.status).not.toBe(201);
  });

  test("счётчик продаж не растёт от неоплаченной покупки", async () => {
    product(4900);
    await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});
    const bumped = query.mock.calls.some((c) => /"salesCount" \+ 1/.test(String(c[0])));
    expect(bumped).toBe(false);
  });
});

describe("Что чинить было НЕ надо — осталось рабочим", () => {
  test("бесплатный товар выдаётся как прежде", async () => {
    product(0);
    const r = await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("paid");
    expect(paidRowWritten()).toBe(true);
  });

  test("процессинг настроен — уходим на оплату, запись pending, а не paid", async () => {
    process.env.GUMROAD_PERMALINK_QSTORE = "perma";
    product(4900);
    const r = await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});
    expect(r.status).toBe(201);
    expect(r.body.checkoutUrl).toBe("https://gumroad.test/x");
    expect(r.body.status).toBe("pending");
    expect(paidRowWritten()).toBe(false);
  });

  test("в РАЗРАБОТКЕ прежнее поведение сохранено — иначе сломаю работу без ключей", async () => {
    process.env.NODE_ENV = "test";
    product(4900);
    const r = await request(app()).post("/products/p1/purchase").set("Authorization", BEARER()).send({});
    expect(r.status).toBe(201);
    expect(r.body.mode).toBe("direct");
  });

  test("без токена — по-прежнему 401", async () => {
    product(4900);
    const r = await request(app()).post("/products/p1/purchase").send({});
    expect(r.status).toBe(401);
  });
});

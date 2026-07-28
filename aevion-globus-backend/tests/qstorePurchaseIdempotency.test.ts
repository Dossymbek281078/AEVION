import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Повторное «купить» на том же товаре создавало ВТОРУЮ оплаченную покупку и
 * второй раз увеличивало число продаж на витрине. У цифрового товара нет
 * количества, владение им не удваивается — а число продаж видно всем и служит
 * доводом при покупке.
 *
 * Тот же класс, что накрутка откликов, отметок «нравится» и удвоение
 * пожертвования: учёт шёл независимо от того, появилась ли строка.
 */

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qstoreRouter } from "../src/routes/qstore";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qstore", qstoreRouter);
  return app;
}

let sqlSeen: string[] = [];

/** `purchaseInserted` — сколько строк вставила база: 0 значит «уже куплено». */
function mockDb(purchaseInserted: number) {
  sqlSeen = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    sqlSeen.push(sql);
    if (/CREATE TABLE|CREATE INDEX|CREATE UNIQUE|ALTER TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/FROM "QStoreProduct" WHERE "id"/i.test(sql)) {
      // Бесплатный товар — путь прямой покупки, без внешней оплаты.
      return {
        rows: [{ id: "p-1", sellerId: "s-1", title: "Шаблон", price: 0, currency: "USD", isPublic: true }],
        rowCount: 1,
      };
    }
    if (/INSERT INTO "QStorePurchase"/i.test(sql)) {
      return purchaseInserted
        ? { rows: [{ id: "buy-new" }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT "id" FROM "QStorePurchase"/i.test(sql)) {
      return { rows: [{ id: "buy-existing" }], rowCount: 1 };
    }
    if (/UPDATE "QStoreProduct"/i.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

const TOKEN = signJwt({ sub: "user-1", email: "u@example.com" });

function buy() {
  return request(makeApp())
    .post("/api/qstore/products/p-1/purchase")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({});
}

const SALES_UP = /UPDATE "QStoreProduct" SET "salesCount" = "salesCount" \+ 1/i;

describe("POST /products/:id/purchase — повторная покупка", () => {
  beforeEach(() => {
    process.env.QSTORE_DB = "1";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";
  });

  test("первая покупка: 201 и число продаж выросло", async () => {
    mockDb(1);
    const res = await buy();
    expect(res.status).toBe(201);
    expect(sqlSeen.some((s) => SALES_UP.test(s))).toBe(true);
  });

  test("повторная покупка: число продаж НЕ выросло", async () => {
    mockDb(0);
    const res = await buy();
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.purchaseId).toBe("buy-existing");
    expect(
      sqlSeen.some((s) => SALES_UP.test(s)),
      "число продаж выросло на повторном нажатии — витрина показывает больше продаж, чем было",
    ).toBe(false);
  });

  test("защита стоит в самом запросе, а не рядом", async () => {
    mockDb(1);
    await buy();
    const insert = sqlSeen.find((s) => /INSERT INTO "QStorePurchase"/i.test(s));
    expect(insert).toBeTruthy();
    // База в тестах заменена заглушкой: без этой проверки поведенческие тесты
    // выше зелёные и на коде без защиты — решение принимает заглушка.
    expect(insert, "нет ON CONFLICT по паре товар+покупатель").toMatch(
      /ON CONFLICT\s*\(\s*"productId"\s*,\s*"buyerId"\s*\)/i,
    );
    expect(insert, "нет RETURNING — нечем отличить покупку от повтора").toMatch(/RETURNING/i);
  });
});

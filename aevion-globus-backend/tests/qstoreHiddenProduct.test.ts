import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Шестой случай одного перекоса: правило видимости написано в списке и не
 * написано в выдаче по идентификатору.
 *
 * Список товаров начинается с `['"isPublic" = TRUE']`, путь через память
 * фильтрует `.filter((p) => p.isPublic)`. А `GET /products/:id` не смотрел на
 * признак вовсе — снятый с витрины товар открывался по прямой ссылке.
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

const SELLER = "user-seller";
const sellerToken = `Bearer ${signJwt({ sub: SELLER, email: "s@test.aev", role: "USER" })}`;
const strangerToken = `Bearer ${signJwt({ sub: "user-stranger", email: "x@test.aev", role: "USER" })}`;

function serveProduct(isPublic: boolean) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM "QStoreProduct"') && String(sql).includes('"id" = $1')) {
      return {
        rows: [
          {
            id: "prod-1",
            sellerId: SELLER,
            title: "Шаблон",
            description: "описание",
            category: "templates",
            price: 4900,
            currency: "usd",
            previewUrl: null,
            tags: [],
            salesCount: 0,
            isPublic,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // колонка «завтрашней» схемы: наружу уходить не должна
            internalMargin: 0.62,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

const get = (token?: string) => {
  const r = request(makeApp()).get("/api/qstore/products/prod-1");
  return token ? r.set("Authorization", token) : r;
};

describe("QStore: снятый с витрины товар не открывается по прямой ссылке", () => {
  beforeEach(() => mockQuery.mockReset());

  test("непубличный товар посторонним не отдаётся — и без входа тоже", async () => {
    serveProduct(false);
    expect((await get()).status).toBe(404);
    serveProduct(false);
    expect((await get(strangerToken)).status).toBe(404);
  });

  test("продавец свой непубличный товар видит", async () => {
    serveProduct(false);
    const res = await get(sellerToken);
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe("prod-1");
  });

  test("публичный товар доступен кому угодно", async () => {
    serveProduct(true);
    expect((await get()).status).toBe(200);
  });

  test("служебные поля наружу не уходят", async () => {
    serveProduct(true);
    const res = await get();
    expect(res.body.product).not.toHaveProperty("internalMargin");
  });

  test("запрос перечисляет поля, а не берёт всё подряд", async () => {
    serveProduct(true);
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes('FROM "QStoreProduct"'));
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toContain('"title"');
  });
});

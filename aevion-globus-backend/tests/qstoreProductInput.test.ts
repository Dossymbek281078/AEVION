import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Цена товара принималась как `Number(price) || 0` — то есть без единой
 * проверки диапазона:
 *
 *   -500   → сохранялось как минус пятьсот;
 *   1e400  → в JSON это Infinity, сохранялась бесконечность;
 *   "abc"  → NaN, падало в 0 (единственный случай, который работал верно).
 *
 * Товар с отрицательной ценой на витрине — не «странное число», а прямой путь к
 * разбирательству с покупателем. Заодно категория не сверялась со списком
 * (товар мог получить категорию, которой нет ни в одном фильтре, и пропасть с
 * витрины), а метки принимались чем угодно: строка вместо массива ложилась в
 * колонку `text[]` и роняла вставку пятисоткой.
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

const AUTH = `Bearer ${signJwt({ sub: "seller-1", email: "s@test.aev", role: "USER" })}`;
const OK = { title: "Шаблон", category: "template", description: "описание" };

const post = (body: unknown) =>
  request(makeApp()).post("/api/qstore/me/products").set("Authorization", AUTH).send(body as object);

const postRaw = (json: string) =>
  request(makeApp())
    .post("/api/qstore/me/products")
    .set("Authorization", AUTH)
    .set("Content-Type", "application/json")
    .send(json);

describe("QStore: цена и остальной ввод товара проверяются", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("отрицательная цена отбивается", async () => {
    const res = await post({ ...OK, price: -500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negative/);
  });

  test("бесконечность из JSON отбивается", async () => {
    // через объект не выразить: JSON.stringify превращает Infinity в null
    expect(JSON.parse('{"v":1e400}').v).toBe(Infinity); // контроль предпосылки
    const res = await postRaw('{"title":"Шаблон","category":"template","price":1e400}');
    expect(res.status).toBe(400);
  });

  test("доля цента отбивается", async () => {
    expect((await post({ ...OK, price: 1.005 })).status).toBe(400);
    expect((await post({ ...OK, price: 49.5 })).status).toBe(400);
  });

  test("хвост от умножения на 100 не мешает — форма шлёт именно такие числа", async () => {
    // `Number("19.99") * 100` в JS даёт 1998.9999999999998, и первая редакция
    // проверки это отбивала. Сверка с формой и поймала регрессию.
    expect(Number("19.99") * 100).toBe(1998.9999999999998); // контроль предпосылки
    const res = await post({ ...OK, price: Number("19.99") * 100 });
    expect(res.status).toBe(201);
    expect(res.body.product.price).toBe(1999);
  });

  test("нормальная цена и бесплатный товар проходят", async () => {
    expect((await post({ ...OK, price: 4950 })).status).toBe(201);
    expect((await post({ ...OK, price: 0 })).status).toBe(201);
    expect((await post({ ...OK })).status).toBe(201);
  });

  test("неизвестная категория отбивается", async () => {
    const res = await post({ ...OK, category: "не-существует" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown category");
  });

  test("метки строкой вместо массива отбиваются", async () => {
    const res = await post({ ...OK, tags: "одна, вторая" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tags/);
  });

  test("метки массивом строк проходят и обрезаются от пустых", async () => {
    const res = await post({ ...OK, tags: ["дизайн", "  ", "шаблон"] });
    expect(res.status).toBe(201);
    expect(res.body.product.tags).toEqual(["дизайн", "шаблон"]);
  });

  test("ссылка на превью обязана быть абсолютной http(s)", async () => {
    expect((await post({ ...OK, previewUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await post({ ...OK, previewUrl: "/local/path" })).status).toBe(400);
    expect((await post({ ...OK, previewUrl: "https://cdn.example.com/a.png" })).status).toBe(201);
  });

  test("слишком длинное название отбивается", async () => {
    expect((await post({ ...OK, title: "x".repeat(201) })).status).toBe(400);
  });
});

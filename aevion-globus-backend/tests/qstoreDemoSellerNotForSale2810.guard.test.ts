import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/*
 * 🔴 28.10.2026 (окно «Приложения»): замер прода GET /api/qstore/products — все 6 товаров от продавца 652ca4d7…
 * (сиды scripts/seed-demo-content.js), за ними нет файла. Честная витрина: товары демо-продавца не в выдаче и не
 * в подборках, покупка → 410, карточка по id открывается с demo:true. Мок базы SQL не исполняет и отдаёт все строки —
 * отбор обязан делать код (его и ловят мутации).
 */
const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureQStoreTables", () => ({ ensureQStoreTables: vi.fn(), isQStoreDbReady: () => true }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => undefined }));

// eslint-disable-next-line import/first
import { qstoreRouter, демоПродавец } from "../src/routes/qstore";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";

const ДЕМО = "652ca4d7-c4f4-4519-8bd9-562adab2ec2a";
const app = () => { const a = express(); a.use(express.json()); a.use(qstoreRouter); return a; };
const bearer = "Bearer " + jwt.sign({ sub: "buyer-1" }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1h" });
const строка = (id: string, sellerId: string, title: string) => ({ id, sellerId, title, description: "d", category: "templates", price: 1490, currency: "usd", previewUrl: "", tags: [], salesCount: 0, avgRating: 0, reviewCount: 0, isPublic: true, createdAt: "2026-05-19T05:59:26.269Z", updatedAt: "2026-05-19T05:59:26.269Z" });
const СТРОКИ = [строка("d1", ДЕМО, "CyberChess Opening Repertoire Pack"), строка("d2", ДЕМО, "QCoreAI Prompt Engineering Course"), строка("r1", "seller-real", "Настоящий шаблон")];

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/WHERE "id" = \$1/.test(String(sql))) { const r = СТРОКИ.filter((x) => x.id === params?.[0]); return { rows: r, rowCount: r.length }; }
    return { rows: СТРОКИ, rowCount: СТРОКИ.length };
  });
});

describe("QStore: товары демо-продавца не продаются", () => {
  test("знаменатель: 3 строки в базе, из них 2 демо", () => {
    expect(СТРОКИ.filter((x) => демоПродавец(x.sellerId))).toHaveLength(2);
    expect(демоПродавец("seller-real")).toBe(false);
    expect(демоПродавец(undefined)).toBe(false);
  });

  test("выдача: 3 на входе → 1 настоящий на выходе; SQL тоже получает список демо", async () => {
    const r = await request(app()).get("/products");
    expect(r.status).toBe(200);
    expect(r.body.products.map((p: { id: string }) => p.id)).toEqual(["r1"]);
    const [sql, params] = query.mock.calls[0]!;
    expect(String(sql)).toMatch(/NOT \("sellerId"::text = ANY\(\$\d+::text\[\]\)\)/);
    expect(params).toContainEqual([ДЕМО]);
  });

  test("подборки витрины без демо", async () => {
    const r = await request(app()).get("/featured");
    for (const к of ["popular", "newest", "trending"]) expect(r.body[к].map((p: { id: string }) => p.id), к).toEqual(["r1"]);
  });

  test("покупка демо → 410, до кассы не доходит; настоящий товар этим правилом не задет", async () => {
    const d = await request(app()).post("/products/d1/purchase").set("Authorization", bearer);
    expect(d.status).toBe(410);
    expect(d.body.error).toBe("demo_product_not_for_sale");
    const n = await request(app()).post("/products/r1/purchase").set("Authorization", bearer);
    expect(n.status).not.toBe(410);
  });

  test("карточка по прямому id открывается с пометкой demo", async () => {
    const d = await request(app()).get("/products/d1");
    expect(d.status).toBe(200);
    expect(d.body.product.demo).toBe(true);
    expect((await request(app()).get("/products/r1")).body.product.demo).toBe(false);
  });
});

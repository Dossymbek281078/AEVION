import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Продавец видит НАСТОЯЩИЕ продажи, а не ноль.
 *
 * Замер 28.08.2026: покупки пишутся в "QStorePurchase", товары в
 * "QStoreProduct" — а пять ручек продавца считали всё это по картам ПАМЯТИ.
 * На проде память пуста, значит продавец с настоящими продажами видел
 * «0 продаж, выручка 0».
 *
 * Это худшая из возможных неправд на витрине: она говорит человеку, что его
 * денег не существует. Ни один тест этого не ловил, потому что в тестах
 * память как раз заполнена — там ручки работали.
 */

const products = new Map<string, Record<string, unknown>>();
const purchases = new Map<string, Record<string, unknown>>();
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      const p = (params ?? []) as unknown[];
      const head = s.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER") || head.startsWith("SELECT 1")) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('UPDATE "QStoreProduct"') && s.includes('"featured"')) {
        const pr = [...products.values()].find((x) => x.id === p[0] && x.sellerId === p[1]);
        if (!pr) return { rows: [], rowCount: 0 };
        pr.featured = !pr.featured;
        return { rows: [{ featured: pr.featured }], rowCount: 1 };
      }
      if (s.includes('FROM "QStoreProduct"') && s.includes('"sellerId" = $1')) {
        const rows = [...products.values()].filter((x) => x.sellerId === p[0]).map(copy);
        return { rows, rowCount: rows.length };
      }
      if (s.includes('FROM "QStorePurchase"')) {
        const ids = new Set((p[0] as string[]) ?? []);
        const rows = [...purchases.values()].filter((x) => ids.has(String(x.productId))).map(copy);
        return { rows, rowCount: rows.length };
      }
      if (s.includes('FROM "QStoreReview"')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQStoreTables", () => ({
  ensureQStoreTables: async () => {},
  isQStoreDbReady: () => true,
  getQStoreDbError: () => null,
}));

import { qstoreRouter } from "../src/routes/qstore";

const SELLER = "seller-1";
const TOKEN = jwt.sign({ sub: SELLER }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qstoreRouter);
  return a;
}

// Товар и две покупки лежат В БАЗЕ, память пуста — как на проде.
products.set("p-1", {
  id: "p-1", sellerId: SELLER, title: "Товар", category: "tools", price: 1900,
  currency: "usd", salesCount: 2, isPublic: true, featured: false,
  createdAt: "2026-08-01T00:00:00.000Z",
});
purchases.set("b-1", {
  id: "b-1", productId: "p-1", buyerId: "buyer-1", amount: 1900,
  createdAt: new Date().toISOString(),
});
purchases.set("b-2", {
  id: "b-2", productId: "p-1", buyerId: "buyer-2", amount: 1900,
  createdAt: new Date().toISOString(),
});

describe("панель продавца показывает настоящие продажи", () => {
  test("/me/sales: две продажи и выручка, а не ноль", async () => {
    const res = await request(app()).get("/x/me/sales").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total, "продавец видит ноль продаж при настоящих").toBe(2);
    expect(res.body.totalRevenue, "выручка показана нулём").toBe(3800);
  });

  test("/me/dashboard: товары, продажи и выручка из базы", async () => {
    const res = await request(app()).get("/x/me/dashboard").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.products.total).toBe(1);
    expect(res.body.sales.total).toBe(2);
    expect(res.body.revenue.total).toBe(3800);
    expect(res.body.recentSales?.[0]?.productTitle, "название товара потеряно").toBe("Товар");
  });

  test("/me/dashboard/chart: сегодняшние продажи попадают в график", async () => {
    const res = await request(app())
      .get("/x/me/dashboard/chart?days=7")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    const total = (res.body.buckets ?? []).reduce(
      (s: number, b: { sales: number }) => s + b.sales, 0,
    );
    expect(total, "график пуст при настоящих продажах").toBe(2);
  });

  test("/sellers/:id: публичный профиль не пуст", async () => {
    const res = await request(app()).get(`/x/sellers/${SELLER}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length, "у продавца с товаром пустая витрина").toBe(1);
  });

  test("избранное переключается В БАЗЕ и только своим владельцем", async () => {
    const on = await request(app())
      .post("/x/products/p-1/feature")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(on.status).toBe(200);
    expect(on.body.featured).toBe(true);
    expect(products.get("p-1")?.featured, "отметка не доехала до базы").toBe(true);

    const stranger = jwt.sign({ sub: "nobody" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });
    const denied = await request(app())
      .post("/x/products/p-1/feature")
      .set("Authorization", `Bearer ${stranger}`);
    expect(denied.status, "посторонний переключил чужой товар").toBe(404);
    expect(products.get("p-1")?.featured, "чужое переключение всё-таки прошло").toBe(true);
  });
});

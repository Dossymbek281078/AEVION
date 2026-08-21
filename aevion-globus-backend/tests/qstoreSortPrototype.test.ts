import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Витрина сортируется по параметру `?sort=`. Выбор колонки был написан так:
 *
 *   const orderClause = orderBySql[sort] ?? orderBySql.popular;
 *
 * `??` здесь не защита: обычный объект наследует ключи прототипа, и
 * `orderBySql["constructor"]` возвращает функцию `Object` — она не null и не
 * undefined, поэтому откат на "popular" НЕ срабатывает. Текст функции уезжает в
 * ORDER BY, запрос падает, и покупатель видит ПУСТУЮ витрину.
 *
 * Замер на живом проде 19.08.2026:
 *   ?sort=zzqwezzqwez -> 10924 байта, товары на месте
 *   ?sort=constructor -> {"products":[],"total":0}
 *
 * Контрольное слово ТОЙ ЖЕ ДЛИНЫ, не являющееся ключом прототипа, отвечало
 * правильно — значит дело в наследовании, а не в длине или символах. Тест
 * повторяет обе стороны: проверяем, что в SQL уходит настоящее имя колонки.
 */

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: queryMock }) }));
vi.mock("../src/lib/ensureQStoreTables", () => ({
  ensureQStoreTables: vi.fn(),
  isQStoreDbReady: () => true,
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/authJwt", () => ({ verifyBearerOptional: () => null }));
vi.mock("../src/lib/ogEtag", () => ({ applyOgEtag: () => false }));
vi.mock("../src/lib/payment/gumroadProvider", () => ({ gumroadPaymentProvider: {} }));

// eslint-disable-next-line import/first
import { qstoreRouter } from "../src/routes/qstore";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(qstoreRouter);
  return a;
};

// Имена колонок, которые вообще допустимы в ORDER BY этой ручки.
const REAL_COLUMNS = ["salesCount", "createdAt", "avgRating"];

function orderByOf(calls: unknown[][]): string {
  const sql = calls.map((c) => String(c[0])).find((s) => /ORDER BY/i.test(s)) ?? "";
  return (sql.match(/ORDER BY([\s\S]*?)(LIMIT|$)/i) || [])[1] ?? "";
}

describe("Витрина: ключ прототипа в ?sort= не должен попадать в ORDER BY", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test("корректное значение сортировки доходит до запроса (контроль)", async () => {
    await request(app()).get("/products?sort=newest");
    const ob = orderByOf(queryMock.mock.calls);
    expect(ob).toContain("createdAt");
  });

  test("обычное неизвестное значение откатывается на popular (контроль)", async () => {
    await request(app()).get("/products?sort=zzqwezzqwez");
    const ob = orderByOf(queryMock.mock.calls);
    expect(ob).toContain("salesCount");
  });

  test.each(["constructor", "__proto__", "toString", "valueOf"])(
    "ключ прототипа %s не попадает в ORDER BY",
    async (bad) => {
      await request(app()).get(`/products?sort=${bad}`);
      const ob = orderByOf(queryMock.mock.calls);
      // Ни следа функции или служебного имени в SQL.
      expect(ob).not.toMatch(/function|native code|\[object/i);
      expect(ob).not.toContain(bad);
      // И это должно быть настоящее имя колонки, а не пустота.
      expect(REAL_COLUMNS.some((c) => ob.includes(c))).toBe(true);
    },
  );
});

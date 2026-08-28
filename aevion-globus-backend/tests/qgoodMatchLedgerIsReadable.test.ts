// След движения денег существовал и был недоступен.
//
// НАЙДЕНО 28.08.2026 сплошным проходом по 217 таблицам бэкенда: где есть
// INSERT, но нет чтения содержимого. "QGoodMatch" оказалась в списке.
//
// Запись в неё сопровождается ДВИЖЕНИЕМ ДЕНЕГ: у пула софинансирования
// уменьшается remainingCents, у кампании растёт raisedCents, а строка
// QGoodMatch — единственная запись о том, из какого пула и за какое
// пожертвование ушла сумма. Прочитать её было нечем.
//
// Косвенное подтверждение, что читатель задумывался: индекс
// "QGoodMatch_pool_idx" ON ("poolId","createdAt") создан, а запрос по пулу и
// времени не написан.

import { describe, expect, test, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

let matchRows: Array<Record<string, unknown>> = [];
let lastSql = "";
let lastArgs: unknown[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, args?: unknown[]) => {
      const q = String(sql);
      if (q.includes("COUNT(*)") && q.includes('"QGoodMatch"')) {
        return { rows: [{ n: 42, sum: "125000" }] };
      }
      if (q.includes('FROM "QGoodMatch"')) {
        lastSql = q;
        lastArgs = args ?? [];
        return { rows: matchRows, rowCount: matchRows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    })),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "test-secret-for-qgood-match-ledger-32b!!";
process.env.QGOOD_ADMIN_EMAILS = "boss@aevion.app";

// eslint-disable-next-line import/first
import { qgoodRouter } from "../src/routes/qgood";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/qgood", qgoodRouter);
  return a;
};

const token = (email: string) =>
  jwt.sign({ email, sub: "u1" }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
  });

const get = (q = "", who?: string) => {
  const r = request(app()).get(`/api/qgood/matching-pools/pool-1/matches${q}`);
  return who ? r.set("Authorization", `Bearer ${token(who)}`) : r;
};

beforeEach(() => {
  matchRows = [
    { id: "m1", campaignId: "c1", donationId: "d1", amountCents: 5000, currency: "USD", createdAt: "2026-08-27T10:00:00.000Z" },
    { id: "m2", campaignId: "c2", donationId: "d2", amountCents: 2500, currency: "USD", createdAt: "2026-08-26T10:00:00.000Z" },
  ];
  lastSql = "";
  lastArgs = [];
});

describe("след движения денег читается только администратором", () => {
  test("без токена — 403 и ни одной суммы в ответе", async () => {
    const r = await get();
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toMatch(/5000|donationId/);
  });

  test("посторонний с валидным токеном — 403", async () => {
    const r = await get("", "someone@else.com");
    expect(r.status).toBe(403);
  });

  test("контроль: администратору след ОТДАЁТСЯ", async () => {
    // Без этого три проверки на 403 прошли бы и на ручке, отвечающей 403 всем,
    // — след остался бы нечитаемым, как и был.
    const r = await get("", "boss@aevion.app");
    expect(r.status).toBe(200);
    expect(r.body.matches).toHaveLength(2);
    expect(r.body.matches[0].donationId).toBe("d1");
  });
});

describe("ответ не выдаёт часть за целое", () => {
  test("итоги по пулу приходят отдельно от показанной страницы", async () => {
    const r = await get("?limit=2", "boss@aevion.app");
    expect(r.body.returned).toBe(2);
    expect(r.body.total).toBe(42);
    // Сумма — главное число для сверки пула, и она по ВСЕМУ пулу.
    expect(r.body.matchedCentsTotal).toBe(125000);
  });

  test("предел зажат сверху и снизу", async () => {
    expect((await get("?limit=99999", "boss@aevion.app")).body.limit).toBe(500);
    expect((await get("?limit=0", "boss@aevion.app")).body.limit).toBe(100);
    expect((await get("?limit=мусор", "boss@aevion.app")).body.limit).toBe(100);
  });
});

describe("выборка идёт по нужному пулу и проверяет курсор", () => {
  test("в запрос уходит идентификатор пула из пути", async () => {
    // Иначе администратор одного пула видел бы чужие движения.
    await get("", "boss@aevion.app");
    expect(lastSql).toMatch(/"poolId" = \$1/);
    expect(lastArgs[0]).toBe("pool-1");
  });

  test("мусор в before — 400, а не 500", async () => {
    const r = await get("?before=zzz", "boss@aevion.app");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_before");
  });

  test("верный курсор доходит до запроса", async () => {
    const r = await get("?before=2026-08-27T00:00:00.000Z", "boss@aevion.app");
    expect(r.status).toBe(200);
    expect(lastSql).toMatch(/"createdAt" < \$/);
    expect(lastArgs.some((a) => a instanceof Date)).toBe(true);
  });
});

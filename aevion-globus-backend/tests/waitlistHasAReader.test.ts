// Список ожидания заполнялся, но никем не читался.
//
// НАЙДЕНО 28.08.2026. Таблица "BureauWaitlist" встречалась в коде трижды:
// CREATE TABLE, INSERT при записи человека и COUNT(*) ради числа на экране.
// Прочитать сам список было нечем — ни ручки, ни скрипта, ни выгрузки.
//
// То есть форма на /bureau говорила «You're on the waitlist!», а механизма
// когда-либо этим списком воспользоваться не существовало. Люди оставляли
// адрес в ожидании письма, которое некому отправить.
//
// Отдельно: наружу отдаются ЧУЖИЕ адреса, поэтому половина этого набора — про
// доступ, а не про выборку.

import { describe, expect, test, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

let rows: Array<Record<string, unknown>> = [];
let lastSql = "";
let lastArgs: unknown[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, args?: unknown[]) => {
      const q = String(sql);
      if (q.includes("COUNT(*)") && q.includes("BureauWaitlist")) {
        return { rows: [{ n: 137 }] };
      }
      if (q.includes('FROM "BureauWaitlist"')) {
        lastSql = q;
        lastArgs = args ?? [];
        return { rows };
      }
      return { rows: [] };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    })),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "test-secret-for-waitlist-reader-32bytes!!";

// eslint-disable-next-line import/first
import { bureauRouter } from "../src/routes/bureau";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/bureau", bureauRouter);
  return a;
};

const adminToken = () =>
  jwt.sign({ email: "a@b.c", role: "admin" }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
  });
const userToken = () =>
  jwt.sign({ email: "a@b.c", role: "user" }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
  });

const get = (q = "", token?: string) => {
  const r = request(app()).get(`/api/bureau/admin/waitlist${q}`);
  return token ? r.set("Authorization", `Bearer ${token}`) : r;
};

beforeEach(() => {
  rows = [
    { email: "one@example.com", source: "bureau-notarized", createdAt: "2026-08-27T10:00:00.000Z" },
    { email: "two@example.com", source: "bureau-notarized", createdAt: "2026-08-26T10:00:00.000Z" },
  ];
  lastSql = "";
  lastArgs = [];
});

describe("чужие адреса не отдаются кому попало", () => {
  test("без токена — 403, и ни одного адреса в ответе", async () => {
    const r = await get();
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toMatch(/@example\.com/);
  });

  test("токен обычного пользователя — 403", async () => {
    const r = await get("", userToken());
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toMatch(/@example\.com/);
  });

  test("подписанный чужим ключом токен — 403", async () => {
    const forged = jwt.sign({ email: "a@b.c", role: "admin" }, "не наш ключ", {
      algorithm: "HS256",
    });
    const r = await get("", forged);
    expect(r.status).toBe(403);
  });

  test("контроль: администратору список ОТДАЁТСЯ", async () => {
    // Без этого все проверки выше прошли бы и на ручке, которая всем отвечает
    // 403, — то есть список остался бы нечитаемым, как и был.
    const r = await get("", adminToken());
    expect(r.status).toBe(200);
    expect(r.body.rows).toHaveLength(2);
    expect(r.body.rows[0].email).toBe("one@example.com");
  });
});

describe("ответ не выдаёт часть за целое", () => {
  test("общее число отдаётся отдельно от показанного", async () => {
    // Число, равное пределу выборки, читается как весь список — на этом я уже
    // обжигался. Поэтому total и returned приходят порознь.
    const r = await get("?limit=2", adminToken());
    expect(r.body.total).toBe(137);
    expect(r.body.returned).toBe(2);
    expect(r.body.limit).toBe(2);
  });

  test("предел ограничен сверху и снизу", async () => {
    const big = await get("?limit=99999", adminToken());
    expect(big.body.limit).toBe(500);
    const zero = await get("?limit=0", adminToken());
    expect(zero.body.limit).toBe(100);
    const junk = await get("?limit=не число", adminToken());
    expect(junk.body.limit).toBe(100);
  });
});

describe("курсор проверяется до похода в базу", () => {
  test("мусор в before — 400, а не 500", async () => {
    // Строка произвольного вида ушла бы в SQL как время и уронила запрос
    // пятисоткой. Ошибка клиента должна отвечать 4xx: 5xx поднимает людей и
    // тонет в шуме, среди которого не видно настоящих аварий.
    const r = await get("?before=zzz", adminToken());
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_before");
  });

  test("верный курсор доходит до запроса", async () => {
    const r = await get("?before=2026-08-27T00:00:00.000Z", adminToken());
    expect(r.status).toBe(200);
    expect(lastSql).toMatch(/"createdAt" < \$/);
    expect(lastArgs.some((a) => a instanceof Date)).toBe(true);
  });

  test("фильтр по источнику доходит до запроса", async () => {
    const r = await get("?source=bureau-notarized", adminToken());
    expect(r.status).toBe(200);
    expect(lastSql).toMatch(/"source" = \$/);
    expect(lastArgs).toContain("bureau-notarized");
  });
});

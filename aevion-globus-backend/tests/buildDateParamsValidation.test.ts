import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Тот же класс, что и в ленте историй: значение с датой из запроса уходит в SQL
 * параметром (инъекции нет), но Postgres падает на строке, которую не может
 * прочитать как время, — и отказ КЛИЕНТА превращается в отказ СЕРВЕРА.
 *
 * Замер на живом проде 19.08.2026:
 *
 *   GET /api/build/communities/welders-kz?before=2026-08-19T00:00:00Z -> 200
 *   GET /api/build/communities/welders-kz?before=zzz                  -> 500 community_fetch_failed
 *   GET /api/build/communities/welders-kz?before=1                    -> 500
 *
 * Найдено разбором кода после починки историй: искал переменные с «датными»
 * именами, уходящие в параметры запроса без проверки формата. Из 28 кандидатов
 * 20 были без видимой проверки, и этот подтвердился запросом к проду.
 *
 * `shifts /my` закрыт авторизацией и на проде не проверялся — там код тот же,
 * поэтому чиним заодно, а тест держит обещание.
 */

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../src/lib/build", async (orig) => {
  const real = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...real,
    buildPool: { query: queryMock },
    requireBuildAuth: () => ({ sub: "user-1", email: "u@example.com" }),
  };
});

// eslint-disable-next-line import/first
import { communitiesRouter } from "../src/routes/build/communities";
// eslint-disable-next-line import/first
import { shiftsRouter } from "../src/routes/build/shifts";

const app = (r: express.Router) => {
  const a = express();
  a.use(express.json());
  a.use(r);
  return a;
};

const BAD = ["zzz", "1", "9999-99-99", "constructor"];

describe("Даты из запроса: непонятное значение — 400, а не 500", () => {
  beforeEach(() => {
    queryMock.mockReset();
    // Сообщество найдено — иначе обработчик выйдет раньше проверки даты.
    queryMock.mockResolvedValue({ rows: [{ id: "c-1" }], rowCount: 1 });
  });

  test("сообщества: корректная дата доходит до запроса (контроль)", async () => {
    const r = await request(app(communitiesRouter)).get("/welders-kz?before=2026-08-19T00:00:00Z");
    expect(r.status).toBe(200);
    const used = queryMock.mock.calls.some((c) => JSON.stringify(c[1] ?? []).includes("2026-08-19"));
    expect(used).toBe(true);
  });

  test.each(BAD)("сообщества: %s даёт 400", async (bad) => {
    const r = await request(app(communitiesRouter)).get(`/welders-kz?before=${encodeURIComponent(bad)}`);
    expect(r.status).toBe(400);
  });

  test("смены: корректная дата принимается (контроль)", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    const r = await request(app(shiftsRouter)).get("/my?from=2026-08-19");
    expect(r.status).not.toBe(400);
  });

  test.each(BAD)("смены: %s даёт 400", async (bad) => {
    const r = await request(app(shiftsRouter)).get(`/my?from=${encodeURIComponent(bad)}`);
    expect(r.status).toBe(400);
  });
});

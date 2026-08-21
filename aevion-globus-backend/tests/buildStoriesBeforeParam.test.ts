import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * `?before=` в ленте историй уходит в SQL параметром — инъекции нет. Но
 * Postgres падает на строке, которую не может прочитать как время, запрос
 * превращается в 500 `stories_list_failed`, и это поднимает тревогу в Sentry.
 *
 * Замер на живом проде 19.08.2026:
 *
 *   ?before=2026-08-19T00:00:00Z -> 200
 *   ?before=zzz                  -> 500 stories_list_failed
 *   ?before=9999-99-99           -> 500
 *   ?before=1                    -> 500
 *
 * Именно эта ошибка пришла письмом из Sentry в 06:54 UTC. Причина не в базе и
 * не в нагрузке: хватает одного запроса с непонятной датой, а такие шлют
 * поисковые роботы и старые клиенты.
 *
 * Правильный ответ — 400: он говорит о ЗАПРОСЕ, а не об отказе сервера, и не
 * будит дежурного.
 */

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../src/lib/build", async (orig) => {
  const real = await (orig() as Promise<Record<string, unknown>>);
  return { ...real, buildPool: { query: queryMock } };
});

// eslint-disable-next-line import/first
import { storiesRouter } from "../src/routes/build/stories";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(storiesRouter);
  return a;
};

describe("Лента историй: непонятная дата — это 400, а не 500", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test("без параметра работает (контроль)", async () => {
    const r = await request(app()).get("/");
    expect(r.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  test("корректная дата доходит до запроса (контроль)", async () => {
    const r = await request(app()).get("/?before=2026-08-19T00:00:00Z");
    expect(r.status).toBe(200);
    // Дата должна уехать параметром, а не потеряться.
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(params).toContain("2026-08-19T00:00:00Z");
  });

  test.each(["zzz", "9999-99-99", "1", "не дата", "constructor"])(
    "непонятное значение %s даёт 400 и НЕ идёт в базу",
    async (bad) => {
      const r = await request(app()).get(`/?before=${encodeURIComponent(bad)}`);
      expect(r.status).toBe(400);
      // Главное: до базы такой запрос не доходит вовсе.
      expect(queryMock).not.toHaveBeenCalled();
    },
  );
});

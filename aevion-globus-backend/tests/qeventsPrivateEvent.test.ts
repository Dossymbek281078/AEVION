import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Четвёртый случай одного перекоса за день: правило соблюдается в списке и
 * игнорируется в выдаче по идентификатору.
 *
 * Список событий фильтрует `"isPublic"=TRUE`, а `GET /events/:id` не смотрел на
 * флаг ни через базу, ни через память. Организатор прятал событие из афиши, а
 * по прямой ссылке его открывал кто угодно.
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
import { qeventsRouter } from "../src/routes/qevents";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qevents", qeventsRouter);
  return app;
}

const ORGANIZER = "user-organizer";
const organizerToken = `Bearer ${signJwt({ sub: ORGANIZER, email: "o@test.aev", role: "USER" })}`;
const strangerToken = `Bearer ${signJwt({ sub: "user-stranger", email: "s@test.aev", role: "USER" })}`;

function serveEvent(isPublic: boolean) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM "QEvent"') && String(sql).includes('"id"=$1')) {
      return {
        rows: [
          {
            id: "ev-1",
            organizerId: ORGANIZER,
            title: "Закрытая встреча",
            description: "для своих",
            category: "meetup",
            location: "Астана",
            startAt: new Date().toISOString(),
            endAt: null,
            capacity: 10,
            price: 0,
            attendeeCount: 0,
            isPublic,
            coverUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // служебное поле «завтрашней» схемы
            internalNote: "не показывать",
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

const get = (token?: string) => {
  const r = request(makeApp()).get("/api/qevents/events/ev-1");
  return token ? r.set("Authorization", token) : r;
};

describe("QEvents: непубличное событие не открывается по прямой ссылке", () => {
  beforeEach(() => mockQuery.mockReset());

  test("посторонним не отдаётся — и без входа тоже", async () => {
    serveEvent(false);
    expect((await get()).status).toBe(404);
    serveEvent(false);
    expect((await get(strangerToken)).status).toBe(404);
  });

  test("организатор своё непубличное событие видит", async () => {
    serveEvent(false);
    const res = await get(organizerToken);
    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe("ev-1");
  });

  test("публичное событие открывается кем угодно", async () => {
    serveEvent(true);
    expect((await get()).status).toBe(200);
  });

  test("запрос перечисляет поля, а не берёт всё подряд", async () => {
    serveEvent(true);
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes('FROM "QEvent"'));
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toContain('"title"');
  });
});

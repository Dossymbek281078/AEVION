/**
 * QEvents RSVP — вместимость и лист ожидания в ветке Postgres.
 *
 * Зачем этот файл существует. До 28.07.2026 проверка вместимости жила ТОЛЬКО
 * в in-memory ветке роутера — то есть в dev. В проде, где `isQEventsDbReady()`
 * истинно, RSVP вставлялся безусловно: attendeeCount уходил за capacity,
 * а лист ожидания, заявленный как свойство модуля, не срабатывал никогда.
 * Ничего при этом не падало — ровно тот класс дефектов, который не ловится
 * зелёными тестами, потому что тесты ходили в другую ветку.
 *
 * Поэтому здесь поддельный пул: он заставляет роутер пойти именно в SQL-путь.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

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

/** Журнал SQL, который роутер реально выполнил. */
const { sqlLog, clientQuery } = vi.hoisted(() => {
  const sqlLog: string[] = [];
  return { sqlLog, clientQuery: vi.fn() };
});

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    connect: async () => ({
      query: clientQuery,
      release: () => {},
    }),
  }),
}));

vi.mock("../src/lib/ensureQEventsTables", () => ({
  isQEventsDbReady: () => true,
  getQEventsDbError: () => null,
  ensureQEventsTables: async () => {},
}));

// eslint-disable-next-line import/first
import { qeventsRouter } from "../src/routes/qevents";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qevents", qeventsRouter);
  return app;
}

/**
 * Отвечает на запросы роутера так, будто в базе одно событие.
 * `taken` / `capacity` задают заполненность, `mine` — существующий RSVP.
 */
function stubDb(opts: { exists?: boolean; taken: number; capacity: number; mine?: "going" | "not-going" }) {
  const { exists = true, taken, capacity, mine } = opts;
  clientQuery.mockImplementation(async (sql: string) => {
    sqlLog.push(sql.trim().split("\n")[0].trim());
    if (/^BEGIN|^COMMIT|^ROLLBACK/i.test(sql.trim())) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM "QEvent"') && sql.includes("FOR UPDATE")) {
      return exists ? { rows: [{ attendeeCount: taken, capacity }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM "QEventRSVP"')) {
      return mine ? { rows: [{ status: mine }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('UPDATE "QEvent"')) {
      return { rows: [{ attendeeCount: taken + 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

const token = signJwt({ sub: "user-1", email: "a@b.c" });
const rsvp = () =>
  request(makeApp()).post("/api/qevents/events/ev-1/rsvp").set("Authorization", `Bearer ${token}`);

beforeEach(() => {
  sqlLog.length = 0;
  clientQuery.mockReset();
});

describe("RSVP в ветке Postgres соблюдает вместимость", () => {
  test("на полное событие отвечает 409 и предлагает лист ожидания", async () => {
    stubDb({ taken: 100, capacity: 100 });
    const res = await rsvp();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ waitlistAvailable: true });
  });

  test("переполнение не проходит даже на единицу", async () => {
    stubDb({ taken: 101, capacity: 100 });
    expect((await rsvp()).status).toBe(409);
  });

  test("на последнее свободное место записывает", async () => {
    stubDb({ taken: 99, capacity: 100 });
    const res = await rsvp();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("going");
    expect(res.body.attendeeCount).toBe(100);
  });

  test("отказ от участия проходит и на полном событии — иначе место не освободить", async () => {
    stubDb({ taken: 100, capacity: 100, mine: "going" });
    const res = await rsvp();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("not-going");
  });

  test("несуществующее событие даёт 404, а не запись в пустоту", async () => {
    stubDb({ exists: false, taken: 0, capacity: 10 });
    expect((await rsvp()).status).toBe(404);
  });

  test("без токена — 401, до базы дело не доходит", async () => {
    stubDb({ taken: 0, capacity: 10 });
    const res = await request(makeApp()).post("/api/qevents/events/ev-1/rsvp");
    expect(res.status).toBe(401);
    expect(sqlLog).toEqual([]);
  });
});

describe("транзакция, а не «прочитал и записал»", () => {
  test("строка события читается под FOR UPDATE внутри BEGIN", async () => {
    stubDb({ taken: 0, capacity: 10 });
    await rsvp();
    const begin = sqlLog.findIndex((s) => /^BEGIN/i.test(s));
    const forUpdate = sqlLog.findIndex((s) => s.includes("FOR UPDATE"));
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(forUpdate).toBeGreaterThan(begin);
  });

  test("успешная запись коммитится", async () => {
    stubDb({ taken: 0, capacity: 10 });
    await rsvp();
    expect(sqlLog.some((s) => /^COMMIT/i.test(s))).toBe(true);
  });

  test("отказ по вместимости откатывается и ничего не пишет", async () => {
    stubDb({ taken: 5, capacity: 5 });
    await rsvp();
    expect(sqlLog.some((s) => /^ROLLBACK/i.test(s))).toBe(true);
    expect(sqlLog.some((s) => s.includes('INSERT INTO "QEventRSVP"'))).toBe(false);
    expect(sqlLog.some((s) => s.includes('UPDATE "QEvent"'))).toBe(false);
  });

  test("сбой посреди транзакции откатывается, а наружу уходит 500", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      sqlLog.push(sql.trim().split("\n")[0].trim());
      if (/^BEGIN|^ROLLBACK/i.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes("FOR UPDATE")) return { rows: [{ attendeeCount: 0, capacity: 10 }], rowCount: 1 };
      if (sql.includes('FROM "QEventRSVP"')) return { rows: [], rowCount: 0 };
      throw new Error("боль в середине транзакции");
    });
    const res = await rsvp();
    expect(res.status).toBe(500);
    expect(sqlLog.some((s) => /^ROLLBACK/i.test(s))).toBe(true);
  });
});

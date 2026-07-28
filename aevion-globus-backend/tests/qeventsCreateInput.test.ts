import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Создание события проверяло только начало (`startAt` — валидная дата не в
 * прошлом), а остальное принимало почти как есть:
 *
 *   capacity > 0   → `Infinity > 0` истинно, а колонка вместимости целая:
 *                    `1e400` из JSON уронил бы вставку пятисоткой;
 *   price >= 0     → та же дыра плюс цена мельче копейки;
 *   endAt          → любая строка, в том числе РАНЬШЕ начала: «закончилось
 *                    раньше, чем началось» сохранялось и показывалось в афише;
 *   coverUrl       → любая строка без проверки схемы;
 *   title/desc     → без ограничения длины.
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

const AUTH = `Bearer ${signJwt({ sub: "organizer-1", email: "o@test.aev", role: "USER" })}`;
const inADay = () => new Date(Date.now() + 86_400_000).toISOString();
const OK = () => ({ title: "Встреча", startAt: inADay() });

const post = (body: unknown) =>
  request(makeApp()).post("/api/qevents/me/events").set("Authorization", AUTH).send(body as object);

const postRaw = (json: string) =>
  request(makeApp())
    .post("/api/qevents/me/events")
    .set("Authorization", AUTH)
    .set("Content-Type", "application/json")
    .send(json);

describe("QEvents: ввод при создании события проверяется", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("нормальное событие создаётся", async () => {
    const res = await post({ ...OK(), capacity: 50, price: 10.5 });
    expect(res.status).toBe(201);
  });

  test("бесконечная вместимость отбивается", async () => {
    expect(JSON.parse('{"v":1e400}').v).toBe(Infinity); // контроль предпосылки
    const res = await postRaw(JSON.stringify(OK()).replace(/}$/, ',"capacity":1e400}'));
    expect(res.status).toBe(400);
  });

  test("дробная и нулевая вместимость отбиваются", async () => {
    expect((await post({ ...OK(), capacity: 2.5 })).status).toBe(400);
    expect((await post({ ...OK(), capacity: 0 })).status).toBe(400);
  });

  test("отрицательная цена отбивается, ноль допустим", async () => {
    expect((await post({ ...OK(), price: -1 })).status).toBe(400);
    expect((await post({ ...OK(), price: 0 })).status).toBe(201);
  });

  test("цена мельче копейки отбивается", async () => {
    expect((await post({ ...OK(), price: 1.005 })).status).toBe(400);
  });

  test("конец раньше начала отбивается", async () => {
    const start = inADay();
    const res = await post({ title: "Встреча", startAt: start, endAt: new Date(Date.parse(start) - 3600_000).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("endAt must be after startAt");
  });

  test("конец позже начала проходит и нормализуется", async () => {
    const start = inADay();
    const end = new Date(Date.parse(start) + 3600_000).toISOString();
    const res = await post({ title: "Встреча", startAt: start, endAt: end });
    expect(res.status).toBe(201);
    expect(res.body.event.endAt).toBe(end);
  });

  test("непарсимый конец отбивается", async () => {
    expect((await post({ ...OK(), endAt: "завтра вечером" })).status).toBe(400);
  });

  test("обложка обязана быть абсолютной http(s)", async () => {
    expect((await post({ ...OK(), coverUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await post({ ...OK(), coverUrl: "https://cdn.example.com/a.png" })).status).toBe(201);
  });

  test("слишком длинное название отбивается", async () => {
    expect((await post({ ...OK(), title: "x".repeat(201) })).status).toBe(400);
  });
});

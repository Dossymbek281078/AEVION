import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Вместимость события проверялась ТОЛЬКО в пути через память. Путь через
 * Postgres — то есть тот, что работает на проде, — не смотрел на вместимость
 * вовсе: записаться можно было сверх мест, а лист ожидания (он открывается,
 * только когда мест нет) переставал иметь смысл.
 *
 * Тот же перекос, что и с видимостью закрытых записей: правило написано в одной
 * ветке кода и забыто в соседней.
 *
 * Проверка и увеличение счётчика должны быть ОДНИМ запросом: раздельные
 * «спросили — записали» пропускают двоих на последнее место.
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

let sqlSeen: string[] = [];

/**
 * `seatFree` — свободно ли место. Условие вместимости стоит внутри самого
 * запроса на увеличение счётчика, поэтому «мест нет» выражается как ноль
 * затронутых строк, а не как отдельный ответ базы.
 */
function mockDb({
  seatFree,
  hasRsvp,
  eventExists = true,
  inserted = 1,
}: {
  seatFree: boolean;
  hasRsvp: boolean;
  eventExists?: boolean;
  inserted?: number;
}) {
  sqlSeen = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    sqlSeen.push(sql);
    if (/CREATE TABLE|CREATE UNIQUE|CREATE INDEX|ALTER TABLE/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/SELECT "id" FROM "QEvent"/i.test(sql)) {
      return eventExists ? { rows: [{ id: "e1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/SELECT "status" FROM "QEventRSVP"/i.test(sql)) {
      return hasRsvp ? { rows: [{ status: "not-going" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/INSERT INTO "QEventRSVP"/i.test(sql)) return { rows: inserted ? [{ id: "r1" }] : [], rowCount: inserted };
    if (/UPDATE "QEvent" SET "attendeeCount"="attendeeCount"\+1/i.test(sql)) {
      return { rows: [], rowCount: seatFree ? 1 : 0 };
    }
    if (/SELECT "attendeeCount" FROM "QEvent"/i.test(sql)) return { rows: [{ attendeeCount: 10 }], rowCount: 1 };
    if (/DELETE FROM "QEventRSVP"/i.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

const TOKEN = signJwt({ sub: "user-1", email: "u@example.com" });

function rsvp() {
  return request(makeApp())
    .post("/api/qevents/events/e1/rsvp")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({});
}

describe("POST /events/:id/rsvp — вместимость на пути через базу", () => {
  beforeEach(() => {
    process.env.QEVENTS_DB = "1";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";
  });

  test("мест нет — 409 и предложение листа ожидания", async () => {
    mockDb({ seatFree: false, hasRsvp: false });
    const res = await rsvp();
    expect(res.status).toBe(409);
    expect(res.body.waitlistAvailable).toBe(true);
  });

  test("мест нет — созданная запись снимается, человек не числится записанным", async () => {
    mockDb({ seatFree: false, hasRsvp: false });
    await rsvp();
    expect(
      sqlSeen.some((s) => /DELETE FROM "QEventRSVP"/i.test(s)),
      "запись осталась при отказе — человек числится записанным, не занимая места",
    ).toBe(true);
  });

  test("место есть — 200 и запись создана", async () => {
    mockDb({ seatFree: true, hasRsvp: false });
    const res = await rsvp();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("going");
    expect(sqlSeen.some((s) => /DELETE FROM "QEventRSVP"/i.test(s))).toBe(false);
  });

  test("вместимость проверяет САМА база, одним запросом со счётчиком", async () => {
    mockDb({ seatFree: true, hasRsvp: false });
    await rsvp();
    const increment = sqlSeen.find((s) => /UPDATE "QEvent" SET "attendeeCount"="attendeeCount"\+1/i.test(s));
    expect(increment, "запрос на увеличение счётчика не найден").toBeTruthy();
    // Без этой проверки остальные тесты этого файла зелёные и на сломанном
    // коде: решение «есть ли место» принимает заглушка базы, а не условие в
    // запросе. Проверка отдельным запросом («спросили — записали») пропускает
    // двоих на последнее место, поэтому условие обязано стоять здесь же.
    expect(
      increment,
      "условие вместимости вынесено из запроса — проверка перестала быть атомарной",
    ).toMatch(/"attendeeCount"\s*<\s*"capacity"/i);
  });

  test("возврат «иду» при отсутствии мест тоже отбивается", async () => {
    // Человек уже отмечен «не иду»; пока он думал, места разобрали.
    mockDb({ seatFree: false, hasRsvp: true });
    const res = await rsvp();
    expect(res.status).toBe(409);
    // Статус менять нельзя: иначе он числится идущим сверх вместимости.
    expect(sqlSeen.some((s) => /UPDATE "QEventRSVP" SET "status"/i.test(s))).toBe(false);
  });

  test("несуществующее событие — 404, а не запись в пустоту", async () => {
    mockDb({ seatFree: true, hasRsvp: false, eventExists: false });
    const res = await rsvp();
    expect(res.status).toBe(404);
    expect(sqlSeen.some((s) => /INSERT INTO "QEventRSVP"/i.test(s))).toBe(false);
  });

  test("гонка: запись уже создал параллельный запрос — место не считается дважды", async () => {
    mockDb({ seatFree: true, hasRsvp: false, inserted: 0 });
    const res = await rsvp();
    expect(res.status).toBe(200);
    expect(
      sqlSeen.some((s) => /UPDATE "QEvent" SET "attendeeCount"="attendeeCount"\+1/i.test(s)),
      "место посчитали второй раз за ту же запись",
    ).toBe(false);
  });
});

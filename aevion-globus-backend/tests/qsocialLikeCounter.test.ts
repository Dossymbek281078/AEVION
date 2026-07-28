import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Счётчик отметок «нравится» рос независимо от того, появилась ли строка.
 *
 * Было так: сначала СПРАШИВАЛИ, есть ли отметка, потом ставили её
 * (`ON CONFLICT DO NOTHING`) и увеличивали счётчик — всегда. Два быстрых
 * нажатия успевают пройти проверку оба: вторая вставка молча ничего не делает,
 * а счётчик растёт дважды. Число под постом навсегда расходится с числом строк
 * в таблице, и «отменить» его уже не отматывает: снятие уменьшает на единицу.
 *
 * Тест держит инвариант: счётчик двигается ровно тогда, когда база
 * действительно вставила или удалила строку.
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
import { qsocialRouter } from "../src/routes/qsocial";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qsocial", qsocialRouter);
  return app;
}

let sqlSeen: string[] = [];

/**
 * `alreadyLiked` описывает гонку: отметки в таблице ещё нет к моменту удаления
 * (значит, удалять нечего), но к моменту вставки её уже поставил параллельный
 * запрос — вставка возвращает ноль строк.
 */
function mockDb({ deleted, inserted }: { deleted: number; inserted: number }) {
  sqlSeen = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    sqlSeen.push(sql);
    if (/CREATE TABLE|CREATE UNIQUE|CREATE INDEX/i.test(sql)) return { rows: [], rowCount: 0 };
    if (/DELETE FROM "QSocialLike"/i.test(sql)) return { rows: [], rowCount: deleted };
    if (/INSERT INTO "QSocialLike"/i.test(sql)) return { rows: [], rowCount: inserted };
    if (/SELECT "likesCount"/i.test(sql)) return { rows: [{ likesCount: 7 }], rowCount: 1 };
    if (/SELECT "userId" FROM "QSocialPost"/i.test(sql)) return { rows: [{ userId: "author" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

const TOKEN = signJwt({ sub: "user-1", email: "u@example.com" });

function like() {
  return request(makeApp())
    .post("/api/qsocial/posts/post-1/like")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({});
}

const INCREMENTED = /UPDATE "QSocialPost" SET "likesCount"="likesCount"\+1/i;
const DECREMENTED = /likesCount"=GREATEST\(0,"likesCount"-1\)/i;

describe("POST /posts/:id/like — счётчик двигается только по факту", () => {
  beforeEach(() => {
    process.env.QSOCIAL_DB = "1";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";
  });

  test("отметка поставлена: счётчик +1", async () => {
    mockDb({ deleted: 0, inserted: 1 });
    const res = await like();
    expect(res.status).toBe(200);
    expect(sqlSeen.some((s) => INCREMENTED.test(s))).toBe(true);
  });

  test("отметка снята: счётчик −1 и вставки не было", async () => {
    mockDb({ deleted: 1, inserted: 0 });
    const res = await like();
    expect(res.status).toBe(200);
    expect(sqlSeen.some((s) => DECREMENTED.test(s))).toBe(true);
    expect(sqlSeen.some((s) => /INSERT INTO "QSocialLike"/i.test(s))).toBe(false);
  });

  test("гонка: вставка ничего не создала — счётчик НЕ тронут", async () => {
    mockDb({ deleted: 0, inserted: 0 });
    const res = await like();
    expect(res.status).toBe(200);
    expect(
      sqlSeen.some((s) => INCREMENTED.test(s)),
      "счётчик увеличили без вставленной строки",
    ).toBe(false);
  });
});

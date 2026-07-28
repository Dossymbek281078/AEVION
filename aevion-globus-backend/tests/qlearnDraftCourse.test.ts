import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Седьмой случай одного перекоса: правило видимости написано в списке и не
 * написано в выдаче по идентификатору.
 *
 * Список курсов начинается с `['"isPublic" = TRUE']`, путь через память
 * фильтрует `.filter((c) => c.isPublic)`. А `GET /courses/:id` не смотрел на
 * признак вовсе — неопубликованный курс открывался по прямой ссылке вместе со
 * списком уроков.
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
import { qlearnRouter } from "../src/routes/qlearn";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qlearn", qlearnRouter);
  return app;
}

const AUTHOR = "user-author";
const authorToken = `Bearer ${signJwt({ sub: AUTHOR, email: "a@test.aev", role: "USER" })}`;
const strangerToken = `Bearer ${signJwt({ sub: "user-stranger", email: "s@test.aev", role: "USER" })}`;

function serveCourse(isPublic: boolean) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const q = String(sql);
    if (q.includes('FROM "QLearnCourse"') && q.includes('"id" = $1')) {
      return {
        rows: [
          {
            id: "course-1",
            authorId: AUTHOR,
            title: "Черновик курса",
            description: "ещё не готов",
            category: "platform",
            level: "beginner",
            price: 0,
            isPublic,
            enrollmentCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            internalNotes: "служебное",
          },
        ],
        rowCount: 1,
      };
    }
    if (q.includes('FROM "QLearnLesson"')) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  });
}

const get = (token?: string) => {
  const r = request(makeApp()).get("/api/qlearn/courses/course-1");
  return token ? r.set("Authorization", token) : r;
};

describe("QLearn: неопубликованный курс не открывается по прямой ссылке", () => {
  beforeEach(() => mockQuery.mockReset());

  test("черновик посторонним не отдаётся — и без входа тоже", async () => {
    serveCourse(false);
    expect((await get()).status).toBe(404);
    serveCourse(false);
    expect((await get(strangerToken)).status).toBe(404);
  });

  test("автор свой черновик видит", async () => {
    serveCourse(false);
    const res = await get(authorToken);
    expect(res.status).toBe(200);
    expect(res.body.course.id).toBe("course-1");
  });

  test("опубликованный курс доступен кому угодно", async () => {
    serveCourse(true);
    expect((await get()).status).toBe(200);
  });

  test("служебные поля наружу не уходят", async () => {
    serveCourse(true);
    const res = await get();
    expect(res.body.course).not.toHaveProperty("internalNotes");
  });

  test("запрос перечисляет поля, а не берёт всё подряд", async () => {
    serveCourse(true);
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes('FROM "QLearnCourse"'));
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toContain('"title"');
  });
});

import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Цена курса принималась как `Number(price) || 0` — тот же дефект, что был в
 * QStore, повторённый дословно: отрицательная сохранялась как есть, `1e400`
 * (в JSON это Infinity) — как бесконечность.
 *
 * Плюс категория и уровень уходили в базу любой строкой: курс мог получить
 * категорию, которой нет ни в одном фильтре, и пропасть из каталога.
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

const AUTH = `Bearer ${signJwt({ sub: "author-1", email: "a@test.aev", role: "USER" })}`;
const OK = { title: "Курс", category: "tech", description: "описание" };

const post = (body: unknown) =>
  request(makeApp()).post("/api/qlearn/me/courses").set("Authorization", AUTH).send(body as object);

const postRaw = (json: string) =>
  request(makeApp())
    .post("/api/qlearn/me/courses")
    .set("Authorization", AUTH)
    .set("Content-Type", "application/json")
    .send(json);

describe("QLearn: ввод при создании курса проверяется", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("нормальный курс создаётся", async () => {
    expect((await post({ ...OK, price: 4950, level: "advanced" })).status).toBe(201);
  });

  test("отрицательная цена отбивается", async () => {
    const res = await post({ ...OK, price: -100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negative/);
  });

  test("бесконечность из JSON отбивается", async () => {
    expect(JSON.parse('{"v":1e400}').v).toBe(Infinity); // контроль предпосылки
    const res = await postRaw('{"title":"Курс","category":"tech","price":1e400}');
    expect(res.status).toBe(400);
  });

  test("доля цента отбивается", async () => {
    expect((await post({ ...OK, price: 1.005 })).status).toBe(400);
  });

  test("хвост от умножения на 100 не мешает — форма шлёт именно такие числа", async () => {
    expect(Number("19.99") * 100).toBe(1998.9999999999998); // контроль предпосылки
    const res = await post({ ...OK, price: Number("19.99") * 100 });
    expect(res.status).toBe(201);
    expect(res.body.course.price).toBe(1999);
  });

  test("бесплатный курс проходит", async () => {
    expect((await post({ ...OK, price: 0 })).status).toBe(201);
    expect((await post({ ...OK })).status).toBe(201);
  });

  test("неизвестная категория отбивается", async () => {
    const res = await post({ ...OK, category: "не-существует" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown category");
  });

  test("неизвестный уровень отбивается", async () => {
    const res = await post({ ...OK, level: "мастер" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown level");
  });

  test("слишком длинное название отбивается", async () => {
    expect((await post({ ...OK, title: "x".repeat(201) })).status).toBe(400);
  });

  /**
   * Длительность урока и порядковый номер брались тем же `Number(x) || 0`:
   * отрицательное сохранялось как есть, `1e400` уходило в целочисленную
   * колонку. Здесь мусор приводится к нулю, а не отклоняет урок целиком — это
   * второстепенные поля.
   */
  test("длительность и номер урока приводятся к разумным границам", async () => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM "QLearnCourse"')) {
        return { rows: [{ id: "course-1", authorId: "author-1", title: "Курс" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const lesson = (body: unknown) =>
      request(makeApp())
        .post("/api/qlearn/me/courses/course-1/lessons")
        .set("Authorization", AUTH)
        .send(body as object);

    const negative = await lesson({ title: "Урок", duration: -200, order: -5 });
    expect(negative.status).toBe(201);
    expect(negative.body.lesson.duration).toBe(0);
    expect(negative.body.lesson.order).toBe(0);

    const huge = await lesson({ title: "Урок", duration: 999999, order: 999999 });
    expect(huge.body.lesson.duration).toBe(24 * 60);
    expect(huge.body.lesson.order).toBe(10000);

    const fractional = await lesson({ title: "Урок", duration: 12.7, order: 3.2 });
    expect(fractional.body.lesson.duration).toBe(13);
    expect(fractional.body.lesson.order).toBe(3);
  });
});

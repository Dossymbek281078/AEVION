import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Создание поста ограничивало только длину текста. Остальное уходило в базу как
 * есть:
 *
 *  - `type` любой строкой, хотя интерфейс знает три вида и ветвится по ним:
 *    неизвестный тип показывался как обычный текст, а в данных лежало другое;
 *  - `mediaUrl` любой строкой, а она уходит в разметку (`<img src={...}>`);
 *  - метки — списком любой длины и с любыми строками.
 *
 * Тест нужен ещё и потому, что первая попытка правки вставила проверки ВНУТРЬ
 * предыдущего блока, после `return` — компилятор промолчал, код был мёртвым.
 * Тесты — единственное, что это ловит.
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

const AUTH = `Bearer ${signJwt({ sub: "user-1", email: "u@test.aev", role: "USER" })}`;

const post = (body: unknown) =>
  request(makeApp()).post("/api/qsocial/posts").set("Authorization", AUTH).send(body as object);

describe("QSocial: ввод при создании поста проверяется", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("обычный пост создаётся", async () => {
    expect((await post({ content: "привет", type: "text" })).status).toBe(201);
  });

  test("слишком длинный текст по-прежнему отбивается", async () => {
    const res = await post({ content: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  test("неизвестный тип поста отбивается", async () => {
    const res = await post({ content: "привет", type: "хроника" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown type");
  });

  test("известные типы проходят", async () => {
    for (const t of ["text", "image", "video"]) {
      expect((await post({ content: "привет", type: t })).status).toBe(201);
    }
  });

  test("ссылка на медиа обязана быть абсолютной http(s)", async () => {
    expect((await post({ content: "привет", mediaUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await post({ content: "привет", mediaUrl: "/local/a.png" })).status).toBe(400);
    expect((await post({ content: "привет", mediaUrl: "https://cdn.example.com/a.png" })).status).toBe(201);
  });

  test("метки строкой вместо массива отбиваются", async () => {
    expect((await post({ content: "привет", tags: "одна, вторая" })).status).toBe(400);
  });

  test("слишком много меток и слишком длинная метка отбиваются", async () => {
    expect((await post({ content: "привет", tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })).status).toBe(400);
    expect((await post({ content: "привет", tags: ["x".repeat(41)] })).status).toBe(400);
  });
});

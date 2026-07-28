import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Создание документа принимало параметры доступа без единой проверки, а это
 * ровно то, чем модуль отличается от PandaDoc: пароль, лимит просмотров, срок.
 *
 * Что было:
 *  - `maxViews: 0` или отрицательное → документ создаётся (201, ссылка выдана),
 *    но не открывается НИКОГДА: условие выдачи `view_count < max_views` ложно
 *    с первого раза. Владелец об этом не узнает, получатель видит 410.
 *  - `maxViews: 1e400` (в JSON это Infinity) и дробное → вставка в целочисленную
 *    колонку падает, наружу уходит 500 вместо внятного отказа.
 *  - `expiresAt: "позавчера"` → непарсимая строка уходит в timestamptz и даёт
 *    500; дата в прошлом создаёт документ, уже мёртвый.
 *  - `contentType: "URL"` с большой буквы проскакивает мимо проверки схемы и
 *    ложится в базу как есть.
 *
 * Проверяем через НАСТОЯЩИЙ обработчик: валидация стоит до обращения к базе,
 * поэтому запрос до пула не доходит — и это тоже проверяется (mockQuery не
 * должен быть вызван).
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
import { qcontractRouter } from "../src/routes/qcontract";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qcontract", qcontractRouter);
  return app;
}

const AUTH = `Bearer ${signJwt({ sub: "u1", email: "u1@test.aev", role: "USER" })}`;

function post(body: unknown) {
  return request(makeApp()).post("/api/qcontract/documents").set("Authorization", AUTH).send(body as object);
}

const OK = { title: "Договор", content: "Текст договора", contentType: "text" as const };

describe("QContract: параметры доступа проверяются при создании", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // ensureTables и INSERT — пустой успешный ответ
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  test("лимит просмотров 0 отбивается, документ не создаётся", async () => {
    const res = await post({ ...OK, maxViews: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maxViews/);
    // до INSERT дело не дошло: единственные запросы могли быть от ensureTables
    const inserts = mockQuery.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    expect(inserts).toHaveLength(0);
  });

  test("отрицательный лимит отбивается", async () => {
    expect((await post({ ...OK, maxViews: -3 })).status).toBe(400);
  });

  test("дробный лимит отбивается", async () => {
    expect((await post({ ...OK, maxViews: 2.5 })).status).toBe(400);
  });

  test("бесконечность из JSON отбивается, а не роняет вставку", async () => {
    // Через объект это не выразить: `JSON.stringify({v: Infinity})` даёт
    // `{"v":null}`. По проводу же приходит ИМЕННО текст `1e400`, и
    // `JSON.parse` превращает его в Infinity — так что дыра настоящая, а
    // выразить её можно только сырым телом.
    expect(JSON.stringify({ v: Infinity })).toBe('{"v":null}'); // контроль предпосылки
    expect(JSON.parse('{"v":1e400}').v).toBe(Infinity);

    const res = await request(makeApp())
      .post("/api/qcontract/documents")
      .set("Authorization", AUTH)
      .set("Content-Type", "application/json")
      .send('{"title":"Договор","content":"Текст","contentType":"text","maxViews":1e400}');

    expect(res.status).toBe(400);
    const inserts = mockQuery.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    expect(inserts).toHaveLength(0);
  });

  test("нормальный лимит проходит", async () => {
    const res = await post({ ...OK, maxViews: 3 });
    expect(res.status).toBe(201);
    expect(res.body.shareUrl).toContain("/qcontract/v/");
  });

  test("непарсимый срок отбивается, а не даёт 500", async () => {
    const res = await post({ ...OK, expiresAt: "позавчера" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_expiresAt");
  });

  test("срок в прошлом отбивается — иначе документ мёртв с рождения", async () => {
    const res = await post({ ...OK, expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("expiresAt_must_be_future");
  });

  test("срок в будущем проходит и нормализуется в ISO", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await post({ ...OK, expiresAt: future });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    expect(insert?.[1]?.[8]).toBe(future);
  });

  test("неизвестный тип содержимого отбивается", async () => {
    expect((await post({ ...OK, contentType: "URL" })).status).toBe(400);
    expect((await post({ ...OK, contentType: "markdown" })).status).toBe(400);
  });

  test("слишком длинный заголовок отбивается", async () => {
    const res = await post({ ...OK, title: "x".repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("title_too_long");
  });
});

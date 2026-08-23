import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { makeApiNotFoundHandler, makeHttpErrorHandler } from "../src/lib/httpErrorHandler";

// Неизвестный адрес API — 23.08.2026.
//
// Замер на проде (коммит b12658b97dff) до этой правки:
//
//   GET /api/no-such-thing        → 404 text/html
//   GET /api/build/no-such        → 404 text/html
//   GET /api/auth/sign-out-everywhere (маршрут только POST) → 404 text/html
//
// Отвечала СТРАНИЦА Express: `<!DOCTYPE html>...<title>Error</title>`. Для API,
// где все остальные ответы — JSON, это не косметика: клиент делает `r.json()` и
// получает сбой разбора вместо «такого адреса нет». Отказ маскируется под
// поломку клиента, и разбирать его начинают не с той стороны.

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

/** Сервер того же устройства, что боевой: роутер, потом 404, потом ошибки. */
function app() {
  const a = express();
  a.get("/api/real", (_req, res) => {
    res.json({ ok: true });
  });
  a.post("/api/only-post", (_req, res) => {
    res.json({ ok: true });
  });
  a.get("/pages/real", (_req, res) => {
    res.type("html").send("<h1>страница</h1>");
  });
  a.use(makeApiNotFoundHandler());
  a.use(makeHttpErrorHandler(vi.fn()));
  return a;
}

describe("неизвестный адрес API отвечает JSON, а не страницей", () => {
  test("несуществующий путь: 404 и разбираемое тело", async () => {
    const r = await request(app()).get("/api/no-such-thing");
    expect(r.status).toBe(404);
    expect(r.headers["content-type"]).toMatch(/application\/json/);
    expect(r.body.error).toBe("route_not_found");
    // Тело должно РАЗБИРАТЬСЯ — ради этого правка и делалась.
    expect(() => JSON.parse(r.text)).not.toThrow();
    expect(r.text).not.toMatch(/<!DOCTYPE html>/i);
  });

  test("верный путь, но другой метод — тоже JSON", async () => {
    const r = await request(app()).get("/api/only-post");
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("route_not_found");
    // Метод возвращаем: без него человек не понимает, что перепутал именно его.
    expect(r.body.method).toBe("GET");
  });

  test("живой маршрут обработчик не перехватывает", async () => {
    const r = await request(app()).get("/api/real");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  test("вне /api формат ответа не меняется", async () => {
    // Обработчик намеренно узкий: страницы и статика живут по своим правилам,
    // и превращать их 404 в JSON этой правкой незачем.
    const r = await request(app()).get("/pages/no-such");
    expect(r.status).toBe(404);
    expect(r.headers["content-type"]).not.toMatch(/application\/json/);
  });

  test("путь запроса обратно НЕ отражается", async () => {
    // Клиент свой путь и так знает, а отражение пришедшей строки — привычка,
    // которая в других местах уже давала находки. Для разбора есть журнал.
    const r = await request(app()).get("/api/secret-looking-path-12345");
    expect(JSON.stringify(r.body)).not.toContain("secret-looking-path-12345");
  });

  test("отказ попадает в журнал — иначе он невидим", async () => {
    await request(app()).get("/api/no-such-thing");
    const said = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(said).toContain("/api/no-such-thing");
  });
});

describe("обработчик смонтирован там, где нужно", () => {
  // Сам по себе рабочий обработчик ничего не значит, если его не позвали или
  // позвали не в том месте. Порядок в index.ts проверяется отдельно: это уже
  // случалось — механизм собран, части не связаны (§16).
  const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");

  test("index.ts его вызывает", () => {
    expect(src).toContain("app.use(makeApiNotFoundHandler());");
  });

  test("стоит ПЕРЕД обработчиком ошибок", () => {
    const notFound = src.indexOf("app.use(makeApiNotFoundHandler());");
    const errors = src.indexOf("app.use(makeHttpErrorHandler());");
    expect(notFound).toBeGreaterThan(-1);
    expect(errors).toBeGreaterThan(-1);
    expect(notFound).toBeLessThan(errors);
  });

  test("стоит ПОСЛЕ последнего роутера — иначе перехватит живое", () => {
    const notFound = src.indexOf("app.use(makeApiNotFoundHandler());");
    const lastRouter = src.lastIndexOf('app.use("/api');
    expect(lastRouter).toBeGreaterThan(-1);
    expect(lastRouter).toBeLessThan(notFound);
  });
});

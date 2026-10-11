/**
 * Сторож входа и потолка у /api/mcp-demo — ЗАПРОСОМ к роутеру, а не вызовом функции.
 *
 * Повод (замер 11.10.2026): на проде MCP_DEMO_TOKEN не задан, и ручка отвечала
 * анониму (tools/list → 200, три инструмента). Записи были выключены отсутствием
 * MCP_DEMO_WRITES, денег она не тратит, чужого не отдаёт — но закрыть её надо,
 * и закрыть так, чтобы проверка не висела на одном методе.
 *
 * Каждый тест берёт СВЕЖИЙ модуль (vi.resetModules), иначе общая корзина
 * потолка перетекает между тестами и последний случай зеленеет на чужом счёте.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

const ТОКЕН = "f".repeat(96);
const СПИСОК = { jsonrpc: "2.0", id: 1, method: "tools/list" };

async function поднять() {
  vi.resetModules();
  const { mcpDemoRouter } = await import("../src/routes/mcpDemo");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/mcp-demo", mcpDemoRouter);
  return app;
}

beforeEach(() => {
  delete process.env.MCP_DEMO_TOKEN;
  delete process.env.MCP_DEMO_WRITES;
});
afterEach(() => {
  delete process.env.MCP_DEMO_TOKEN;
});

describe("/api/mcp-demo — вход", () => {
  test("токен не задан — отвечает как раньше (поведение прода до правки)", async () => {
    const app = await поднять();
    const r = await request(app).post("/api/mcp-demo").send(СПИСОК);
    expect(r.status).toBe(200);
    expect(r.body.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "list_modules",
      "module_info",
      "qsign_sign",
    ]);
  });

  test("токен задан, заголовка нет — 401 и инструменты НЕ названы", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    const r = await request(app).post("/api/mcp-demo").send(СПИСОК);
    expect(r.status).toBe(401);
    expect(JSON.stringify(r.body)).not.toContain("list_modules");
  });

  test("токен задан и верен — 200", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    const r = await request(app)
      .post("/api/mcp-demo")
      .set("Authorization", "Bearer " + ТОКЕН)
      .send(СПИСОК);
    expect(r.status).toBe(200);
    expect(r.body.result.tools.length).toBe(3);
  });

  test("неверный токен ТОЙ ЖЕ длины — 401 (а не «любой заголовок пускает»)", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    const r = await request(app)
      .post("/api/mcp-demo")
      .set("Authorization", "Bearer " + "e".repeat(96))
      .send(СПИСОК);
    expect(r.status).toBe(401);
  });

  test("неверный токен ДРУГОЙ длины — тоже 401 (мутация на сравнении длин выжила без этого случая)", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    for (const чужой of ["e", "e".repeat(95), "e".repeat(200)]) {
      const r = await request(app)
        .post("/api/mcp-demo")
        .set("Authorization", "Bearer " + чужой)
        .send(СПИСОК);
      expect(r.status, "длина " + чужой.length).toBe(401);
    }
  });

  test("токен проверяется у ЛЮБОГО метода, не только POST", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    const закрыт = await request(app).get("/api/mcp-demo");
    expect(закрыт.status).toBe(401);

    // Контроль: 401 даёт именно проверка входа, а не отсутствие обработчика GET —
    // без требуемого токена тот же GET проваливается дальше и даёт 404.
    delete process.env.MCP_DEMO_TOKEN;
    const свободен = await поднять();
    const открыт = await request(свободен).get("/api/mcp-demo");
    expect(открыт.status).toBe(404);
  });
});

describe("/api/mcp-demo — потолок без токена", () => {
  test("61-й запрос без токена в минуту отбивается 429", async () => {
    const app = await поднять();
    let последний = 0;
    for (let i = 0; i < 61; i++) {
      const r = await request(app).post("/api/mcp-demo").send(СПИСОК);
      последний = r.status;
      if (i < 60) expect(r.status).toBe(200);
    }
    expect(последний).toBe(429);
  }, 30_000);

  test("вошедшего потолок не касается — 61 запрос с токеном проходит", async () => {
    process.env.MCP_DEMO_TOKEN = ТОКЕН;
    const app = await поднять();
    let последний = 0;
    for (let i = 0; i < 61; i++) {
      const r = await request(app)
        .post("/api/mcp-demo")
        .set("Authorization", "Bearer " + ТОКЕН)
        .send(СПИСОК);
      последний = r.status;
    }
    expect(последний).toBe(200);
  }, 30_000);
});

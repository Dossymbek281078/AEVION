import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";

/**
 * Замер прода 08.09.2026 (зонд враждебного входа, только читающие ручки):
 *
 *     404  /projects/abc          <- честно
 *     404  /projects/%01          <- честно
 *     404  /projects/%0a          <- честно
 *     503  /projects/%00          <- «Хранилище временно недоступно»
 *     503  /projects/abc%00def
 *     503  /snippets/abc%00
 *
 * Байт NUL доезжал до параметра запроса, Postgres такую строку не принимает, и
 * наш catch объявлял это отказом хранилища. Два дефекта в одном: клиентская
 * ошибка отвечала 5xx (шум в тревогах — ворота §3.4), и человеку сообщалась
 * НЕПРАВДА про нашу базу, а витрина по тому же признаку рисует полосу
 * деградации. Любой обход с кривой ссылкой делал сигнал здоровья ложно красным.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("управляющий байт в адресе — разговор о запросе, не о нас", () => {
  for (const path of ["/api/devhub/projects/%00", "/api/devhub/projects/abc%00def", "/api/devhub/snippets/abc%00"]) {
    test(`${path}: 400, а не отказ хранилища`, async () => {
      const r = await request(makeApp()).get(path);
      expect(r.status, "клиентская ошибка снова отвечает как наша авария").toBe(400);
      expect(r.body.error).toBe("invalid_path");
      expect(
        JSON.stringify(r.body).toLowerCase(),
        "человеку сообщается неправда про хранилище",
      ).not.toContain("storage");
      expect(JSON.stringify(r.body)).not.toContain("Хранилище");
    });
  }

  test("битая процентная последовательность — тоже 400, а не падение", async () => {
    const r = await request(makeApp()).get("/api/devhub/projects/%zz");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_path");
  });

  test("КОНТРОЛЬ: обычный адрес прослойка не трогает", async () => {
    const r = await request(makeApp()).get("/api/devhub/projects/abc");
    expect(r.status, "прослойка отбивает законные адреса").not.toBe(400);
  });

  test("КОНТРОЛЬ: живая ручка отвечает по-прежнему", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/capabilities");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.capabilities)).toBe(true);
  });
});

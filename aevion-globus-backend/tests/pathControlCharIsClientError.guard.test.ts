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

describe("отказ поставщика перевода не выносит наружу его ответ", () => {
  test("тело ответа DeepL заменено категорией, код наш", async () => {
    // Замер 08.09.2026: общая ветка отдавала `DeepL error: <300 знаков чужого
    // JSON>` и код ответа поставщика КАК СВОЙ. Граница показа на клиенте такой
    // текст не узнаёт — она ловит имена переменных и панели, — поэтому человек
    // читал бы чужой JSON в скобках после «Не удалось перевести».
    //
    // Ветку 456 намеренно НЕ трогаем: её текст называет DEEPL_API_KEY, и
    // именно поэтому граница его прячет, а подробность (их /v2/usage врёт)
    // остаётся нам. Это закреплено отдельным тестом в devhub-integrations.
    process.env.DEEPL_API_KEY = "key:fx";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 403,
      text: async () => '{"message":"Wrong endpoint. Use api.deepl.com","detail":"internal-7"}',
    })) as unknown as typeof fetch;
    try {
      const r = await request(makeApp())
        .post("/api/devhub/media/translate")
        .send({ text: "Привет", targetLang: "EN" });
      expect(r.status, "код поставщика выдан за наш").toBe(502);
      expect(r.body.code).toBe("provider_error");
      expect(JSON.stringify(r.body), "тело ответа поставщика ушло наружу").not.toContain("Wrong endpoint");
      expect(JSON.stringify(r.body)).not.toContain("internal-7");
      expect(String(r.body.error).length, "человек остался без объяснения").toBeGreaterThan(10);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.DEEPL_API_KEY;
    }
  });
});

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";

/**
 * «Файлы исчезнут навсегда» — обещание согласия на удаление. Оно обязано быть
 * правдой во ВСЕХ местах, где лежит содержимое файлов, а не только в таблице
 * файлов.
 *
 * Замер 08.09.2026: удаление сносило `DevHubFile` и `DevHubProject`, а
 * `DevHubCheckpoint` оставался. У него поле `files` — JSONB с ПОЛНЫМ
 * содержимым на момент снимка (история отката), то есть копии кода человека
 * жили дальше в другой таблице. На пути удаления это хуже, чем где-либо ещё:
 * именно здесь человек рассчитывает, что за него сделают ровно сказанное.
 *
 * Тест идёт через настоящие ручки, а не через внутренние функции: спрашивать
 * надо то, что видит вызывающий.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

const guest = { "x-devhub-guest": "delete-guard-guest" };

// Снимок создаётся ВНУТРИ генерации — отдельной ручки нет. Значит и тест идёт
// настоящим путём: подменяем провайдера и просим сгенерировать, как это делает
// человек. Проверять внутреннюю функцию было бы проверкой не того.
let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;
const ответПровайдера = (text: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 5, completion_tokens: 9 } }),
  text: async () => text,
}) as unknown as Response;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    ответПровайдера('{"files":[{"path":"index.html","content":"<h1>секрет владельца</h1>","language":"html"}]}'),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.OPENAI_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
});

describe("удаление не оставляет копий файлов", () => {
  test("контрольные точки проекта исчезают вместе с ним", async () => {
    const app = makeApp();
    const создан = await request(app).post("/api/devhub/projects").set(guest)
      .send({ name: "to-delete", stack: "static" });
    const pid = создан.body.project?.id;
    expect(pid, "проект не создан — сторож мерит не тот путь").toBeTruthy();

    // Генерация — тот самый путь, на котором снимок и появляется.
    const ген = await request(app).post(`/api/devhub/projects/${pid}/generate`).set(guest)
      .send({ prompt: "страница с заголовком" });
    expect(ген.status).toBe(200);

    const до = await request(app).get(`/api/devhub/projects/${pid}/checkpoints`).set(guest);
    expect(
      (до.body.checkpoints ?? []).length,
      "снимок не создан — дальше проверялась бы пустота, и тест был бы зелёным ни о чём",
    ).toBeGreaterThan(0);

    const удаление = await request(app).delete(`/api/devhub/projects/${pid}`).set(guest);
    expect(удаление.status).toBe(200);

    // Проект удалён, поэтому спрашиваем ручку снимков заново: она обязана
    // ответить «нет проекта» либо пустым списком, но НЕ отдать прежние снимки.
    const после = await request(app).get(`/api/devhub/projects/${pid}/checkpoints`).set(guest);
    const осталось = (после.body?.checkpoints ?? []).length;
    expect(
      осталось,
      "снимки пережили удаление проекта — в них лежат полные копии файлов",
    ).toBe(0);
  });

  test("история выкаток проекта тоже исчезает", async () => {
    const app = makeApp();
    const создан = await request(app).post("/api/devhub/projects").set(guest)
      .send({ name: "to-delete-2", stack: "static" });
    const pid = создан.body.project?.id;
    await request(app).delete(`/api/devhub/projects/${pid}`).set(guest);
    const после = await request(app).get(`/api/devhub/projects/${pid}/deployments`).set(guest);
    expect((после.body?.deployments ?? []).length, "выкатки остались сиротами").toBe(0);
  });

  test("счётчики расхода и тариф НЕ трогаются: они про человека, а не про проект", () => {
    // Утверждение о ЗАМЫСЛЕ, а не о поведении: снос учёта вместе с проектом
    // стёр бы след платного расхода, и это была бы противоположная ошибка.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    const тело = src.slice(src.indexOf("async function dbDeleteProject"), src.indexOf("function rowToProject"));
    expect(тело).toContain('DELETE FROM "DevHubCheckpoint"');
    expect(тело).toContain('DELETE FROM "DevHubDeployment"');
    expect(тело, "удаление стирает счётчики расхода — след платного исчезнет").not.toContain('DELETE FROM "DevHubUsage"');
    expect(тело, "удаление стирает тариф человека").not.toContain('DELETE FROM "DevHubTier"');
  });
});

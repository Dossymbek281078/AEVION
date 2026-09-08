import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";

/**
 * У ОБРЫВА ответа модели два исхода, и раньше они назывались одним словом.
 *
 * Ответ модели упирается в предел длины и обрывается на середине файла. Мы
 * спасаем целые объекты из обрезанного JSON и делаем ОДИН дозапрос за
 * недостающими файлами. Дозапрос может не удаться — провайдер отказал, ответ
 * не разобрался. Тогда у человека на руках ОБРЕЗАННЫЙ набор.
 *
 * Флаг `continued` ставился в ОБОИХ случаях (строка стояла ПОСЛЕ try/catch), и
 * экран печатал по нему «недостающие файлы дозагружены отдельным вызовом» —
 * то есть при неудаче человеку сообщался результат, которого не было, поверх
 * неполного проекта. Это хуже молчания: получив сообщение об успехе, человек
 * не идёт проверять.
 *
 * Теперь исходы разные: `continued` — дозагрузили, `truncated` + число
 * сохранённых файлов — не смогли.
 */
let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

/** Ответ, оборванный внутри второго файла: первый спасается, второй нет. */
const ОБРЕЗАННЫЙ = '{"files":[{"path":"index.html","content":"<h1>Пекарня</h1>","language":"html"},{"path":"style.css","content":"body{col';

function ответПровайдера(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }),
    text: async () => text,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.OPENAI_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
});

describe("обрыв ответа модели называется своим именем", () => {
  test("дозапрос НЕ удался — сказано «оборвалось», а не «дозагружено»", async () => {
    // Первый вызов обрывается, второй (дозапрос) отвечает мусором.
    fetchMock
      .mockResolvedValueOnce(ответПровайдера(ОБРЕЗАННЫЙ))
      .mockResolvedValue(ответПровайдера("извините, не понял"));

    const app = makeApp();
    const создан = await request(app).post("/api/devhub/projects")
      .set({ "x-devhub-guest": "trunc-guest" }).send({ name: "trunc", stack: "static" });
    const pid = создан.body.project?.id;
    expect(pid, "проект не создан — сторож мерит не тот путь").toBeTruthy();

    const r = await request(app).post(`/api/devhub/projects/${pid}/generate`)
      .set({ "x-devhub-guest": "trunc-guest" })
      .send({ prompt: "страница пекарни" });

    expect(r.status).toBe(200);
    expect(r.body.truncated, "обрыв не объявлен — человек считает набор полным").toBe(true);
    expect(r.body.continued, "неудачный дозапрос выдан за удачный").toBeFalsy();
    expect(r.body.recoveredFiles, "не сказано, сколько файлов уцелело").toBeGreaterThan(0);

    await request(app).delete(`/api/devhub/projects/${pid}`).set({ "x-devhub-guest": "trunc-guest" });
  });

  test("дозапрос УДАЛСЯ — сказано «дозагружено», обрыв не объявляется", async () => {
    fetchMock
      .mockResolvedValueOnce(ответПровайдера(ОБРЕЗАННЫЙ))
      .mockResolvedValue(ответПровайдера('{"files":[{"path":"style.css","content":"body{color:#000}","language":"css"}]}'));

    const app = makeApp();
    const создан = await request(app).post("/api/devhub/projects")
      .set({ "x-devhub-guest": "cont-guest" }).send({ name: "cont", stack: "static" });
    const pid = создан.body.project?.id;

    const r = await request(app).post(`/api/devhub/projects/${pid}/generate`)
      .set({ "x-devhub-guest": "cont-guest" })
      .send({ prompt: "страница пекарни" });

    expect(r.body.continued, "удачный дозапрос не отмечен").toBe(true);
    expect(r.body.truncated, "удачный дозапрос объявлен обрывом — тревога на ровном месте").toBeFalsy();
    expect((r.body.files ?? []).length, "дозагруженный файл не доехал").toBeGreaterThanOrEqual(2);

    await request(app).delete(`/api/devhub/projects/${pid}`).set({ "x-devhub-guest": "cont-guest" });
  });
});

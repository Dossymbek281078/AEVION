import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

// Поведенческое доказательство починки гонки квот (ревью 06.09.2026).
//
// Было: Promise.all по шагам workflow — каждый шаг сам делал checkCredit, и
// одиннадцать параллельных проверок читали used=0 при лимите 10 ДО первого
// списания: проходили все, лимит переливался. Стало: runWorkflowGroup
// проверяет и резервирует СУММУ до старта батча — батч, не влезающий в
// остаток, отказывается ЦЕЛИКОМ, не потратив ни одного вызова провайдера.

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => {
  __resetDevHubStore();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.OPENAI_API_KEY = "fake-key-for-test";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
});

async function makeProject(app: express.Express): Promise<string> {
  const r = await request(app)
    .post("/api/devhub/projects")
    .set("x-devhub-guest", "batch-quota-test-guest")
    .send({ name: "batch quota", stack: "static" });
  expect(r.status).toBe(201);
  return r.body.project.id;
}

describe("квоты параллельного батча workflow", () => {
  test("батч из 11 шагов image при лимите free=10 отказывается целиком, провайдер не вызван, квота цела", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockClear(); // создание проекта провайдера не звало, но чистим для честного нуля

    const steps = Array.from({ length: 11 }, () => ({ type: "image", prompt: "закат" }));
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .set("x-devhub-guest", "batch-quota-test-guest")
      .send({ steps });

    expect(r.status).toBe(200);
    expect(r.body.totalSteps).toBe(11);
    expect(r.body.successCount, "гонка вернулась: часть шагов прошла сверх лимита").toBe(0);
    for (const step of r.body.results) {
      expect(step.ok).toBe(false);
      expect(step.error).toMatch(/limit reached/);
    }
    // Ни один вызов не дошёл до провайдера — деньги не потрачены.
    const providerCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("openai.com"));
    expect(providerCalls.length, "отказанный батч всё же позвал провайдера").toBe(0);

    // И квота не тронута: отказ до резервирования ничего не списывает.
    const credits = await request(app)
      .get("/api/devhub/studio/credits")
      .set("x-devhub-guest", "batch-quota-test-guest");
    expect(credits.body.usage.image.used).toBe(0);
  });

  test("батч в пределах лимита проходит и списывает ровно свой размер", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ url: "https://img.example/x.png" }] }),
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Response);

    const steps = [{ type: "image", prompt: "закат" }, { type: "image", prompt: "рассвет" }];
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .set("x-devhub-guest", "batch-quota-test-guest")
      .send({ steps });

    expect(r.status).toBe(200);
    expect(r.body.successCount, `шаги не прошли: ${JSON.stringify(r.body.results)}`).toBe(2);

    const credits = await request(app)
      .get("/api/devhub/studio/credits")
      .set("x-devhub-guest", "batch-quota-test-guest");
    expect(credits.body.usage.image.used, "списано не столько, сколько сделано").toBe(2);
  });
});

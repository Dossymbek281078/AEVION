import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";
import { filesHash, sha256Hex } from "../src/lib/devhubProvenance";

// Пять критериев приёмки спеки провенанса (05-DevHub/2026-09-06-СПЕКА-…):
// 1 — генерация с флагом возвращает provenance.verifyUrl;
// 3 — без флага в QRight не пишется НИЧЕГО;
// 4 — отказ QRight не роняет генерацию, но оставляет след в ответе;
// 5 — промпт НЕ попадает в запись (только его sha256).
// Критерий 2 (страница verifyUrl открывается без входа и называет хеш+время)
// проверяется формой verifyUrl здесь и живой пробой после выкатки.

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

const MODEL_REPLY = JSON.stringify({
  files: [{ path: "index.html", content: "<h1>кофейня</h1>", language: "html" }],
});

function okModelResponse() {
  return {
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: MODEL_REPLY } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }),
    text: async () => "",
  } as unknown as Response;
}

function okQrightResponse(id = "qr-object-1") {
  return { ok: true, status: 201, json: async () => ({ id }), text: async () => "" } as unknown as Response;
}

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

async function makeProject(app: express.Express): Promise<string> {
  const r = await request(app)
    .post("/api/devhub/projects")
    .set("x-devhub-guest", "provenance-test-guest")
    .send({ name: "Проект провенанса", stack: "static" });
  expect(r.status).toBe(201);
  return r.body.project.id;
}

beforeEach(() => {
  __resetDevHubStore();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.OPENAI_API_KEY = "fake-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
});

const PROMPT = "секретная бизнес-идея: лендинг кофейни у моста";

describe("провенанс ИИ-генераций", () => {
  test("критерии 1 и 5: с флагом приходит verifyUrl; в записи хеш промпта, а не промпт", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/qright/objects")) return okQrightResponse();
      return okModelResponse();
    });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/generate`)
      .set("x-devhub-guest", "provenance-test-guest")
      .send({ prompt: PROMPT, provenance: true });

    expect(r.status).toBe(200);
    expect(r.body.provenance?.certId).toBe("qr-object-1");
    expect(r.body.provenance?.verifyUrl).toMatch(/\/api\/qright\/embed\/qr-object-1$/);

    const qrightCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/qright/objects"));
    expect(qrightCall, "вызов QRight не состоялся").toBeTruthy();
    const sentBody = String((qrightCall![1] as { body: string }).body);
    expect(sentBody.includes(PROMPT), "ПРОМПТ УШЁЛ В ПУБЛИЧНУЮ ЗАПИСЬ").toBe(false);
    expect(sentBody.includes(sha256Hex(PROMPT)), "хеша промпта нет в записи").toBe(true);
    expect(sentBody.includes(filesHash([{ path: "index.html", content: "<h1>кофейня</h1>" }])),
      "хеша файлов нет в записи").toBe(true);
  });

  test("критерий 3: без флага QRight не зовётся вовсе", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockImplementation(async () => okModelResponse());

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/generate`)
      .set("x-devhub-guest", "provenance-test-guest")
      .send({ prompt: PROMPT });

    expect(r.status).toBe(200);
    expect(r.body.provenance).toBeUndefined();
    const qrightCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/qright"));
    expect(qrightCalls.length).toBe(0);
  });

  test("критерий 4: отказ QRight не роняет генерацию и оставляет след", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/qright/objects")) throw new Error("qright down");
      return okModelResponse();
    });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/generate`)
      .set("x-devhub-guest", "provenance-test-guest")
      .send({ prompt: PROMPT, provenance: true });

    expect(r.status, `отказ фиксации уронил генерацию: ${JSON.stringify(r.body)}`).toBe(200);
    expect(r.body.files?.length).toBe(1);
    expect(r.body.provenance).toBeNull();
    expect(String(r.body.provenanceError || "").length, "след отказа пуст — молчаливый отказ").toBeGreaterThan(0);
  });

  test("заглушка без провайдера НЕ помечается: провенанс фальшивки хуже отсутствия", async () => {
    delete process.env.OPENAI_API_KEY;
    const app = makeApp();
    const id = await makeProject(app);
    fetchMock.mockImplementation(async () => okQrightResponse());

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/generate`)
      .set("x-devhub-guest", "provenance-test-guest")
      .send({ prompt: PROMPT, provenance: true });

    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(false);
    expect(r.body.provenance).toBeNull();
    expect(r.body.provenanceError).toBe("not_ai_generated");
    const qrightCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/qright"));
    expect(qrightCalls.length, "заглушку понесли в QRight").toBe(0);
  });
});

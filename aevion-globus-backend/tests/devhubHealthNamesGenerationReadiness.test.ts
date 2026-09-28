import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Health DevHub обязан отвечать про ГЕНЕРАЦИЮ, а не только про хранилище.
 *
 * 28.09.2026. Ручка честно писала covers: "storage" — и это было правильно, но
 * недостаточно: модуль держится на генерации, и при мёртвом ИИ ответ остался бы
 * зелёным. Соседнее окно поймало живой случай класса: лимит аккаунта Anthropic
 * исчерпан до 01.10, и тот, кто зовёт его напрямую, молча перестаёт работать.
 *
 * Сторож держит ДВЕ стороны: поле есть и оно отвечает ПРАВДУ — при живом
 * провайдере ready:true, при мёртвых ready:false.
 */
const { реестр } = vi.hoisted(() => ({ реестр: { провайдеры: [] as any[], простой: new Set<string>() } }));

vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const настоящий = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...настоящий,
    getProviders: () => реестр.провайдеры,
    isProviderOutOfService: (id: string) => реестр.простой.has(id),
  };
});
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("health DevHub называет готовность генерации", () => {
  beforeEach(() => {
    реестр.провайдеры = [
      { id: "gemini", configured: true },
      { id: "openai", configured: true },
      { id: "stub", configured: true },
      { id: "groq", configured: false },
    ];
    реестр.простой = new Set();
  });

  test("есть живой провайдер — ready:true и он назван", async () => {
    const r = await request(приложение()).get("/api/devhub/health");
    expect(r.status).toBe(200);
    expect(r.body.generation.ready).toBe(true);
    expect(r.body.generation.next).toBe("gemini");
    // stub не считается провайдером генерации, ненастроенный — тоже
    expect(r.body.generation.configured).toBe(2);
  });

  test("все живые ушли в простой — ready:false, и это видно при зелёном хранилище", async () => {
    реестр.простой = new Set(["gemini", "openai"]);
    const r = await request(приложение()).get("/api/devhub/health");
    expect(r.body.status).toBe("ok");
    expect(r.body.generation.ready).toBe(false);
    expect(r.body.generation.providers).toBe(0);
    expect(r.body.generation.next).toBeNull();
  });

  test("ни одного настроенного — ready:false", async () => {
    реестр.провайдеры = [{ id: "stub", configured: true }, { id: "groq", configured: false }];
    const r = await request(приложение()).get("/api/devhub/health");
    expect(r.body.generation.ready).toBe(false);
    expect(r.body.generation.configured).toBe(0);
  });

  test("covers по-прежнему честно ограничивает себя хранилищем", async () => {
    // Поле читают снаружи, и расширять его смысл молча нельзя — поэтому признак
    // генерации отдан ОТДЕЛЬНЫМ полем, а covers остаётся про хранилище.
    const r = await request(приложение()).get("/api/devhub/health");
    expect(r.body.covers).toBe("storage");
    expect(r.body.generation).toBeTruthy();
  });
});

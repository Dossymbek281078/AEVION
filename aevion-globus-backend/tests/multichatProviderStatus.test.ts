// Что именно /provider-status знает о поставщиках.
//
// Ручка собирает данные из /api/qcoreai/providers, а тот СИНХРОННЫЙ: читает
// переменные окружения и перечисляет провайдеров, у которых задан ключ.
// Обращения к Anthropic, OpenAI и остальным там нет ни одной строкой.
//
// При этом ответ содержал `reachable: configured && r.ok`, где `r.ok` — это
// «наш собственный внутренний маршрут ответил 200». То есть поле с именем
// «достижим» означало «ключ задан, и наш бэкенд жив», а UI и SDK читали его
// как «поставщик на связи». При лежащем OpenAI ответ говорил бы reachable:true.
//
// Здесь закрепляется то, что ручка честно может утверждать.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-multichat-provider-0123456789";
const USER = "user_provider_test";

let app: express.Express;
let token: string;
const prev: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["AUTH_JWT_SECRET", "DATABASE_URL"]) prev[k] = process.env[k];
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });

  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);

  // Внутренний каталог: отвечает 200 и перечисляет ключи — ровно то, что
  // делает настоящий /api/qcoreai/providers.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        providers: [
          { id: "anthropic", name: "Anthropic", configured: true, defaultModel: "claude-sonnet-4-6" },
          { id: "openai", name: "OpenAI", configured: false, defaultModel: null },
        ],
      }),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

describe("Статус поставщиков", () => {
  test("прямо сказано, что апстримы не опрашивались", async () => {
    const r = await auth(request(app).get("/api/multichat/provider-status"));

    expect(r.status).toBe(200);
    // Без этого поля потребитель ответа не может отличить «проверено и живо»
    // от «ключ есть, а проверять мы и не пробовали».
    expect(r.body.probed).toBe(false);
  });

  test("«достижим» не утверждается сверх того, что известно", async () => {
    const r = await auth(request(app).get("/api/multichat/provider-status"));

    const byId = Object.fromEntries(
      (r.body.providers as Array<{ id: string; configured: boolean; reachable?: unknown }>).map((p) => [p.id, p]),
    );
    // Поле осталось ради совместимости с SDK, но теперь оно ровно повторяет
    // «ключ задан» и ничего не добавляет от себя.
    expect(byId.anthropic.configured).toBe(true);
    expect(byId.anthropic.reachable).toBe(byId.anthropic.configured);
    expect(byId.openai.configured).toBe(false);
    expect(byId.openai.reachable).toBe(byId.openai.configured);
  });

  test("задержка названа своей — она до нашего же каталога, а не до поставщика", async () => {
    const r = await auth(request(app).get("/api/multichat/provider-status"));

    // Раньше это число ехало в поле latencyMs каждого провайдера и рисовалось
    // как его задержка с порогами «⚠» и «🐢», хотя измеряет наш localhost.
    expect(typeof r.body.catalogLatencyMs).toBe("number");
    for (const p of r.body.providers as Array<{ latencyMs?: unknown }>) {
      expect(p.latencyMs ?? null).toBeNull();
    }
  });
});

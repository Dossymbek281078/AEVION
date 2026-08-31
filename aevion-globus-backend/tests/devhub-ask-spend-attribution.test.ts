import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Расход анонимных обращений к платному ИИ должен быть ОТДЕЛИМ от расхода
// платящих. До 31.08 обе половины шли в учёт одной меткой "devhub", и на
// вопрос «сколько стоят анонимные» ответить было нечем: число существовало,
// но было суммой двух разных вещей.
//
// Сторож проверяет СЛЕДСТВИЕ (какая метка ушла в учёт), а не форму вызова.

const { calls } = vi.hoisted(() => ({ calls: [] as any[] }));

vi.mock("../src/services/qcoreai/smartComplete", () => ({
  smartComplete: vi.fn(async (_input: any, opts: any) => {
    calls.push(opts);
    return { answer: "ok", routing: {} };
  }),
}));

const { runs } = vi.hoisted(() => ({ runs: [] as any[] }));
vi.mock("../src/lib/smartRunLog", () => ({
  insertSmartRun: (row: any) => { runs.push(row); },
}));
// Поставщик подменён так, чтобы вернуть ТОКЕНЫ: без них цена всегда 0,
// и проверка «расход записан» прошла бы на сломанном учёте.
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [{ id: "openai", defaultModel: "gpt-4o-mini", configured: true }],
  callProvider: async () => ({
    reply: JSON.stringify({ summary: "s", milestones: [] }),
    model: "gpt-4o-mini",
    usage: { prompt_tokens: 1000, completion_tokens: 500 },
  }),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

const SECRET = "test-secret-for-devhub-ask-attribution-long-enough";

async function app() {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("расход /ask отделим: анонимный от вошедшего", () => {
  beforeEach(() => { calls.length = 0; });

  test("без входа расход помечается как анонимный", async () => {
    const res = await request(await app())
      .post("/api/devhub/ask")
      .send({ question: "как собрать проект" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].module).toBe("devhub-anon");
  });

  test("со входом расход помечается как обычный", async () => {
    const token = jwt.sign({ sub: "user-42" }, SECRET);
    const res = await request(await app())
      .post("/api/devhub/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "как собрать проект" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].module).toBe("devhub");
  });

  test("две половины НЕ совпадают — иначе отделить нельзя", async () => {
    await request(await app()).post("/api/devhub/ask").send({ question: "a" });
    const anon = calls[0].module;
    calls.length = 0;
    const token = jwt.sign({ sub: "user-42" }, SECRET);
    await request(await app())
      .post("/api/devhub/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "a" });
    // Именно это утверждение ловит откат к одной метке на обе половины:
    // проверки по отдельности переживут его, если обе станут "devhub".
    expect(anon).not.toBe(calls[0].module);
  });
});

describe("расход /plan попадает в учёт и отделим", () => {
  beforeEach(() => { runs.length = 0; });

  test("без входа расход записан и помечен как анонимный", async () => {
    const res = await request(await app())
      .post("/api/devhub/plan")
      .send({ idea: "магазин носков" });
    expect(res.status).toBe(200);
    // Считаем ПРИРОСТ записей, а не наличие: строка могла остаться от соседа.
    expect(runs).toHaveLength(1);
    expect(runs[0].module).toBe("devhub-anon");
  });

  test("цена не нулевая — иначе учёт есть только на вид", async () => {
    await request(await app()).post("/api/devhub/plan").send({ idea: "магазин носков" });
    // Прежняя редакция утверждала costUsd > 0 и была СЛАБЕЕ своего названия:
    // мутация «обнулить prompt_tokens» её пережила — цену вытягивал второй
    // счётчик. Поймано мутацией, не глазами.
    //
    // Сверяем с ценой, посчитанной платформенной таблицей от ТЕХ ЖЕ токенов:
    // потеря любого из двух входов теперь меняет число и ловится.
    const { costUsd } = await import("../src/services/qcoreai/pricing");
    expect(runs[0].costUsd).toBe(costUsd("openai", "gpt-4o-mini", 1000, 500));
    expect(runs[0].costUsd).toBeGreaterThan(0);   // контроль: модель с ценой
  });
});

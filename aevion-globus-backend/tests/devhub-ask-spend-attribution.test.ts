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

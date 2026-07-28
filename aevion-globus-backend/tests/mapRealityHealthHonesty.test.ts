/**
 * MapReality — ручка здоровья не должна выдавать число из памяти за число из базы.
 *
 * Тот же дефект, что нашёлся в kids-ai, только здесь `catch` вообще ничего не
 * писал: при сбое запроса ответ был ok: true, dbReady: true и правдоподобный
 * счётчик сигналов из памяти. Монитор видел зелёный ответ ровно тогда, когда
 * база не отвечала.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
}));

vi.mock("../src/lib/ensureMapRealityTables", () => ({
  isMapRealityDbReady: () => true,
  getMapRealityDbError: () => null,
  ensureMapRealityTables: async () => {},
}));

// eslint-disable-next-line import/first
import { mapRealityRouter } from "../src/routes/mapReality";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mapreality", mapRealityRouter);
  return app;
}

const health = () => request(makeApp()).get("/api/mapreality/health");

/** Роняем ТОЛЬКО запрос счётчика — иначе падает фоновая инициализация. */
function breakCountQuery() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/COUNT\(\*\)/i.test(sql) && /mapreality_signals/i.test(sql)) throw new Error("база отвалилась");
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => mockQuery.mockReset());

describe("health честен об источнике числа", () => {
  test("база ответила: источник postgres, ok true", async () => {
    mockQuery.mockImplementation(async (sql: string) =>
      /COUNT\(\*\)/i.test(sql) ? { rows: [{ total: 7 }], rowCount: 1 } : { rows: [], rowCount: 0 },
    );
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.totalSignals).toBe(7);
    expect(res.body.totalSignalsSource).toBe("postgres");
    expect(res.body.ok).toBe(true);
    expect(res.body.dbQueryFailed).toBe(false);
  });

  test("база упала: источник memory, ok снят, флаг сбоя поднят", async () => {
    breakCountQuery();
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.totalSignalsSource).toBe("memory");
    expect(res.body.ok).toBe(false);
    expect(res.body.dbQueryFailed).toBe(true);
  });

  test("при сбое число не помечается как пришедшее из базы", async () => {
    breakCountQuery();
    const res = await health();
    expect(res.body.totalSignalsSource).not.toBe("postgres");
  });
});

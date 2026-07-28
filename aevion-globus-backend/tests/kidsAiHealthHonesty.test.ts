/**
 * Kids-AI — ручка здоровья не должна выдавать число из памяти за число из базы.
 *
 * До 28.07.2026 при сбое запроса /health отдавал `ok: true`, `dbReady: true` и
 * счётчик уроков из памяти. Монитор видел правдоподобную цифру и считал, что
 * всё в порядке, — а база в этот момент не отвечала. Соседний /stats так не
 * делает: он честно помечает `source`.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
}));

vi.mock("../src/lib/ensureKidsAiTables", () => ({
  isKidsAiDbReady: () => true,
  getKidsAiDbError: () => null,
  ensureKidsAiTables: async () => {},
}));

// eslint-disable-next-line import/first
import { kidsAiContentRouter } from "../src/routes/kidsAiContent";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/kids-ai", kidsAiContentRouter);
  return app;
}

const health = () => request(makeApp()).get("/api/kids-ai/health");

beforeEach(() => mockQuery.mockReset());

describe("health честен об источнике числа", () => {
  test("база ответила: источник postgres, ok true", async () => {
    mockQuery.mockImplementation(async (sql: string) =>
      /count\(\*\)/i.test(sql) ? { rows: [{ count: "42" }], rowCount: 1 } : { rows: [], rowCount: 0 },
    );
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.lessonsCount).toBe(42);
    expect(res.body.lessonsCountSource).toBe("postgres");
    expect(res.body.ok).toBe(true);
    expect(res.body.dbQueryFailed).toBe(false);
  });

  test("база упала: помечает источник memory и снимает ok", async () => {
    // Роняем ТОЛЬКО запрос счётчика. Если ронять всё, падает фоновая
    // инициализация модуля, и тест «падает» не по своей причине — на этом
    // уже спотыкались сегодня в другом наборе.
    mockQuery.mockImplementation(async (sql: string) => {
      if (/count\(\*\)/i.test(sql) && /kids_lessons/i.test(sql)) throw new Error("база отвалилась");
      return { rows: [], rowCount: 0 };
    });
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.lessonsCountSource).toBe("memory");
    expect(res.body.dbQueryFailed).toBe(true);
    expect(res.body.ok).toBe(false);
  });

  test("при сбое не выдаёт число из памяти за число из базы", async () => {
    // Роняем ТОЛЬКО запрос счётчика. Если ронять всё, падает фоновая
    // инициализация модуля, и тест «падает» не по своей причине — на этом
    // уже спотыкались сегодня в другом наборе.
    mockQuery.mockImplementation(async (sql: string) => {
      if (/count\(\*\)/i.test(sql) && /kids_lessons/i.test(sql)) throw new Error("база отвалилась");
      return { rows: [], rowCount: 0 };
    });
    const res = await health();
    // Число может быть любым, но по ответу обязано быть видно, что оно не из базы.
    expect(res.body.lessonsCountSource).not.toBe("postgres");
  });
});

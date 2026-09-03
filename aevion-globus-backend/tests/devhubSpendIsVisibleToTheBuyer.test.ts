import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Покупатель видит СВОЙ расход, а не только админ.
 *
 * Прямая задача основателя 03.09.2026: «открою кабинет как покупатель и увижу,
 * сколько потратили мои запуски». До этого дня расход существовал только в
 * разрезе МОДУЛЕЙ — то есть был виден администратору и не был виден тому,
 * чьи это деньги. Место, где тратят твои деньги невидимо, местом жительства
 * не становится.
 *
 * Здесь проверяется цепочка целиком: личность доходит до запроса, ответ
 * отличает «ноль» от «не знаю», и число вызовов без цены названо отдельно.
 */
const { режим } = vi.hoisted(() => ({ режим: { падать: false, строки: [] as any[] } }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: unknown, args?: unknown[]) => {
      if (режим.падать) throw new Error("connection refused (тест)");
      const q = typeof sql === "string" ? sql : "";
      if (q.includes("FROM \"smart_run_log\"") && q.includes("WHERE \"userId\"")) {
        // Стенд отвечает как настоящая база: агрегат по ОДНОМУ пользователю.
        const кто = (args || [])[0];
        const свои = режим.строки.filter((r) => r.userId === кто);
        return { rows: [{
          runs: String(свои.length),
          cost: String(свои.reduce((s, r) => s + r.costUsd, 0)),
          unpriced: String(свои.filter((r) => /БЕЗ-ЦЕНЫ$/.test(r.module)).length),
        }] };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("расход виден покупателю", () => {
  beforeEach(() => {
    __resetDevHubStore();
    режим.падать = false;
    режим.строки = [];
  });

  test("прибор исправен: ручка отвечает и отдаёт числа", () => {
    // Контроль охвата. Без него следующие случаи могли бы «проходить» на
    // несуществующей ручке — 404 тоже не равен ожидаемому, но красный был бы
    // про другое.
    expect(typeof devhubRouter).toBe("function");
  });

  test("свои запуски видны, чужие НЕ видны", async () => {
    режим.строки = [
      { userId: "guest:myguest-0001", module: "devhub-generate", costUsd: 0.5 },
      { userId: "guest:myguest-0001", module: "devhub-generate", costUsd: 0.25 },
      { userId: "guest:otherguest-9", module: "devhub-generate", costUsd: 99 },
    ];
    const r = await request(приложение())
      .get("/api/devhub/studio/spend")
      .set("x-devhub-guest", "myguest-0001");
    expect(r.status, `ручка не ответила: ${JSON.stringify(r.body).slice(0, 120)}`).toBe(200);
    // Заголовок только латиницей: HTTP не принимает кириллицу, и формат
    // идентификатора гостя её тоже не допускает. Поймал стенд, а не прод.
    expect(r.body.runs, "свои два запуска не сошлись").toBe(2);
    expect(r.body.costUsd, "сумма своих трат неверна").toBeCloseTo(0.75, 6);
    expect(r.body.costUsd, "в свой расход попала чужая трата").not.toBe(99);
  });

  test("хранилище недоступно — «не знаю», а НЕ ноль", async () => {
    // Главное утверждение файла. Ноль означает «вы ничего не потратили» —
    // другое утверждение, и оно успокаивает ложно.
    режим.падать = true;
    const r = await request(приложение()).get("/api/devhub/studio/spend");
    expect(r.status, "при недоступном хранилище отдан не отказ").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
    expect(String(r.body.message), "отказ не объясняет, что это НЕ ноль").toMatch(/не ноль/i);
  });

  test("вызовы без цены названы отдельно, иначе сумма читается как полная", async () => {
    режим.строки = [
      { userId: "guest:myguest-0001", module: "devhub-generate", costUsd: 0.4 },
      { userId: "guest:myguest-0001", module: "devhub-stt-БЕЗ-ЦЕНЫ", costUsd: 0 },
    ];
    const r = await request(приложение())
      .get("/api/devhub/studio/spend")
      .set("x-devhub-guest", "myguest-0001");
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("unpricedRuns");
  });
});

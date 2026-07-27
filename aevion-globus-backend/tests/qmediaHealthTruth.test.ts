import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * `/api/qmedia/health` перечислял таблицы Postgres — и вводил в заблуждение.
 * Таблицы действительно создаются (`ensureQMediaTables`), но ни одна строка
 * модуля к ним не обращается: 40 операций идут в Map в памяти процесса против
 * НУЛЯ запросов к пулу. То есть каждый передеплой молча стирает треки,
 * плейлисты, видео и лайки, а проверяющий, увидев имена таблиц, делает ровно
 * противоположный вывод.
 *
 * Тест закрепляет контракт: пока данные в памяти, health обязан это говорить.
 * Когда модуль переведут на Postgres — тест упадёт, и это правильно: он
 * потребует обновить обещание вместе с реализацией.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn(async () => ({ rows: [] })) }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qmediaRouter } from "../src/routes/qmedia";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qmedia", qmediaRouter);
  return app;
}

describe("qmedia /health: обещание должно совпадать с реализацией", () => {
  test("честно называет хранилище и не выдаёт его за постоянное", async () => {
    const res = await request(makeApp()).get("/api/qmedia/health");
    expect(res.status).toBe(200);
    expect(res.body.storage).toBe("in-memory");
    expect(res.body.persistent).toBe(false);
  });

  test("не подаёт неиспользуемые таблицы как хранилище", async () => {
    const res = await request(makeApp()).get("/api/qmedia/health");
    // Поле `tables` читается как «здесь лежат данные» — его быть не должно,
    // пока данные лежат не там.
    expect(res.body.tables).toBeUndefined();
    // Упомянуть таблицы можно, но под именем, которое не обманывает.
    expect(Array.isArray(res.body.tablesCreatedButUnused)).toBe(true);
  });
});

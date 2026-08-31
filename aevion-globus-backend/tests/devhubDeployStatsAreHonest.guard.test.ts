import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Доля успешных публикаций — единственное число, по которому можно сказать,
// доходит ли человек до РАБОТАЮЩЕГО приложения. Данные лежали в базе с самого
// начала, но их никто не считал: двенадцать обращений к таблице, все вида
// «покажи выкатки этого проекта».
//
// Сторож закрепляет ТРИ свойства, и каждое ловит свой способ соврать.

const { rows, dbReady } = vi.hoisted(() => ({ rows: [] as any[], dbReady: { on: true } }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn(async () => ({ rows })) }),
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => dbReady.on,
  getDevHubDbError: () => null,
}));

async function app() {
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("доля успешных публикаций считается честно", () => {
  beforeEach(() => { rows.length = 0; dbReady.on = true; });

  test("считает по фактическому распределению статусов", async () => {
    rows.push({ status: "live", n: 7 }, { status: "failed", n: 3 });
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats?days=30");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(10);
    expect(r.body.successRate).toBe(70);
  });

  test("НЕИЗВЕСТНЫЙ статус попадает в знаменатель, а не пропадает", async () => {
    // Статус в таблице — свободная строка. Список, придуманный заранее,
    // молча выбросил бы новое значение и завысил долю успеха.
    rows.push({ status: "live", n: 1 }, { status: "cancelled_by_user", n: 1 });
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats");
    expect(r.body.total).toBe(2);
    expect(r.body.successRate).toBe(50);
    expect(r.body.byStatus.map((x: any) => x.status)).toContain("cancelled_by_user");
  });

  test("нет данных — доля NULL, а НЕ ноль процентов", async () => {
    // Ключевое утверждение файла. Ноль читался бы как «ни одна публикация не
    // удалась» — другое утверждение, и оно отправит чинить работающее.
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats");
    expect(r.body.total).toBe(0);
    expect(r.body.successRate).toBeNull();
    expect(r.body.successRate).not.toBe(0);
  });

  test("при недоступной базе ответ ГОВОРИТ, что числа из памяти", async () => {
    dbReady.on = false;
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats");
    expect(r.body.storage).toBe("memory");
  });

  test("при живой базе признак тоже назван", async () => {
    // Контроль: без него поле, всегда равное "memory", прошло бы проверку выше.
    rows.push({ status: "live", n: 1 });
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats");
    expect(r.body.storage).toBe("db");
  });
});

import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Продолжение сторожа `deleteRemovesEveryCopyOfTheFiles`, и написано оно после
 * находки В НЁМ САМОМ (08.09.2026).
 *
 * Тот сторож проверяет удаление НАСТОЯЩИМИ ручками — и это правильно. Но без
 * базы маршруты уходят в память, и ветка `dbDeleteProject`, работающая с
 * Postgres, не исполняется ни разу. Её там закрепляла единственная строка
 * `expect(тело).toContain('DELETE FROM "DevHubCheckpoint"')` — то есть ФОРМА.
 * Проверено мутацией: убрал этот запрос из кода — покраснела только та
 * текстовая проверка, поведенческие остались зелёными.
 *
 * А на проде база ЕСТЬ, и работает именно эта ветка. Значит обещание «файлы
 * исчезнут навсегда» держалось на совпадении строки в исходнике: любой
 * рефакторинг (перенос запроса в helper, склейка в транзакцию, смена кавычек)
 * законно сделал бы сторожа зелёным на сломанном удалении.
 *
 * Здесь база подменена записывающей заглушкой, и утверждение — о том, какие
 * запросы РЕАЛЬНО ушли.
 */

const запросы: Array<{ sql: string; params: unknown[] }> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      запросы.push({ sql: String(sql), params });
      // Единственное чтение, от которого зависит ход маршрута: проверка владельца.
      if (/SELECT \* FROM "DevHubProject"/.test(String(sql))) {
        return { rows: [{ id: "p-1", userId: "guest:db-path-guest", name: "x", stack: "static", status: "draft", envVars: {}, collaborators: [] }] };
      }
      return { rows: [] };
    },
  }),
}));

vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: async () => {},
  isDevHubDbReady: () => true,
  getDevHubDbError: () => null,
}));

const { devhubRouter } = await import("../src/routes/devhub");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

function удалённыеТаблицы(): string[] {
  return запросы
    .filter((q) => /^\s*DELETE FROM/i.test(q.sql))
    .map((q) => (q.sql.match(/DELETE FROM "([^"]+)"/) || [])[1])
    .filter(Boolean) as string[];
}

describe("удаление доходит до базы, а не только до памяти", () => {
  beforeEach(() => {
    запросы.length = 0;
  });

  test("прибор работает: маршрут действительно пошёл в базу", async () => {
    await request(makeApp())
      .delete("/api/devhub/projects/p-1")
      .set({ "x-devhub-guest": "db-path-guest" });
    expect(
      запросы.some((q) => /SELECT \* FROM "DevHubProject"/.test(q.sql)),
      "чтения проекта из базы не было — значит ветка памяти, и дальше меряется не то",
    ).toBe(true);
  });

  test("снимки и выкатки удаляются ЗАПРОСОМ, а не только в памяти", async () => {
    const r = await request(makeApp())
      .delete("/api/devhub/projects/p-1")
      .set({ "x-devhub-guest": "db-path-guest" });
    expect(r.status).toBe(200);

    const таблицы = удалённыеТаблицы();
    expect(таблицы, "снимки хранят ПОЛНЫЕ копии файлов — без этого обещание неправда").toContain("DevHubCheckpoint");
    expect(таблицы, "выкатки остались бы сиротами").toContain("DevHubDeployment");
    expect(таблицы, "сами файлы").toContain("DevHubFile");
    expect(таблицы, "и сам проект").toContain("DevHubProject");
  });

  test("удаление идёт по ЭТОМУ проекту, а не по всем подряд", async () => {
    await request(makeApp())
      .delete("/api/devhub/projects/p-1")
      .set({ "x-devhub-guest": "db-path-guest" });
    const удаления = запросы.filter((q) => /^\s*DELETE FROM/i.test(q.sql));
    expect(удаления.length).toBeGreaterThan(0);
    for (const q of удаления) {
      expect(q.params, `запрос без параметра — снёс бы чужие строки: ${q.sql}`).toContain("p-1");
    }
  });

  test("счётчики расхода и тариф НЕ трогаются: они про человека, а не про проект", async () => {
    await request(makeApp())
      .delete("/api/devhub/projects/p-1")
      .set({ "x-devhub-guest": "db-path-guest" });
    const таблицы = удалённыеТаблицы();
    expect(таблицы, "снос учёта стёр бы след платного расхода").not.toContain("DevHubUsage");
    expect(таблицы, "снос тарифа отнял бы у человека оплаченное").not.toContain("DevHubTier");
  });
});

import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Отказ ОДНОЙ таблицы, а не всего хранилища.
 *
 * Сторож devhubReadsAreHonestWhenStorageFails роняет базу целиком — и тогда
 * чтение проекта отвечает 503 РАНЬШЕ, чем дело дойдёт до чтения файла.
 * Проверено мутацией 29.08.2026: вернул прежний 500 в обработчике файла, и
 * тот сторож остался ЗЕЛЁНЫМ. То есть он обещал «ни одно чтение не отвечает
 * 500», а до двух обработчиков файлов не добирался вовсе.
 *
 * Здесь стенд другой: проект читается успешно, падает только запрос к
 * таблице файлов. Так выглядит настоящая беда в проде — не «база легла», а
 * «один запрос не прошёл»: блокировка, таймаут, битый индекс.
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
  getPoolStats: () => null,
}));

vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

const ID = "00000000-0000-0000-0000-000000000000";

const PROJECT_ROW = {
  id: ID,
  // Без заголовка x-devhub-guest владельцем считается "anonymous" —
  // иначе проект не признаётся своим и ручка отвечает 404, а не 200.
  userId: "anonymous",
  name: "T",
  createdAt: new Date(),
  updatedAt: new Date(),
  envVars: {},
};

describe("отказ одной таблицы не выдаётся за нашу поломку", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.resetModules();
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql?: string) => {
      const q = typeof sql === "string" ? sql.toUpperCase() : "";
      if (q.includes("DEVHUBFILE")) {
        throw new Error("deadlock detected (тест)");
      }
      if (q.includes("DEVHUBPROJECT")) {
        return { rows: [PROJECT_ROW], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    app = express().use(express.json()).use("/api/devhub", devhubRouter);
  });

  test("прибор работает: таблица проектов ЖИВА, падает только файловая", async () => {
    // Контроль берёт СПИСОК проектов: он читает только DevHubProject.
    // Карточка одного проекта тут не годится — она отдаёт проект вместе
    // с файлами, то есть честно падает вместе с файловой таблицей, и
    // контроль краснел бы при полностью исправном стенде.
    const r = await request(app).get("/api/devhub/projects");
    expect(r.status, "проекты не читаются — проверяется не тот путь").toBe(200);
  });

  test("чтение файла по пути отвечает 503, а не 500", async () => {
    const r = await request(app).get(`/api/devhub/projects/${ID}/files/app.js`);
    expect(r.status, "недоступность таблицы выдана за нашу поломку").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });

  test("чтение файла запросом тоже 503", async () => {
    const r = await request(app).get(`/api/devhub/projects/${ID}/file?path=app.js`);
    expect(r.status, "второй обработчик остался с пятисоткой").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });
});

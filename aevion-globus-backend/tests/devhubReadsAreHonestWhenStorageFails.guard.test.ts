import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сбой хранилища не выдаётся за факт о данных человека.
 *
 * Приём взят из `qskywaySlotStoreHonesty.test.ts` и применён к DevHub впервые
 * 28.08.2026: роутер поднимается с базой, которая ПОДНЯЛАСЬ, а потом перестала
 * читаться. Это и есть опасный случай — модуль считает Postgres рабочим, и
 * запасная память не включается.
 *
 * Замер по всем 31 GET-ручке дал две находки:
 *
 *   GET /snippets        200 {"snippets":[],"total":0}   ← «полка пуста»
 *   GET /projects/:id    500 internal_error              ← «у нас сломалось»
 *
 * тогда как ВОСЕМНАДЦАТЬ соседних чтений в том же файле честно отвечали
 * 503 storage_unavailable («проект на месте, прочитать не удалось»).
 * Непоследовательность внутри одного файла — почти всегда недосмотр, а не
 * решение. После правки честных ответов двадцать, пятисоток ноль.
 *
 * Разница для человека большая: 500 читается как авария у нас, пустой список —
 * как потеря его работы, и только 503 говорит правду.
 */

vi.mock("../src/lib/dbPool", () => {
  const boom = () => { throw new Error("connection refused (тест)"); };
  return {
    getPool: () => ({
      query: async (sql?: string) => {
        const q = typeof sql === "string" ? sql.toUpperCase() : "";
        // Инициализация и проба живости проходят: `SELECT 1` в
        // ensureDevHubTables решает, считать ли Postgres рабочим. Без этого
        // модуль честно уходит в память — другой, разрешённый случай.
        if (q.trim() === "SELECT 1" || q.includes("CREATE ") || q.includes("ALTER ") || q.includes("INDEX")) {
          return { rows: [{ ok: 1 }], rowCount: 1 };
        }
        return boom();
      },
      connect: async () => ({ query: async () => boom(), release: () => {} }),
    }),
    getPoolStats: () => null,
  };
});

const ID = "00000000-0000-0000-0000-000000000000";

describe("чтения DevHub честны при упавшем хранилище", () => {
  let app: express.Express;
  beforeEach(async () => {
    vi.resetModules();
    const { devhubRouter } = await import("../src/routes/devhub");
    app = express().use(express.json()).use("/api/devhub", devhubRouter);
  });

  test("прибор работает: опасный случай достигнут, а не подменён запасной памятью", async () => {
    // Если бы проба живости падала, модуль ушёл бы в память и отвечал 200 —
    // это ДРУГОЙ, законный режим, и проверки ниже ничего бы не значили.
    const h = await request(app).get("/api/devhub/health");
    expect(h.body.db, "модуль ушёл в память — проверяется не тот случай").toBe("postgres");
  });

  test("список проектов отвечает отказом, а не пустотой", async () => {
    const r = await request(app).get("/api/devhub/projects");
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });

  test("список снипетов тоже — это была находка замера", async () => {
    const r = await request(app).get("/api/devhub/snippets");
    expect(r.status, "пустой список снова выдаётся за факт").toBe(503);
  });

  test("чтение одного проекта отвечает 503, а не 500", async () => {
    // 500 читается как «сломались мы» и поднимает тревогу как наша авария;
    // недоступность базы у нас описана отдельным кодом.
    const r = await request(app).get(`/api/devhub/projects/${ID}`);
    expect(r.status, "вернулась пятисотка").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });

  test("ни одно чтение не отвечает 500", async () => {
    const paths = [
      "/api/devhub/projects",
      "/api/devhub/snippets",
      `/api/devhub/projects/${ID}`,
      `/api/devhub/projects/${ID}/files`,
      `/api/devhub/projects/${ID}/checkpoints`,
      `/api/devhub/projects/${ID}/collaborators`,
      `/api/devhub/projects/${ID}/database`,
    ];
    const bad: string[] = [];
    for (const p of paths) {
      const r = await request(app).get(p);
      if (r.status >= 500 && r.status !== 503) bad.push(`${p} → ${r.status}`);
    }
    expect(bad, "сбой хранилища выдан за нашу аварию").toEqual([]);
  }, 60_000);

  test("статические каталоги не трогают базу и отвечают как обычно", async () => {
    // Контроль в другую сторону: если бы 503 отдавали ВСЕ, проверки выше были
    // бы зелёными на модуле, который просто лёг целиком.
    for (const p of ["/api/devhub/templates", "/api/devhub/media/video/models"]) {
      const r = await request(app).get(p);
      expect(r.status, `${p} перестал отвечать`).toBe(200);
    }
  });
});

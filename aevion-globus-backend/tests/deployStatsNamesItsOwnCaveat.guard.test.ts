import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Замер 08.09.2026: /studio/deploy-stats показывал за неделю 5 выкаток и
 * 0 успешных. Открыли адреса четырёх «упавших» — все отвечают 200 (контроль:
 * выдуманный поддомен того же проекта даёт 404). Публикация была цела; врала
 * наша проверка, ждавшая ответа 25 секунд, тогда как у гостя КАЖДЫЙ проект —
 * это новый проект Cloudflare Pages и адрес поднимается дольше.
 *
 * Ожидание исправлено, но старые записи остались, и «успешных 0» продолжает
 * пугать любого, кто откроет цифру. Число обязано называть свою оговорку
 * САМО: рядом едет счётчик «неудач», у которых есть живой адрес.
 *
 * Здесь проверяется ветка БАЗЫ — та, что работает на проде. Без подмены пула
 * маршрут ушёл бы в память, и запрос, считающий оговорку, не исполнился бы
 * ни разу (ровно тот класс, что нашёлся сегодня у удаления проектов).
 */
const запросы: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      const s = String(sql);
      запросы.push(s);
      if (/GROUP BY "status"/.test(s)) {
        return { rows: [{ status: "failed", n: 5 }] };
      }
      if (/status" = 'failed'/.test(s)) return { rows: [{ n: 4 }] };
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

describe("статистика выкаток называет свою оговорку", () => {
  beforeEach(() => {
    запросы.length = 0;
  });

  test("прибор работает: маршрут пошёл в базу, а не в память", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/deploy-stats");
    expect(r.status).toBe(200);
    expect(r.body.storage, "ветка памяти — значит меряется не то").toBe("db");
    expect(запросы.some((s) => /GROUP BY "status"/.test(s))).toBe(true);
  });

  test("«неудачи» с живым адресом посчитаны и названы", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/deploy-stats");
    expect(
      r.body.failedWithUrl,
      "цифра «успешных 0» уходит к человеку без оговорки, а она у нас есть",
    ).toBe(4);
    expect(r.body.total).toBe(5);
  });

  test("оговорка считается ЗАПРОСОМ по этому же окну дней", async () => {
    await request(makeApp()).get("/api/devhub/studio/deploy-stats?days=7");
    const zapros = запросы.find((s) => /status" = 'failed'/.test(s));
    expect(zapros, "запроса про живые адреса не было — поле взялось из воздуха").toBeTruthy();
    expect(zapros, "оговорка обязана считаться по тому же окну, что и всё остальное").toMatch(/INTERVAL '1 day'/);
    expect(zapros, "пустой адрес — не адрес").toMatch(/<> ''/);
  });
});

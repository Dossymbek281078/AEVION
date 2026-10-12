import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/*
 * 🔴 В статистике выкаток DevHub наши пробы отделены от людей.
 *
 * Повод 12.10.2026: «14 проектов от 11 гостей» за день читались как живые
 * сборки — все были нашими пробами (метка ?c=probe-… в заходе, имя без probe-).
 * Признак «наш» тот же, что у самоуборки пробных сайтов (пробныйГостевойПроект):
 * гость И (имя probe-/smoke- ИЛИ метка захода probe-/smoke-). Вошедший человек
 * с именем «probe-x» — НЕ наш: признак требует гостя, и это держится здесь.
 *
 * Сторож делает настоящий GET к ручке; база подменена диспетчером по тексту SQL.
 * Граница: ветвь памяти (storage=memory) здесь не проверяется — memProjects
 * приватны модулю, а поднимать их через POST с лимитами гостя дороже пользы.
 */
const { запросы } = vi.hoisted(() => ({ запросы: [] as string[] }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      const s = String(sql);
      запросы.push(s);
      if (/GROUP BY "status"/.test(s)) {
        return {
          rows: [
            // наша: имя помечено, гость
            { status: "live", name: "probe-smoke-1", entryTag: null, userId: "guest:1", n: 2 },
            // наша: имя обычное (видно в кадре ролика), метка захода probe-
            { status: "failed", name: "Магазин кроссовок", entryTag: "probe-user-99", userId: "guest:3", n: 1 },
            // люди: гость с меткой ролика
            { status: "live", name: "Кофейня", entryTag: "yt-devhub-1", userId: "guest:2", n: 3 },
            // люди: гость без метки (до 12.10 столбца не было)
            { status: "live", name: "Портфолио", entryTag: null, userId: "guest:4", n: 1 },
            // НЕ наша: имя probe-, но вошедший человек — признак требует гостя
            { status: "failed", name: "probe-x", entryTag: null, userId: "user_7", n: 1 },
          ],
        };
      }
      if (/status" = 'failed'/.test(s)) return { rows: [{ n: 0 }] };
      if (/FROM "DevHubProject"/.test(s) && /"createdAt"/.test(s)) {
        return {
          rows: [
            { name: "a", entryTag: "probe-bd", userId: "guest:1" },
            { name: "b", entryTag: "ig", userId: "guest:2" },
            { name: "smoke-c", entryTag: null, userId: "guest:3" },
            { name: "probe-d", entryTag: null, userId: "user_9" },
          ],
        };
      }
      return { rows: [] };
    },
  }),
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
  getDevHubDbError: () => null,
}));

async function app() {
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("статистика выкаток отделяет наши пробы от людей", () => {
  test("🔴 выкатки: общее не меняется, наши — по гостю с меткой или именем, люди — остаток", async () => {
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats?days=7");
    expect(r.status).toBe(200);
    expect(r.body.total, "знаменатель прежний: 2+1+3+1+1").toBe(8);
    expect(r.body.ours).toEqual({ total: 3, live: 2 });
    expect(r.body.people).toEqual({ total: 5, live: 4, successRate: 80 });
  });

  test("🔴 вошедший человек с именем probe- — НЕ наш (признак требует гостя)", async () => {
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats?days=7");
    // если бы считался нашим: ours.total 4, people.total 4
    expect(r.body.ours.total).toBe(3);
    expect(r.body.people.total).toBe(5);
  });

  test("🔴 проекты, созданные в окне: наши по метке захода И по имени, люди — остаток", async () => {
    const r = await request(await app()).get("/api/devhub/studio/deploy-stats?days=7");
    expect(r.body.projects).toEqual({ total: 4, ours: 2, people: 2 });
  });

  test("запрос по проектам ограничен окном дней, а не читает всю таблицу", async () => {
    запросы.length = 0;
    await request(await app()).get("/api/devhub/studio/deploy-stats?days=3");
    const q = запросы.find((s) => /FROM "DevHubProject"/.test(s) && /"createdAt"/.test(s));
    expect(q, "запрос по созданным проектам есть").toBeTruthy();
    expect(q).toMatch(/INTERVAL '1 day'/);
  });
});

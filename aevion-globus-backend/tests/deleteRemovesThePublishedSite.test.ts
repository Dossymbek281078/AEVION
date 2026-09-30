import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Удаление проекта обязано снимать и опубликованный сайт.
 *
 * Замер 28.09.2026: удаление убирало проект из базы, а сайт продолжал жить на
 * <имя>.pages.dev навсегда — в интерфейсе им нечем управлять, публичный адрес
 * отвечает 200. Каждая проба и каждый брошенный проект гостя оставляли вечную
 * публичную страницу; накопленное пришлось убирать руками по списку.
 *
 * 404 от Cloudflare — УСПЕХ: цель «сайта нет», а не «мы его удалили».
 * Неудача не отменяет удаление проекта (в отличие от сервиса Railway, который стоит
 * денег), но и не молчит: поле в ответе.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

const исходныйFetch = globalThis.fetch;
let вызовы: Array<{ url: string; method: string }> = [];

function подменитьFetch(ответ: { ok: boolean; status: number; тело?: string }) {
  вызовы = [];
  globalThis.fetch = (async (u: any, o: any) => {
    вызовы.push({ url: String(u), method: String(o?.method ?? "GET") });
    return {
      ok: ответ.ok,
      status: ответ.status,
      json: async () => ({}),
      // Тело задаётся, потому что причина отказа живёт в нём, а не в коде:
      // 400 бывает и «имя не то», и «нет права», и «держат сборки».
      text: async () => ответ.тело ?? "",
    } as any;
  }) as any;
}

async function создать(имя: string) {
  const r = await request(приложение()).post("/api/devhub/projects").send({ name: имя });
  return r.body.project;
}

describe("удаление проекта снимает опубликованный сайт", () => {
  beforeEach(() => {
    __resetDevHubStore?.();
    process.env.CLOUDFLARE_ACCOUNT_ID = "акк-для-теста";
    process.env.CLOUDFLARE_API_TOKEN = "токен-для-теста";
  });
  afterEach(() => {
    globalThis.fetch = исходныйFetch;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  test("уходит DELETE именно на имя проекта Pages", async () => {
    const p = await создать("Таймер проба");
    подменитьFetch({ ok: true, status: 200 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.status).toBe(200);
    expect(r.body.pagesRemoved).toBe(true);
    const удаления = вызовы.filter((в) => в.method === "DELETE" && в.url.includes("/pages/projects/"));
    expect(удаления.length).toBe(1);
    expect(удаления[0].url).toContain("aevion-");
    expect(удаления[0].url).toContain(p.id.slice(0, 6));
  });

  test("404 от Cloudflare — успех: сайта и так нет", async () => {
    const p = await создать("Нет такого сайта");
    подменитьFetch({ ok: false, status: 404 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.body.pagesRemoved).toBe(true);
  });

  test("отказ Cloudflare виден в ответе, но проект всё равно удалён", async () => {
    const p = await создать("Упрямый сайт");
    подменитьFetch({ ok: false, status: 500 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.pagesRemoved).toBe(false);
    expect(String(r.body.pagesRemoveError)).toContain("500");
    const второй = await request(приложение()).get("/api/devhub/projects/" + p.id);
    expect(второй.status).toBe(404);
  });

  test("сайт остался жить — его адрес НЕ теряется вместе с проектом", async () => {
    /*
     * Найдено ночной пробой на живом проде 30.09.2026, на себе.
     *
     * Проект удалился (GET отдал 404), а сайт продолжал отдавать 200 и 4231 знак:
     * Cloudflare ответил 400. Прежний ответ говорил только «Cloudflare ответил
     * 400» — ни причины, ни адреса. А дальше проект исчезает из базы, и
     * единственная ниточка к живому публичному сайту обрывается: имя выводилось
     * из записи, которой больше нет. Ровно так и накопился мусор, про который в
     * коде сказано «уборку пришлось делать руками по списку».
     */
    const p = await создать("Осиротевший сайт");
    подменитьFetch({ ok: false, status: 400, тело: '{"errors":[{"message":"project has active deployments"}]}' });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);

    expect(r.status).toBe(200);
    expect(r.body.pagesRemoved).toBe(false);
    // Адрес назван целиком, чтобы уборка была возможна без угадывания имени.
    expect(String(r.body.orphanSiteUrl), "адрес осиротевшего сайта потерян").toContain(p.id.slice(0, 6));
    expect(String(r.body.orphanSiteUrl)).toContain(".pages.dev");
    // И причина названа по существу, а не одним кодом.
    expect(String(r.body.pagesRemoveError), "причина отказа не названа").toContain("active deployments");
  });

  test("сайт снят — адреса осиротевшего нет: пустое поле не пугает зря", async () => {
    // Контроль в обратную сторону. Без него поле могло бы приходить ВСЕГДА, и
    // тогда «осиротевший сайт» перестал бы что-либо значить.
    const p = await создать("Снятый сайт");
    подменитьFetch({ ok: true, status: 200 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.body.pagesRemoved).toBe(true);
    expect(r.body.orphanSiteUrl, "поле пришло там, где сайт снят").toBeUndefined();
  });

  test("без ключей Cloudflare поля нет вовсе — не выдаём незнание за уборку", async () => {
    const p = await создать("Без ключей");
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    подменитьFetch({ ok: true, status: 200 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.body.pagesRemoved).toBeUndefined();
  });
});

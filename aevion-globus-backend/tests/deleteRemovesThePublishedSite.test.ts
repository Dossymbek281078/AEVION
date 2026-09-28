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

function подменитьFetch(ответ: { ok: boolean; status: number }) {
  вызовы = [];
  globalThis.fetch = (async (u: any, o: any) => {
    вызовы.push({ url: String(u), method: String(o?.method ?? "GET") });
    return { ok: ответ.ok, status: ответ.status, json: async () => ({}), text: async () => "" } as any;
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

  test("без ключей Cloudflare поля нет вовсе — не выдаём незнание за уборку", async () => {
    const p = await создать("Без ключей");
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    подменитьFetch({ ok: true, status: 200 });
    const r = await request(приложение()).delete("/api/devhub/projects/" + p.id);
    expect(r.body.pagesRemoved).toBeUndefined();
  });
});

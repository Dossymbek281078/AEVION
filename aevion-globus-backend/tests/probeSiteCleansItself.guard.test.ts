import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Пробный сайт снимает себя сам — и только пробный, и только у гостя.
 *
 * 🔴 ЗАМЕР 07.10.2026 по живому аккаунту Cloudflare (вход основателя): из 34
 * проектов Pages 20 были нашими пробами, 15 ещё отдавали публичные страницы.
 * Каждый навсегда занимал слот аккаунта; слоты кончатся — публикация встанет у
 * ВСЕХ, включая платных.
 *
 * Откуда мусор: штатный смоук за собой УБИРАЕТ (среди 20 не было ни одного
 * `aevion-smoke-*`) — всё оставили РУЧНЫЕ пробы окон. Значит правило чинится на
 * сервере, а не в скрипте.
 *
 * Снимается только САЙТ: запись проекта остаётся, слотов она не занимает, а
 * удаление чужой работы необратимо.
 */
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => { throw new Error("нет базы"); } }), getPoolStats: () => null }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));
const { mockDeployViaWrangler } = vi.hoisted(() => ({ mockDeployViaWrangler: vi.fn() }));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: mockDeployViaWrangler }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork, пробныйГостевойПроект } from "../src/routes/devhub";

function приложение() {
  const a = express();
  a.use(express.json({ limit: "10mb" }));
  a.use("/api/devhub", devhubRouter);
  return a;
}
function токен(sub = "u-paid") {
  return { Authorization: `Bearer ${jwt.sign({ sub, email: `${sub}@test.dev` }, "dev-auth-secret", { algorithm: "HS256" })}` };
}

/** Удаления проектов Pages, которые ушли в Cloudflare. */
let удаленияPages: string[] = [];
const настоящийFetch = globalThis.fetch;
const было: Record<string, string | undefined> = {};

async function выкатить(имя: string, headers: Record<string, string>) {
  const app = приложение();
  const cr = await request(app).post("/api/devhub/projects").set(headers).send({ name: имя, stack: "static" });
  const id = cr.body.project.id as string;
  await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).set(headers).send({ content: "<h1>x</h1>", language: "html" });
  const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(headers).send({});
  return { app, id, статус: r.status, тело: r.body };
}

beforeEach(() => {
  __resetDevHubStore?.();
  удаленияPages = [];
  for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "AUTH_JWT_SECRET", "DEVHUB_PROBE_SITE_TTL_MINUTES"]) было[k] = process.env[k];
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
  process.env.AUTH_JWT_SECRET = "dev-auth-secret";
  globalThis.fetch = (async (u: unknown, o?: { method?: string }) => {
    const url = String(u);
    if ((o?.method ?? "GET") === "DELETE" && url.includes("/pages/projects/")) {
      // Имя проекта — последний кусок пути, если это не удаление домена.
      if (!url.includes("/domains/")) удаленияPages.push(url.split("/pages/projects/")[1]);
    }
    return { ok: true, status: 200, json: async () => ({ success: true, result: [] }), text: async () => "{}" } as unknown as Response;
  }) as unknown as typeof fetch;
  mockDeployViaWrangler.mockReset();
  mockDeployViaWrangler.mockResolvedValue({ ok: true, url: "https://abc.aevion-p.pages.dev", output: "", skipped: [] });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = настоящийFetch;
  __clearDeferredDevHubWork?.();
  for (const [k, v] of Object.entries(было)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const СРОК_МС = 120 * 60_000;

describe("пробный сайт снимает себя сам", () => {
  test("прибор исправен: признак отличает пробное от обычного и гостя от вошедшего", () => {
    expect(пробныйГостевойПроект({ name: "probe-timer", userId: "guest:abc" })).toBe(true);
    expect(пробныйГостевойПроект({ name: "smoke-check", userId: "guest:abc" })).toBe(true);
    expect(пробныйГостевойПроект({ name: "Probe_Night", userId: "guest:abc" })).toBe(true);
    // Обычное имя — не проба, даже у гостя.
    expect(пробныйГостевойПроект({ name: "Кофейня у моста", userId: "guest:abc" })).toBe(false);
    // Слово внутри имени — тоже не проба: метка стоит В НАЧАЛЕ.
    expect(пробныйГостевойПроект({ name: "my probe idea", userId: "guest:abc" })).toBe(false);
    // Вошедший человек не теряет сайт из-за имени.
    expect(пробныйГостевойПроект({ name: "probe-timer", userId: "u-paid" })).toBe(false);
  });

  test("🔴 пробный сайт гостя снимается по сроку", async () => {
    const r = await выкатить("probe-timer-0710", { "x-devhub-guest": "gost-proba-0710" });
    expect(r.статус, `выкатка не прошла: ${JSON.stringify(r.тело)}`).toBe(200);
    // Двигаем время НЕМНОГО: под поддельными таймерами «ничего не сняли сразу»
    // выполняется и при сроке 0 — таймер просто не успел. Поймал мутацией
    // «снимать сразу»: она прошла. Секунда отличает срок в минуты от нуля.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(удаленияPages, "сняли почти сразу, не дожидаясь срока").toHaveLength(0);
    await vi.advanceTimersByTimeAsync(СРОК_МС + 5_000);
    expect(удаленияPages.length, "пробный сайт не снялся по сроку").toBeGreaterThan(0);
    expect(удаленияPages[0], "сняли не тот проект").toMatch(/^aevion-probe-timer-0710/);
  });

  test("ОБЫЧНЫЙ сайт гостя НЕ снимается — это чужая работа", async () => {
    // Контроль в обратную сторону: без него «снимаем всё» выглядело бы починкой.
    const r = await выкатить("Кофейня у моста", { "x-devhub-guest": "gost-obychnyj-0710" });
    expect(r.статус).toBe(200);
    await vi.advanceTimersByTimeAsync(СРОК_МС * 3);
    expect(удаленияPages, "снесли сайт обычного гостя").toHaveLength(0);
  });

  test("пробное имя у ВОШЕДШЕГО не снимается", async () => {
    const r = await выкатить("probe-moj-test", токен());
    expect(r.статус).toBe(200);
    await vi.advanceTimersByTimeAsync(СРОК_МС * 3);
    expect(удаленияPages, "снесли сайт вошедшего человека из-за имени").toHaveLength(0);
  });

  test("срок берётся из переменной окружения", async () => {
    // Иначе «120 минут» нельзя ни ускорить при разборе, ни растянуть при нужде.
    process.env.DEVHUB_PROBE_SITE_TTL_MINUTES = "1";
    vi.resetModules();
    const { devhubRouter: r2 } = await import("../src/routes/devhub");
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use("/api/devhub", r2);
    const h = { "x-devhub-guest": "gost-srok-0710" };
    const cr = await request(app).post("/api/devhub/projects").set(h).send({ name: "probe-srok", stack: "static" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).set(h).send({ content: "<h1>x</h1>", language: "html" });
    await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
    await vi.advanceTimersByTimeAsync(70_000);
    expect(удаленияPages.length, "срок из переменной не применился").toBeGreaterThan(0);
  });
});

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Потолок ЧИСЛА проектов Cloudflare Pages: честный отказ гостям, запас платным.
 *
 * 🔴 ЗАЧЕМ. Каждый опубликованный проект DevHub — ОТДЕЛЬНЫЙ проект Pages в ОДИН
 * наш аккаунт (проверено по коду 06.10.2026: wrangler pages deploy с именем
 * `aevion-<слаг>-<id>`). Значит потолок аккаунта наступает раньше любой нормы на
 * гостя или на адрес, и когда он наступит, публикация встанет у ВСЕХ, включая
 * платных. Нормы, которые мы расширяли 06.10, от этого не спасают — они про
 * расход, а здесь кончается место.
 *
 * ⚠️ Само число (100) ДОКУМЕНТИРОВАННОЕ, а не замеренное: токена Cloudflare в
 * рабочей копии нет, спросить аккаунт нечем. Поэтому предел живёт в переменной
 * окружения, а проверка смотрит на ПОВЕДЕНИЕ у границы, а не на конкретную сотню.
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
import {
  devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork,
  __setПодсчётПроектовForTest, __потолокПроектовPagesForTest as порог,
} from "../src/routes/devhub";

function приложение() {
  const a = express();
  a.use(express.json({ limit: "10mb" }));
  a.use("/api/devhub", devhubRouter);
  return a;
}
function токенПлатного(sub = "u-paid") {
  return { Authorization: `Bearer ${jwt.sign({ sub, email: `${sub}@test.dev` }, "dev-auth-secret", { algorithm: "HS256" })}` };
}

/** Проект с файлом: без файла выкатка отказала бы раньше, по другой причине. */
async function проектСФайлом(headers: Record<string, string>) {
  const app = приложение();
  const cr = await request(app).post("/api/devhub/projects").set(headers).send({ name: "P", stack: "static" });
  const id = cr.body.project.id as string;
  await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).set(headers).send({ content: "<h1>x</h1>", language: "html" });
  return { app, id };
}

const было: Record<string, string | undefined> = {};
const настоящийFetch = globalThis.fetch;

beforeEach(() => {
  __resetDevHubStore?.();
  /*
   * Сеть подменяется целиком: выкатка зовёт REST Cloudflare (создание проекта и
   * привязка домена), и без подмены первая выкатка уходила в настоящий аккаунт и
   * падала с «Could not route to /client/v4/accounts/acc/...». Поймал прогоном.
   * Отвечаем «хорошо» на всё: эта проверка про ПОТОЛОК, а не про Cloudflare.
   */
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, result: {} }),
    text: async () => "{}",
  })) as unknown as typeof fetch;
  for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "AUTH_JWT_SECRET"]) было[k] = process.env[k];
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
  process.env.AUTH_JWT_SECRET = "dev-auth-secret";
  mockDeployViaWrangler.mockReset();
  // Форма ответа — как у настоящего deployViaWrangler (ok/url/output/skipped);
  // своя выдумка {url, log} дала «CF Pages upload failed: undefined». Поймал прогоном.
  mockDeployViaWrangler.mockResolvedValue({ ok: true, url: "https://abc.aevion-p.pages.dev", output: "", skipped: [] });
});
afterEach(() => {
  globalThis.fetch = настоящийFetch;
  __setПодсчётПроектовForTest(null);
  __clearDeferredDevHubWork?.();
  for (const [k, v] of Object.entries(было)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

describe("потолок проектов Pages", () => {
  test("прибор исправен: пороги кратны пределу и идут по возрастанию", () => {
    expect(порог.предел()).toBeGreaterThan(0);
    expect(порог.порогПредупреждения(), "предупреждение не раньше отказа").toBeLessThan(порог.порогОтказаГостям());
    expect(порог.порогОтказаГостям(), "отказ гостям не ниже предела").toBeLessThanOrEqual(порог.предел());
    // Запас платным — это разница между отказом гостям и пределом.
    expect(порог.предел() - порог.порогОтказаГостям(), "платным не оставлено ни одного слота").toBeGreaterThan(0);
  });

  test("ниже порога гость публикуется", async () => {
    __setПодсчётПроектовForTest(async () => порог.порогОтказаГостям() - 1);
    const { app, id } = await проектСФайлом({ "x-devhub-guest": "gost-nizhe-poroga" });
    const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set({ "x-devhub-guest": "gost-nizhe-poroga" }).send({});
    expect(r.body?.error, `гостя отбили раньше порога: ${JSON.stringify(r.body)}`).not.toBe("publishing_temporarily_unavailable");
  });

  test("🔴 на пороге гость получает ЧЕСТНЫЙ 503, а не 500 и не тишину", async () => {
    __setПодсчётПроектовForTest(async () => порог.порогОтказаГостям());
    const { app, id } = await проектСФайлом({ "x-devhub-guest": "gost-na-poroge" });
    const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set({ "x-devhub-guest": "gost-na-poroge" }).send({});
    expect(r.status, "место кончилось у нас, а ответ не 503").toBe(503);
    expect(r.body.error).toBe("publishing_temporarily_unavailable");
    // Человек должен понять, что дело не в нём и что файлы целы.
    expect(String(r.body.message), "в отказе нет слова о сохранённых файлах").toMatch(/saved/i);
    expect(String(r.body.detail), "не названо, сколько слотов занято").toMatch(/\d+ of \d+/);
    expect(String(r.body.contactUrl), "некуда написать").toContain("/devhub/link");
  });

  test("🔴 ПЛАТНОМУ на том же пороге запас остаётся", async () => {
    // Контроль в обратную сторону: без него «отказ всем» выглядел бы починкой.
    __setПодсчётПроектовForTest(async () => порог.порогОтказаГостям());
    const { app, id } = await проектСФайлом(токенПлатного());
    const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(токенПлатного()).send({});
    expect(r.body?.error, `платного отбили: ${JSON.stringify(r.body)}`).not.toBe("publishing_temporarily_unavailable");
  });

  test("ПОВТОРНАЯ выкатка не считается новым слотом даже далеко за пределом", async () => {
    // Нового проекта Pages она не создаёт; запрет означал бы «свой сайт не обновить».
    __setПодсчётПроектовForTest(async () => порог.предел() * 10);
    const h = { "x-devhub-guest": "gost-povtornaya" };
    const { app, id } = await проектСФайлом(h);
    // Первая выкатка — ниже порога, чтобы проект получил адрес.
    __setПодсчётПроектовForTest(async () => 0);
    const первая = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
    expect(первая.status, `первая выкатка не прошла: ${JSON.stringify(первая.body)}`).toBe(200);
    // Теперь далеко за пределом — повторная обязана пройти.
    __setПодсчётПроектовForTest(async () => порог.предел() * 10);
    const вторая = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
    expect(вторая.body?.error, "повторную выкатку запретили — человек не может обновить свой сайт").not.toBe("publishing_temporarily_unavailable");
  });

  test("база не ответила — выкатку НЕ блокируем, но СЛЕД обязателен", async () => {
    /*
     * Пропуск «по своей поломке» не имеет права быть молчаливым: иначе потолок
     * однажды наступит, и не останется ни одной записи о том, что мы его не
     * считали. Поймал мутацией: убрать ветвь `занято === null` поведение НЕ
     * меняет (в JS `null >= 95` и так ложь) — исчезает ровно след. Поэтому
     * проверка смотрит на журнал, а не только на код ответа.
     */
    const записи: string[] = [];
    const былWarn = console.warn;
    console.warn = (...a: unknown[]) => { записи.push(a.map(String).join(" ")); };
    try {
      __setПодсчётПроектовForTest(async () => null);
      const h = { "x-devhub-guest": "gost-bez-bazy" };
      const { app, id } = await проектСФайлом(h);
      const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
      expect(r.body?.error, "сбой чтения превратили в отказ человеку").not.toBe("publishing_temporarily_unavailable");
      expect(
        записи.some((з) => /потолок проектов Pages не посчитан/.test(з)),
        "пропуск без следа: в журнале нет записи, что потолок не посчитан",
      ).toBe(true);
    } finally {
      console.warn = былWarn;
    }
  });
});

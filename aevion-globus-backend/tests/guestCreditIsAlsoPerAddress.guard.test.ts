/**
 * Кредит гостя считается не только по заголовку, но и по адресу клиента.
 *
 * Найдено 15.09.2026 обходом ручек DevHub, тратящих наши ключи: гость опознаётся
 * заголовком x-devhub-guest, который выбирает сам клиент. Сменил заголовок —
 * получил новый месячный кредит free: 3 видео Replicate, 10 картинок OpenAI,
 * 10k знаков ElevenLabs, 10 выкаток в наш Vercel/Cloudflare. Ограничителя по
 * адресу на этих ручках не было. Один скрипт с одного адреса тратил бы деньги и
 * кредит сборок без потолка.
 *
 * Закреплено на выкатке на Pages (лимит free — 10 в месяц): одиннадцать гостей
 * с одного адреса — одиннадцатая выкатка 402; тот же одиннадцатый гость с
 * ДРУГОГО адреса — проходит (контроль: потолок именно по адресу); вошедший
 * с того же «исчерпанного» адреса — проходит (его кредит по его id).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));
const { mockDeployViaWrangler } = vi.hoisted(() => ({ mockDeployViaWrangler: vi.fn() }));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: mockDeployViaWrangler }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { __resetProviderHealth } from "../src/lib/providerHealth";

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
const ENV = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "DEVHUB_DNS_PROVIDER", "VERCEL_API_TOKEN", "CLOUDFLARE_ZONE_ID"];
const было: Record<string, string | undefined> = {};

/** Приложение, где адрес клиента задаётся вызывающим — как у разных людей за разными сетями. */
function makeApp(ip: string) {
  const app = express();
  app.set("trust proxy", true);
  // Создание проекта само ограничено по адресу (dhCreateLimit) — это другая защита.
  // Чтобы измерять именно потолок кредита, создаём с уникальных адресов (x-test-ip),
  // а выкатываем с одного.
  app.use((req, _res, next) => { req.headers["x-forwarded-for"] = String(req.headers["x-test-ip"] ?? ip); next(); });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}
function bearer(sub = "u-paid") {
  return { Authorization: `Bearer ${jwt.sign({ sub, email: `${sub}@test.dev` }, "dev-auth-secret", { algorithm: "HS256" })}` };
}

beforeEach(() => {
  __resetDevHubStore();
  __resetProviderHealth();
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, result: {} }), text: async () => "" }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockDeployViaWrangler.mockReset();
  mockDeployViaWrangler.mockResolvedValue({ ok: true, url: "https://abc.aevion-t.pages.dev", output: "", skipped: [] });
});
afterEach(() => {
  __clearDeferredDevHubWork();
  globalThis.fetch = realFetch;
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
});

async function deployAsGuest(app: express.Express, guest: string, headers: Record<string, string> = {}) {
  const h = { "x-devhub-guest": guest, ...headers };
  const cr = await request(app).post("/api/devhub/projects").set({ ...h, "x-test-ip": `10.99.${(createSeq >> 8) & 255}.${(createSeq++ & 255) + 1}` }).send({ name: "G" });
  expect(cr.status, JSON.stringify(cr.body)).toBe(201);
  const id = cr.body.project.id as string;
  await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).set(h).send({ content: "<h1>x</h1>", language: "html" });
  return request(app).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
}

const FREE_DEPLOYS = 10;
let createSeq = 1;

describe("потолок кредита гостя по адресу клиента", () => {
  test("одиннадцать разных гостей с одного адреса — одиннадцатая выкатка 402; тот же гость с другого адреса — проходит", async () => {
    const sameIp = makeApp("203.0.113.7");
    for (let i = 0; i < FREE_DEPLOYS; i++) {
      const r = await deployAsGuest(sameIp, `guest-rot-${i}-xxxx`);
      expect(r.status, `выкатка ${i + 1}: ${JSON.stringify(r.body)}`).toBe(200);
    }
    const eleventh = await deployAsGuest(sameIp, "guest-rot-10-xxxx");
    expect(eleventh.status, "новый заголовок с того же адреса обошёл кредит").toBe(402);
    expect(eleventh.body.error).toMatch(/limit/i);

    // Контроль: дело в адресе, а не в самом гостевом id — с другого адреса тот же гость проходит.
    const otherIp = makeApp("198.51.100.9");
    const elsewhere = await deployAsGuest(otherIp, "guest-rot-10-xxxx");
    expect(elsewhere.status, JSON.stringify(elsewhere.body)).toBe(200);
  });

  test("вошедший с «исчерпанного» адреса проходит: его кредит — по его id, не по адресу", async () => {
    const sameIp = makeApp("203.0.113.8");
    for (let i = 0; i < FREE_DEPLOYS; i++) {
      expect((await deployAsGuest(sameIp, `guest-a-${i}-xxxx`)).status).toBe(200);
    }
    expect((await deployAsGuest(sameIp, "guest-a-10-xxxx")).status).toBe(402);
    const h = bearer();
    const cr = await request(sameIp).post("/api/devhub/projects").set({ ...h, "x-test-ip": "10.98.0.1" }).send({ name: "P" });
    const id = cr.body.project.id as string;
    await request(sameIp).put(`/api/devhub/projects/${id}/file?path=index.html`).set(h).send({ content: "<h1>x</h1>", language: "html" });
    const r = await request(sameIp).post(`/api/devhub/projects/${id}/deploy/pages`).set(h).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });

  test("КОНТРОЛЬ прибора: один гость по-прежнему упирается в свой кредит (десять — можно, одиннадцатая — 402)", async () => {
    const app = makeApp("203.0.113.9");
    for (let i = 0; i < FREE_DEPLOYS; i++) {
      expect((await deployAsGuest(app, "guest-same-xxxx")).status).toBe(200);
    }
    expect((await deployAsGuest(app, "guest-same-xxxx")).status).toBe(402);
  });
});

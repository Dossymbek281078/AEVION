/**
 * Общий токен GitHub AEVION — только вошедшему.
 *
 * Найдено окном приёмки 15.09.2026 обходом бэкенда: шесть GitHub-ручек DevHub брали
 * `project.envVars.GITHUB_TOKEN || process.env.GITHUB_TOKEN`, а вход в них
 * необязателен. Гость без входа создавал проект, своего токена не задавал — и
 * пушил, открывал и мержил PR под НАШИМ аккаунтом. Это ровно тот паттерн
 * (много машинных обращений с одного аккаунта), за который GitHub отключал нас
 * 27.07 (§8), плюс любой контент под нашим именем.
 *
 * Закреплено: гость без своего токена — 401 и ноль обращений к GitHub; гость со
 * СВОИМ токеном в env проекта — проходит (используется его токен); вошедший —
 * проходит с серверным. По всем шести ручкам.
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
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork, __setUserTierForTest } from "../src/routes/devhub";

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let ip = 0;
const hadServerToken = process.env.GITHUB_TOKEN;

function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => { ip += 1; req.headers["x-forwarded-for"] = `10.15.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`; next(); });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}
function bearer(sub = "u-gh") {
  return { Authorization: `Bearer ${jwt.sign({ sub, email: `${sub}@test.dev` }, "dev-auth-secret", { algorithm: "HS256" })}` };
}
const GUEST = { "x-devhub-guest": "guest-abc" };

beforeEach(() => {
  __resetDevHubStore();
  process.env.GITHUB_TOKEN = "ghp_server_token";
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ default_branch: "main", html_url: "https://github.com/x/y" }), text: async () => "" }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  __clearDeferredDevHubWork();
  globalThis.fetch = realFetch;
  if (hadServerToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = hadServerToken;
});

const ROUTES: Array<[string, string]> = [
  ["post", "github/push"],
  ["post", "github/sync"],
  ["post", "github/pull-request"],
  ["post", "github/pull-request/1/merge"],
  ["get", "github/status"],
  ["get", "github/branches"],
];

async function guestProject(app: express.Express, headers: Record<string, string>) {
  const cr = await request(app).post("/api/devhub/projects").set(headers).send({ name: "GH" });
  expect(cr.status).toBe(201);
  return cr.body.project.id as string;
}

describe("бесплатный гость без своего токена — 402, к GitHub ни одного обращения", () => {
  test.each(ROUTES)("%s /%s", async (method, path) => {
    const app = makeApp();
    const id = await guestProject(app, GUEST);
    const r = await (request(app) as any)[method](`/api/devhub/projects/${id}/${path}`).set(GUEST).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(402);
    expect(r.body.error).toMatch(/Studio Pro/);
    expect(r.body.upgrade).toBe("/devhub/link");
    const githubCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("api.github.com"));
    expect(githubCalls, "серверный токен ушёл в GitHub от гостя").toEqual([]);
  });
});

describe("контроли: свой токен гостя, вход и привязанная покупка — проходят дальше 402", () => {
  test("гость с тарифом pro (привязал покупку) — не 402, серверный токен используется", async () => {
    const app = makeApp();
    __setUserTierForTest("guest:guest-abc", "pro");
    const id = await guestProject(app, GUEST);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).set(GUEST).send({});
    expect(r.status).not.toBe(402);
    const auths = fetchMock.mock.calls.map((c) => String((c[1] as any)?.headers?.Authorization ?? ""));
    expect(auths.some((a) => a.includes("ghp_server_token"))).toBe(true);
  });

  test("гость со СВОИМ GITHUB_TOKEN в env проекта — не 401, и в GitHub уходит ЕГО токен", async () => {
    const app = makeApp();
    const id = await guestProject(app, GUEST);
    const env = await request(app).put(`/api/devhub/projects/${id}/env`).set(GUEST).send({ key: "GITHUB_TOKEN", value: "ghp_guest_own" });
    expect(env.status, JSON.stringify(env.body)).toBe(200);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).set(GUEST).send({});
    expect(r.status).not.toBe(402);
    const auths = fetchMock.mock.calls.map((c) => String((c[1] as any)?.headers?.Authorization ?? ""));
    expect(auths.some((a) => a.includes("ghp_guest_own"))).toBe(true);
    expect(auths.some((a) => a.includes("ghp_server_token")), "серверный токен не должен уходить от гостя").toBe(false);
  });

  test("вошедший без своего токена — не 401, серверный токен используется", async () => {
    const app = makeApp();
    const id = await guestProject(app, bearer());
    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).set(bearer()).send({});
    expect(r.status).not.toBe(402);
    const auths = fetchMock.mock.calls.map((c) => String((c[1] as any)?.headers?.Authorization ?? ""));
    expect(auths.some((a) => a.includes("ghp_server_token"))).toBe(true);
  });
});

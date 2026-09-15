/**
 * Проверка «страница отвечает» после выкатки на Pages — цепочкой окон, а не
 * одним; домен — по DNS, а не по HTTPS; перепроверка по требованию.
 *
 * Замер 15.09.2026 (проба probe-domain-check-375c20 на проде): загрузка через
 * wrangler прошла, окно в 2 минуты не увидело 2xx, выкатка записана failed, витрина
 * /studio покраснела (pages и domain — degraded на 30 минут) — а на третьей минуте
 * и pages.dev, и <slug>.aevion.app отдавали страницу (внешняя проверка 200).
 * /studio/deploy-stats за 30 дней: 6 выкаток, успешных 0. Новый проект Pages
 * расходится по краю дольше двух минут, и «failed» через две минуты — ложь.
 *
 * Здесь закреплено: поздний успех во ВТОРОМ окне — успех; между окнами статус
 * building, а не failed; вечно мёртвый адрес всё же становится failed (контроль);
 * домен судится по CNAME, текст не обвиняет зону, если она отработала; recheck
 * лечит старую «failed» по требованию.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

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
import {
  devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork, dnsProbe, SERVE_VERIFY_RETRY_DELAYS_MS,
} from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { __resetProviderHealth, getProviderHealth } from "../src/lib/providerHealth";

let ip = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => { ip += 1; req.headers["x-forwarded-for"] = `10.9.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`; next(); });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
const realCname = dnsProbe.cnameResolves;
const ENV = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID", "VERCEL_API_TOKEN", "DEVHUB_DNS_PROVIDER"];
const было: Record<string, string | undefined> = {};

/** pages.dev отвечает только после того, как `pagesAlive` стал true; всё остальное (Cloudflare API, Vercel DNS) — 200. */
let pagesAlive = false;
function ok(body: unknown = { success: true, result: {} }) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(0) };
}
function dead(status = 404) {
  return { ok: false, status, json: async () => ({}), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
}

beforeEach(() => {
  __resetDevHubStore();
  __resetProviderHealth();
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
  pagesAlive = false;
  fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes(".pages.dev") || u.includes(".aevion.app")) return pagesAlive ? ok({}) : dead();
    if (u.includes("api.vercel.com") && u.includes("/records") && !u.includes("/v2/")) return ok({ records: [] });
    return ok();
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockDeployViaWrangler.mockReset();
  mockDeployViaWrangler.mockResolvedValue({ ok: true, url: "https://abc.aevion-t.pages.dev", output: "", skipped: [] });
  vi.useFakeTimers();
});
afterEach(() => {
  __clearDeferredDevHubWork();
  vi.useRealTimers();
  globalThis.fetch = realFetch;
  dnsProbe.cnameResolves = realCname;
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
});

async function deployNew(app: express.Express, name = "Chain") {
  const cr = await request(app).post("/api/devhub/projects").send({ name, stack: "static" });
  const id = cr.body.project.id as string;
  await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>hi</h1>", language: "html" });
  const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { id, deploymentId: r.body.deploymentId as string, body: r.body };
}

async function deployment(app: express.Express, id: string, deploymentId: string) {
  const r = await request(app).get(`/api/devhub/projects/${id}/deployments`);
  return r.body.deployments.find((d: { id: string }) => d.id === deploymentId);
}

const FIRST_WINDOW_MS = 4000 + 24 * 5000 + 1000;

describe("цепочка окон: поздний успех — успех, между окнами — building", () => {
  test("адрес поднялся ко второму окну: было building, стало live, проект получил адрес, витрина pages — ok", async () => {
    const app = makeApp();
    const { id, deploymentId } = await deployNew(app);

    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_MS);
    const afterFirst = await deployment(app, id, deploymentId);
    expect(afterFirst.status, "после первого окна без ответа — ещё не failed").toBe("building");
    expect(afterFirst.buildLog).toMatch(/verify 1: no 2xx yet/);
    expect(getProviderHealth("pages"), "витрина не краснеет после первого окна").toBeNull();

    pagesAlive = true;
    await vi.advanceTimersByTimeAsync(SERVE_VERIFY_RETRY_DELAYS_MS[0] + 6000);
    const afterSecond = await deployment(app, id, deploymentId);
    expect(afterSecond.status).toBe("live");
    expect(afterSecond.buildLog).toMatch(/page answers 2xx/);
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.deployUrl).toBe("https://abc.aevion-t.pages.dev");
    expect(proj.status).toBe("live");
    expect(getProviderHealth("pages")?.ok).toBe(true);
  });

  test("КОНТРОЛЬ: адрес, который не отвечает никогда, после всех окон — failed, и витрина pages краснеет только тогда", async () => {
    const app = makeApp();
    const { id, deploymentId } = await deployNew(app, "Dead");

    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_MS);
    await vi.advanceTimersByTimeAsync(SERVE_VERIFY_RETRY_DELAYS_MS[0] + 24 * 5000 + 2000);
    expect((await deployment(app, id, deploymentId)).status, "после второго окна — всё ещё building").toBe("building");
    expect(getProviderHealth("pages")).toBeNull();

    await vi.advanceTimersByTimeAsync(SERVE_VERIFY_RETRY_DELAYS_MS[1] + 24 * 5000 + 2000);
    const final = await deployment(app, id, deploymentId);
    expect(final.status).toBe("failed");
    expect(final.buildLog).toMatch(/never answered 2xx across three windows/);
    expect(final.buildLog).not.toMatch(/5 attempts, 5s apart/);
    expect(getProviderHealth("pages")?.ok).toBe(false);
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.deployUrl ?? null).toBeNull();
  });
});

describe("recheck: старая «failed» лечится по требованию", () => {
  test("адрес ответил при перепроверке — выкатка и проект live; молчит — честное «пока нет»", async () => {
    const app = makeApp();
    const { id, deploymentId } = await deployNew(app, "Late");
    await vi.advanceTimersByTimeAsync(FIRST_WINDOW_MS);
    await vi.advanceTimersByTimeAsync(SERVE_VERIFY_RETRY_DELAYS_MS[0] + 24 * 5000 + 2000);
    await vi.advanceTimersByTimeAsync(SERVE_VERIFY_RETRY_DELAYS_MS[1] + 24 * 5000 + 2000);
    expect((await deployment(app, id, deploymentId)).status).toBe("failed");

    // Дальше — настоящие таймеры: паузы verifyDeploymentServes внутри запроса
    // (3 попытки по 1 с) планируются после сетевого хода supertest, и поддельные
    // часы их не видят — под ними запрос висел бы до таймаута теста.
    vi.useRealTimers();
    const r1 = await request(app).post(`/api/devhub/projects/${id}/deployments/${deploymentId}/recheck`).send({});
    expect(r1.status).toBe(200);
    expect(r1.body.serves).toBe(false);
    expect(r1.body.status).toBe("failed");

    pagesAlive = true;
    const r2 = await request(app).post(`/api/devhub/projects/${id}/deployments/${deploymentId}/recheck`).send({});
    expect(r2.status).toBe(200);
    expect(r2.body.serves).toBe(true);
    expect((await deployment(app, id, deploymentId)).status).toBe("live");
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.deployUrl).toBe("https://abc.aevion-t.pages.dev");
    expect(getProviderHealth("pages")?.ok).toBe(true);
  });

  test("неизвестная выкатка — 404, не 500", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "N" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/deployments/nope/recheck`).send({});
    expect(r.status).toBe(404);
  });
});

describe("домен судится по DNS, а не по HTTPS", () => {
  function vercelDns() {
    process.env.DEVHUB_DNS_PROVIDER = "vercel";
    process.env.VERCEL_API_TOKEN = "vcp_test";
  }

  test("CNAME разрешился — витрина domain ok, текст про сертификат Pages, зону не обвиняет; liveUrl — pages.dev", async () => {
    vercelDns();
    dnsProbe.cnameResolves = async () => true;
    const app = makeApp();
    const { body } = await deployNew(app, "Shop");
    expect(body.domain).toMatch(/^shop-[a-z0-9]{6}\.aevion\.app$/);
    expect(body.domainDns).toBe(true);
    expect(body.domainReady).toBe(false);
    expect(body.liveUrl).toBe(body.pagesUrl);
    expect(body.message).toMatch(/certificate/);
    expect(body.message).not.toMatch(/zone is not ready/);
    expect(getProviderHealth("domain")?.ok).toBe(true);
  });

  test("КОНТРОЛЬ: CNAME не разрешился — в момент ответа витрина НЕ красная (запись только создана); красная — когда страница уже ответила, а CNAME так и не виден", async () => {
    vercelDns();
    dnsProbe.cnameResolves = async () => false;
    const app = makeApp();
    const { id, deploymentId, body } = await deployNew(app, "Shop");
    expect(body.domainDns).toBe(false);
    expect(body.message).toMatch(/does not resolve/);
    expect(getProviderHealth("domain"), "отказ сразу после записи — та же ложь, что HTTPS-проба").toBeNull();
    pagesAlive = true;
    fetchMock.mockImplementation(async (url: string) => (String(url).includes(".pages.dev") ? ok({}) : String(url).includes(".aevion.app") ? dead(526) : ok()));
    await vi.advanceTimersByTimeAsync(4000 + 40_000);
    expect((await deployment(app, id, deploymentId)).status).toBe("live");
    const h = getProviderHealth("domain");
    expect(h?.ok).toBe(false);
    expect(h?.reason).toMatch(/does not resolve/);
    expect(h?.reason).toMatch(/Vercel/);
  });

  test("страница ответила, домен по HTTPS ещё нет — выкатка live, домен записан в проект, витрина domain НЕ красная", async () => {
    vercelDns();
    dnsProbe.cnameResolves = async () => true;
    const app = makeApp();
    const { id, deploymentId, body } = await deployNew(app, "Shop");
    // pages.dev отвечает, домен — нет (сертификат ещё выпускается)
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes(".pages.dev")) return ok({});
      if (u.includes(".aevion.app")) return dead(526);
      return ok();
    });
    await vi.advanceTimersByTimeAsync(4000 + 40_000);
    const d = await deployment(app, id, deploymentId);
    expect(d.status).toBe("live");
    expect(d.buildLog).toMatch(/certificate pending/);
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.customDomain).toBe(body.domain);
    expect(getProviderHealth("domain")?.ok, "не-ответ HTTPS домена сразу после выкатки — не отказ DNS").toBe(true);
  });
});

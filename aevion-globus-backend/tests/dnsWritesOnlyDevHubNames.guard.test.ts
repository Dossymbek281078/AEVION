/**
 * DevHub пишет в зону aevion.app ТОЛЬКО свои имена и трогает ТОЛЬКО свои записи.
 *
 * Найдено окном приёмки 15.09.2026 (на проде не воспроизводилось): гость без входа
 * создавал проект, писал ему customDomain «api.aevion.app» (PATCH — без проверки),
 * звал /domain/auto-setup → upsertCname находил в зоне Vercel CNAME `api`, УДАЛЯЛ
 * его и ставил свой → весь бэкенд на Railway переставал отвечать. Тот же путь снёс
 * бы brevo1/2._domainkey (подпись писем) и любую запись зоны.
 *
 * Три слоя, каждый закреплён отдельно: DNS-слой отказывает до единого запроса к
 * поставщику; чужую запись с «нашим» именем не удаляет; маршруты не дают проекту
 * носить чужое имя внутри зоны, а auto-setup внутри зоны не пишет ничего.
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
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { upsertCname, cnameWriteRefusal, isDevHubLabel, isOurTarget } from "../src/lib/devhubDns";
// eslint-disable-next-line import/first
import { __resetProviderHealth } from "../src/lib/providerHealth";

const ENV = ["DEVHUB_DNS_PROVIDER", "DEVHUB_SITE_ZONE", "VERCEL_API_TOKEN", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_ACCOUNT_ID"];
const было: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetDevHubStore();
  __resetProviderHealth();
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  __clearDeferredDevHubWork();
  globalThis.fetch = realFetch;
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
});

function resp(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}
function vercelEnv() { process.env.DEVHUB_DNS_PROVIDER = "vercel"; process.env.VERCEL_API_TOKEN = "vcp_test"; }

let ip = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => { ip += 1; req.headers["x-forwarded-for"] = `10.11.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`; next(); });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("DNS-слой: отказ ДО единого запроса к поставщику", () => {
  test.each([
    ["api.aevion.app", "бэкенд"],
    ["brevo1._domainkey.aevion.app", "подпись писем"],
    ["aevion.app", "вершина зоны"],
    ["www.aevion.app", "сайт"],
  ])("%s (%s)", async (fqdn, _why) => {
    vercelEnv();
    const r = await upsertCname(fqdn, "devhub.aevion.app");
    expect(r.ok).toBe(false);
    expect(fetchMock, `${fqdn}: к поставщику ходить нельзя`).not.toHaveBeenCalled();
  });

  test("контроль прибора: своё имя с целью pages.dev проходит (список + создание)", async () => {
    vercelEnv();
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [{ id: "r1", name: "api", type: "CNAME", value: "ok6wvjyl.up.railway.app." }] }))
      .mockResolvedValueOnce(resp(200, { uid: "rec-new" }));
    const r = await upsertCname("shop-abc123.aevion.app", "aevion-shop-abc123.pages.dev");
    expect(r).toEqual({ ok: true, action: "created", recordId: "rec-new" });
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "DELETE"), "чужой `api` не тронут").toBe(false);
  });

  test("цель не наша (не pages.dev / vercel.app / devhub.<зона>) — отказ", () => {
    expect(cnameWriteRefusal("shop-abc123.aevion.app", "evil.example.com")).toMatch(/not a DevHub destination/);
    expect(isOurTarget("aevion-x.pages.dev.")).toBe(true);
    expect(isOurTarget("ok6wvjyl.up.railway.app")).toBe(false);
    expect(isDevHubLabel("api")).toBe(false);
    expect(isDevHubLabel("brevo1._domainkey")).toBe(false);
    expect(isDevHubLabel("probe-domain-check-375c20")).toBe(true);
  });
});

describe("DNS-слой: чужую запись с нашим по форме именем не удаляем", () => {
  test("Vercel: существующий CNAME смотрит не на pages.dev — отказ, DELETE не было", async () => {
    vercelEnv();
    fetchMock.mockResolvedValueOnce(resp(200, { records: [{ id: "r9", name: "api-abc123", type: "CNAME", value: "ok6wvjyl.up.railway.app." }] }));
    const r = await upsertCname("api-abc123.aevion.app", "aevion-api-abc123.pages.dev");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toMatch(/points elsewhere/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });

  test("КОНТРОЛЬ: существующий CNAME на старый pages.dev — заменяется (delete + create)", async () => {
    vercelEnv();
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [{ id: "r7", name: "shop-abc123", type: "CNAME", value: "old.pages.dev" }] }))
      .mockResolvedValueOnce(resp(200, {}))
      .mockResolvedValueOnce(resp(200, { uid: "rec-2" }));
    const r = await upsertCname("shop-abc123.aevion.app", "new.pages.dev");
    expect(r).toEqual({ ok: true, action: "updated", recordId: "rec-2" });
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });

  test("Cloudflare: тот же слой — чужой content не заменяется", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "c"; process.env.CLOUDFLARE_ZONE_ID = "z";
    fetchMock.mockResolvedValueOnce(resp(200, { result: [{ id: "cf1", content: "mail.example.net" }] }));
    const r = await upsertCname("shop-abc123.aevion.app", "aevion-shop-abc123.pages.dev");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("маршруты: проект не может носить чужое имя внутри зоны", () => {
  test("PATCH customDomain=api.aevion.app → 400; своё имя <slug>-<id6>.aevion.app → 200; чужой внешний домен → 200", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Shop" });
    const id = cr.body.project.id as string;
    const own = `shop-${id.slice(0, 6)}.aevion.app`;

    const bad = await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: "api.aevion.app" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/not this project's DevHub name/);
    const dkim = await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: "brevo1._domainkey.aevion.app" });
    expect(dkim.status).toBe(400);
    const other = await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: "shop-ffffff.aevion.app" });
    expect(other.status, "имя DevHub-формы, но чужого проекта").toBe(400);

    const ok = await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: own });
    expect(ok.status).toBe(200);
    const ext = await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: "myshop.example.com" });
    expect(ext.status).toBe(200);
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.customDomain).toBe("myshop.example.com");
  });

  test("POST /domain с api.aevion.app → 400 (регулярка формы больше не единственная проверка)", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Shop" });
    const id = cr.body.project.id as string;
    const r = await request(app).post(`/api/devhub/projects/${id}/domain`).send({ domain: "API.aevion.app" });
    expect(r.status).toBe(400);
    const proj = (await request(app).get(`/api/devhub/projects/${id}`)).body.project;
    expect(proj.customDomain ?? null).toBeNull();
  });

  test("auto-setup для имени внутри зоны — 400 и ни одного запроса к DNS", async () => {
    vercelEnv();
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Shop" });
    const id = cr.body.project.id as string;
    await request(app).patch(`/api/devhub/projects/${id}`).send({ customDomain: `shop-${id.slice(0, 6)}.aevion.app` });
    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/domain\/setup/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

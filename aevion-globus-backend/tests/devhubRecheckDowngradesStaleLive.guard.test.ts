/**
 * A DevHub project marked "live" must stop claiming «Живой» once its address
 * really goes away. Measured on prod 11→12.10.2026 (guest path): a static
 * project passed the 2xx serve-check (→ status "live"), then its *.pages.dev
 * went NXDOMAIN within minutes, and the card kept showing «Живой» over a dead
 * URL — because the code only ever UPGRADED to live, never downgraded.
 *
 * The guard drives POST /projects/:id/recheck with a stubbed fetch, so no real
 * Cloudflare address is touched (the control user-21 asked for: 2xx vs
 * NXDOMAIN/404/timeout, not a live republish). It pins the exact policy:
 *   - a serving address keeps "live";
 *   - NXDOMAIN or 404 downgrades to "error" at once;
 *   - an ambiguous failure (timeout/5xx) does NOT downgrade on the first miss —
 *     it may be our own network — only after two in a row;
 *   - rechecks are rate-limited per project.
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
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: vi.fn(() => []),
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import {
  devhubRouter,
  __resetDevHubStore,
  __clearDeferredDevHubWork,
  __setReconcileRateMsForTest,
  __setReconcileDeployGraceMsForTest,
} from "../src/routes/devhub";

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let testClientIp = 0;

function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    testClientIp += 1;
    req.headers["x-forwarded-for"] = `10.9.${Math.floor(testClientIp / 250) % 250}.${(testClientIp % 250) + 1}`;
    req.headers["x-devhub-guest"] = "t-devhub-recheck";
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

async function seedLiveProject(app: express.Express, deployUrl = "https://x.pages.dev"): Promise<string> {
  const cr = await request(app).post("/api/devhub/projects").send({ name: "Live", stack: "static" });
  const id = cr.body.project?.id ?? cr.body.id;
  expect(id).toBeTruthy();
  await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>hi</h1>" });
  const patched = await request(app).patch(`/api/devhub/projects/${id}`).send({ status: "live", deployUrl });
  expect(patched.body.project?.status ?? patched.body.status).toBe("live");
  return id;
}

const nxdomain = () => Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
const timeout = () => Object.assign(new Error("timeout"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });

beforeEach(() => {
  __resetDevHubStore();
  __setReconcileRateMsForTest(0); // no rate-limit except in the test that checks it
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  __clearDeferredDevHubWork();
  globalThis.fetch = originalFetch;
});

describe("POST /api/devhub/projects/:id/recheck — a dead 'live' address is downgraded, a blip is not", () => {
  test("a serving address (2xx) keeps the project live", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("live");
    expect(r.body.serves).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("NXDOMAIN downgrades to error once past the propagation window (the measured prod bug)", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    __setReconcileDeployGraceMsForTest(0); // выкатка уже «старая» — окно распространения прошло
    fetchMock.mockRejectedValue(nxdomain());
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("error");
    expect(r.body.verdict).toBe("nxdomain");
    expect(r.body.message).toMatch(/republish/i);
    // and it is persisted: the list no longer calls it live
    const list = await request(app).get("/api/devhub/projects");
    expect(list.body.projects.find((p: any) => p.id === id).status).toBe("error");
  });

  test("a 404 downgrades to error once past the propagation window", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    __setReconcileDeployGraceMsForTest(0);
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("error");
    expect(r.body.verdict).toBe("gone404");
  });

  test("NXDOMAIN on a YOUNG deployment does NOT downgrade — the *.pages.dev is still propagating (default 30-min grace)", async () => {
    // Регрессия 12.10.2026: понижение на NXDOMAIN сразу ложно рубило только что
    // опубликованный живой адрес, который ещё расходится по краю CF. Проект,
    // засеянный только что, МОЛОДОЙ — при дефолтном окне NXDOMAIN не понижает.
    const app = makeApp();
    const id = await seedLiveProject(app);
    // окно НЕ трогаем: __resetDevHubStore вернул дефолт 30 мин
    fetchMock.mockRejectedValue(nxdomain());
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("live");       // живой: распространяется, а не умер
    expect(r.body.verdict).toBe("nxdomain");
    expect(r.body.serves).toBe(false);
    const list = await request(app).get("/api/devhub/projects");
    expect(list.body.projects.find((p: any) => p.id === id).status).toBe("live");
  });

  test("a young NXDOMAIN does not even arm the ambiguous counter: a later real death still needs the window to pass", async () => {
    // В грейсе NXDOMAIN не копит счётчик — иначе «распространение» тихо
    // превратилось бы в понижение. После снятия окна одиночный NXDOMAIN рубит.
    const app = makeApp();
    const id = await seedLiveProject(app);
    fetchMock.mockRejectedValue(nxdomain());
    const young = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(young.body.status).toBe("live");
    __setReconcileDeployGraceMsForTest(0);     // окно прошло
    const aged = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(aged.body.status).toBe("error");
    expect(aged.body.verdict).toBe("nxdomain");
  });

  test("a SINGLE timeout does NOT downgrade — it may be our network (status stays live)", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    fetchMock.mockRejectedValueOnce(timeout());
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("live");
    expect(r.body.verdict).toBe("ambiguous");
  });

  test("a single 5xx does not downgrade, but two ambiguous failures in a row do", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const first = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(first.body.status).toBe("live");
    const second = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(second.body.status).toBe("error");
    expect(second.body.verdict).toBe("ambiguous");
  });

  test("a recovery (ok) between ambiguous failures resets the counter — no downgrade", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });     // ambiguous #1
    await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });       // recovered
    await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });     // ambiguous again, but counter was reset
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.status).toBe("live");
  });

  test("a non-live project is not probed at all", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Draft", stack: "static" });
    const id = cr.body.project?.id ?? cr.body.id;
    const r = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(r.body.checked).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rate-limit: a second recheck within the window does not hit the address again", async () => {
    const app = makeApp();
    const id = await seedLiveProject(app);
    __setReconcileRateMsForTest(60_000);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    const second = await request(app).post(`/api/devhub/projects/${id}/recheck`).send({});
    expect(second.body.checked).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

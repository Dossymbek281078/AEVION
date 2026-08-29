/**
 * DevHub deploys, domains and project databases — split out of
 * devhub-integrations.test.ts (#978), third and final cut.
 *
 * These are the tests behind the day the deploys were caught lying: serve
 * verification, the Railway path that used to redeploy AEVION's own backend,
 * per-project services, the aevion.build promise, provisioning and quotas.
 * They belong together and away from the rest.
 *
 * The harness is duplicated on purpose: vi.mock is hoisted per file.
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock pg pool before importing anything that touches it
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Mock ensureDevHubTables — pretend DB is NOT ready so we use in-memory store
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// Mock AI providers so /generate doesn't hit real OpenAI in any side path
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: vi.fn(() => []),
  callProvider: vi.fn(),
}));

// Mock the wrangler CLI wrapper — tests must never spawn a real npx process.
const { mockDeployViaWrangler } = vi.hoisted(() => ({ mockDeployViaWrangler: vi.fn() }));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({
  deployViaWrangler: mockDeployViaWrangler,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork } from "../src/routes/devhub";
import { __resetProviderHealth } from "../src/lib/providerHealth";
// eslint-disable-next-line import/first
import { getProviders, callProvider } from "../src/services/qcoreai/providers";

// Каждому запросу свой адрес клиента, как у разных людей.
//
// Зачем (29.08.2026): создание проекта получило предел частоты по адресу —
// это единственная запись в базу без входа и без платы, и без предела её
// мог заполнять любой скрипт. Этот файл делает десятки запросов из одного
// процесса, то есть с одного адреса, и упирался бы в предел вместо того,
// что проверяет.
//
// Ослаблять предел ради тестов нельзя: тогда проверялась бы не та защита.
// Настоящие пользователи приходят с разных адресов — так и здесь.
let testClientIp = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    testClientIp += 1;
    req.headers["x-forwarded-for"] = `10.7.${Math.floor(testClientIp / 250) % 250}.${(testClientIp % 250) + 1}`;
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

// ─── Fetch mock helper ───────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetDevHubStore();
  // Provider health is process-wide and in-memory: a route that recorded a
  // real failure in one test made a later test see `degraded` where it
  // expected the token-derived `live`. Same class as the deferred timers.
  __resetProviderHealth();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockDeployViaWrangler.mockReset();
});

afterEach(() => {
  // Post-deploy verification scheduled by a test in this file used to fire
  // during a LATER test and eat its mocked fetch — the suite then failed on a
  // different test each run (issue #982). Drop what is still pending.
  __clearDeferredDevHubWork();
  globalThis.fetch = originalFetch;
  vi.mocked(getProviders).mockReturnValue([]);
  vi.mocked(callProvider).mockReset();
  for (const key of [
    "GITHUB_TOKEN", "VERCEL_API_TOKEN", "ELEVENLABS_API_KEY",
    "RAILWAY_API_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID",
    "BREVO_API_KEY", "PADDLE_API_KEY", "PADDLE_SANDBOX",
    "LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_DEFAULT_VARIANT_ID",
    "OPENAI_API_KEY",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_PUBLIC_URL",
    "DEEPL_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME",
    "GOOGLE_DRIVE_ACCESS_TOKEN", "TOGETHER_API_KEY",
    // Added with the media/database work: a leftover REPLICATE_API_TOKEN makes
    // the music route take its new MusicGen fallback and fire a second fetch,
    // which fails an unrelated test depending on file order. The others gate
    // provisioning and per-project deploys the same way.
    "REPLICATE_API_TOKEN", "DEVHUB_DB_ADMIN_URL", "DEVHUB_RAILWAY_PER_PROJECT",
    "DEVHUB_DB_CONNECTION_LIMIT", "ELEVENLABS_TTS_MODEL",
    "RAILWAY_DEPLOY_PROJECT_ID", "RAILWAY_DEPLOY_ENV_ID",
  ]) {
    delete process.env[key];
  }
});

function jsonResp(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function audioResp(status: number, bytes: number = 1024) {
  const buf = new ArrayBuffer(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => "binary",
    arrayBuffer: async () => buf,
  };
}
describe("POST /api/devhub/projects/:id/database/design — schema by prompt", () => {
  test("400 without a description; 404 for unknown project", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const id = cr.body.project.id as string;
    expect((await request(app).post(`/api/devhub/projects/${id}/database/design`).send({})).status).toBe(400);
    expect((await request(app).post("/api/devhub/projects/nope/database/design").send({ description: "x" })).status).toBe(404);
  });

  test("writes db/schema.sql + a stack-appropriate client and reports aiGenerated honestly", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "express" });
    const id = cr.body.project.id as string;

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/database/design`)
      .send({ description: "a todo app with users and tasks" });

    expect(r.status).toBe(200);
    // No AI provider mocked → the stub path must say so, not fake success.
    expect(r.body.aiGenerated).toBe(false);
    expect(r.body.note).toMatch(/No database was provisioned/);
    const paths = r.body.files.map((f: { path: string }) => f.path);
    expect(paths).toContain("db/schema.sql");
    expect(paths).toContain("db/client.ts");
    expect(r.body.checkpointId).toBeTruthy(); // undo works on schema design too
    const listed = await request(app).get(`/api/devhub/projects/${id}/files`);
    expect(listed.body.files.map((f: { path: string }) => f.path)).toEqual(expect.arrayContaining(["db/schema.sql", "db/client.ts"]));
  });
});

describe("GET /api/devhub/projects — needsRedeploy staleness flag", () => {
  test("flags a deployed project whose files were edited after the last deploy", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Stale" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>v1</h1>" });

    fetchMock.mockResolvedValueOnce(jsonResp(200, { success: true }));
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://stale.pages.dev", output: "", skipped: []});
    const dep = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});
    expect(dep.status).toBe(200);
    // The pages route flips project.deployUrl in a deferred "mark live" step
    // (4s setTimeout) — set it directly, as a completed deploy would have.
    await request(app).patch(`/api/devhub/projects/${id}`).send({ deployUrl: "https://stale.pages.dev" });

    // Freshly deployed → not stale
    let list = await request(app).get("/api/devhub/projects");
    let proj = list.body.projects.find((p: any) => p.id === id);
    expect(proj.deployUrl).toBeTruthy();
    expect(proj.needsRedeploy).toBe(false);

    // Edit a file after the deploy → stale
    await new Promise((r) => setTimeout(r, 10));
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>v2</h1>" });
    list = await request(app).get("/api/devhub/projects");
    proj = list.body.projects.find((p: any) => p.id === id);
    expect(proj.needsRedeploy).toBe(true);
  });
});

describe("verifyDeploymentServes — post-deploy serve check", () => {
  test("recovers when the page starts serving after a warm-up 500", async () => {
    const { verifyDeploymentServes } = await import("../src/routes/devhub");
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(verifyDeploymentServes("https://x.pages.dev", 1)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("reports false after 5 non-2xx attempts (assets never stored — the live CF bug)", async () => {
    const { verifyDeploymentServes } = await import("../src/routes/devhub");
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(verifyDeploymentServes("https://x.pages.dev", 1)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("POST /api/devhub/projects/:id/deploy/pages — redeploy of an existing CF Pages project", () => {
  test("'already exists' create error under a non-8000000 code proceeds to upload instead of 500", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const id = cr.body.project.id as string;
    await request(app)
      .put(`/api/devhub/projects/${id}/file?path=index.html`)
      .send({ content: "<h1>hi</h1>" });

    fetchMock.mockResolvedValueOnce(jsonResp(400, {
      success: false,
      // Live 2026-07-21: CF answered with this message under a code ≠ 8000000
      errors: [{ code: 8000007, message: "A project with this name already exists. Choose a different project name." }],
    }));
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://t-abc123.pages.dev", output: "", skipped: []});

    const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});

    expect(r.status).toBe(200);
    expect(mockDeployViaWrangler).toHaveBeenCalledTimes(1);
    expect(r.body.pagesUrl ?? r.body.liveUrl ?? r.body.deployUrl).toContain("pages.dev");
  });

  test("wrangler failure marks the deployment failed and returns 502 with the reason", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>hi</h1>" });

    fetchMock.mockResolvedValueOnce(jsonResp(200, { success: true }));
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: false, error: "wrangler exited with code 1: auth error", output: "", skipped: []});

    const r = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});

    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/wrangler exited/);
  });
});

describe("GET /api/devhub/projects/:id/preview-proxy (Visual Edit for deployed stacks)", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    expect(cr.status).toBe(201);
    return cr.body.project.id as string;
  }

  test("404 for unknown project", async () => {
    const r = await request(makeApp()).get("/api/devhub/projects/nope/preview-proxy");
    expect(r.status).toBe(404);
  });

  test("409 when the project has no https deployment", async () => {
    const app = makeApp();
    const id = await createProject(app);
    const r = await request(app).get(`/api/devhub/projects/${id}/preview-proxy`);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/no https deployment/);
  });

  test("proxies the project's own deployUrl, injecting <base> and the tagging overlay", async () => {
    const app = makeApp();
    const id = await createProject(app);
    await request(app).patch(`/api/devhub/projects/${id}`).send({ deployUrl: "https://myapp.example" });
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => "<html><head><title>t</title></head><body><h1>Hi</h1></body></html>",
    });

    const r = await request(app).get(`/api/devhub/projects/${id}/preview-proxy`);

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://myapp.example");
    expect(r.text).toContain('<base href="https://myapp.example/">');
    expect(r.text).toContain("devhub-visual-edit"); // overlay contract injected
    expect(r.text).toContain("setAttribute('data-vid'"); // runtime tagger
  });

  test("normalizes a legacy doubled-scheme deployUrl before fetching (and never accepts a caller URL)", async () => {
    const app = makeApp();
    const id = await createProject(app);
    await request(app).patch(`/api/devhub/projects/${id}`).send({ deployUrl: "https://https://legacy.example" });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<body>x</body>" });

    const r = await request(app).get(`/api/devhub/projects/${id}/preview-proxy?url=https://evil.example`);

    expect(r.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://legacy.example");
  });
});

describe("POST /api/devhub/projects/:id/deploy (Railway)", () => {
  // The legacy path these tests covered — deploymentCreate against a single
  // shared RAILWAY_SERVICE_ID — is gone. It never deployed the user's code and
  // on production that id was the AEVION backend's own service, so every click
  // restarted our API. With DEVHUB_RAILWAY_PER_PROJECT set the request now
  // takes the per-project path (own service, own repo, own env vars); without
  // it, the route refuses. Both states are covered by the two describes below
  // ("Railway deploy no longer restarts our own backend" and "per-project
  // Railway deploys"), so the old assertions were removed rather than adapted
  // to a code path that no longer exists.
  test("legacy shared-service deploy path is gone", async () => {
    delete process.env.DEVHUB_RAILWAY_PER_PROJECT;
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.RAILWAY_PROJECT_ID = "proj";
    process.env.RAILWAY_SERVICE_ID = "svc";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Legacy" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/deploy`).send({});
    expect(r.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
    delete process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_SERVICE_ID;
  });
});

describe("POST /api/devhub/projects/:id/domain/auto-setup (Cloudflare)", () => {
  async function createProject(app: express.Express, withDomain = true) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Test" });
    expect(cr.status).toBe(201);
    const id = cr.body.project.id;
    if (withDomain) {
      await request(app).post(`/api/devhub/projects/${id}/domain`).send({ domain: "myapp.example.com" });
    }
    return id;
  }

  test("503 + manual instruction when Cloudflare env not set", async () => {
    const app = makeApp();
    const id = await createProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/CLOUDFLARE/);
    expect(r.body.manualInstruction).toContain("myapp.example.com");
    expect(r.body.manualInstruction).toContain("devhub.aevion.app");
  });

  test("400 when project has no customDomain", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ZONE_ID = "zone-fake";
    const app = makeApp();
    const id = await createProject(app, false);
    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/customDomain/);
  });

  test("creates new CNAME when record doesn't exist", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ZONE_ID = "zone-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { result: [] })) // list → empty
      .mockResolvedValueOnce(jsonResp(200, { result: { id: "rec-new-1" } })); // create

    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      action: "created",
      domain: "myapp.example.com",
      cname: "devhub.aevion.app",
      recordId: "rec-new-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/dns_records?type=CNAME");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  test("reports already-configured when CNAME already points to devhub.aevion.app", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ZONE_ID = "zone-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      result: [{ id: "rec-existing", content: "devhub.aevion.app" }],
    }));

    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("already-configured");
    expect(r.body.recordId).toBe("rec-existing");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only list, no create/update
  });

  test("updates existing CNAME when pointing elsewhere", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ZONE_ID = "zone-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, {
        result: [{ id: "rec-wrong", content: "other.target.com" }],
      }))
      .mockResolvedValueOnce(jsonResp(200, { result: { id: "rec-wrong" } }));

    const r = await request(app).post(`/api/devhub/projects/${id}/domain/auto-setup`).send({});
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("updated");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });
});

describe("database provisioning", () => {
  async function proj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "DbProj", stack: "next" });
    return cr.body.project.id;
  }

  test("503 with the env var named when provisioning is not configured", async () => {
    delete process.env.DEVHUB_DB_ADMIN_URL;
    const app = makeApp();
    const id = await proj(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/database/provision`).send({});
    expect(r.status).toBe(503);
    expect(r.body.envVar).toBe("DEVHUB_DB_ADMIN_URL");
  });

  test("refuses to provision on the platform's own database", async () => {
    const { refusesPlatformDatabase } = await import("../src/lib/devhubDbProvision");
    const same = "postgres://admin:x@db.internal:5432/aevion";
    expect(refusesPlatformDatabase(same, "postgres://other:y@db.internal:5432/aevion")).toBe(true);
    expect(refusesPlatformDatabase(same, "postgres://admin:x@projects.internal:5432/aevion")).toBe(false);
    expect(refusesPlatformDatabase(same, undefined)).toBe(false);
  });

  test("derives safe identifiers and a scoped connection string", async () => {
    const m = await import("../src/lib/devhubDbProvision");
    const pid = "e35bc59c-56e1-4467-bc01-dc1cb5ed5abe";
    expect(m.schemaNameFor(pid)).toBe("p_e35bc59c56e1");
    expect(m.roleNameFor(pid)).toBe("u_e35bc59c56e1");
    const url = m.buildProjectUrl("postgres://admin:pw@host:5432/db", "u_x", "s3cret", "p_x");
    expect(url).toContain("u_x:s3cret@host:5432/db");
    // URLSearchParams encodes the space as "+", so normalise before asserting.
    expect(decodeURIComponent(url).replace(/\+/g, " ")).toContain("options=-c search_path=p_x");
  });

  test("creates role + schema, locks it out of public, applies the project's schema.sql", async () => {
    const executed: string[] = [];
    const m = await import("../src/lib/devhubDbProvision");
    const r = await m.provisionProjectDatabase({
      projectId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      schemaSql: "CREATE TABLE IF NOT EXISTS todos (id serial primary key);",
      adminUrl: "postgres://admin:pw@projects.internal:5432/pool",
      platformUrl: "postgres://admin:pw@platform.internal:5432/aevion",
      query: async (sql) => {
        executed.push(sql.trim().split("\n")[0]);
        return { rows: sql.includes("pg_roles") ? [] : [] };
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appliedSchemaSql).toBe(true);
    const joined = executed.join(" | ");
    expect(joined).toContain("CREATE ROLE u_aaaaaaaabbbb LOGIN PASSWORD");
    expect(joined).toContain("CREATE SCHEMA IF NOT EXISTS p_aaaaaaaabbbb AUTHORIZATION u_aaaaaaaabbbb");
    expect(joined).toContain("REVOKE ALL ON SCHEMA public FROM u_aaaaaaaabbbb");
    expect(joined).toContain("SET ROLE u_aaaaaaaabbbb"); // DDL runs as the project, not as admin
    expect(joined).toContain("RESET ROLE");
    expect(r.databaseUrl).not.toContain("admin:pw@"); // admin credential never leaks to the project
  });

  test("rotates the password instead of failing when the role already exists", async () => {
    const executed: string[] = [];
    const m = await import("../src/lib/devhubDbProvision");
    const r = await m.provisionProjectDatabase({
      projectId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      adminUrl: "postgres://admin:pw@projects.internal:5432/pool",
      query: async (sql) => {
        executed.push(sql.trim().split("\n")[0]);
        return { rows: sql.includes("pg_roles") ? [{ "?column?": 1 }] : [] };
      },
    });
    expect(r.ok).toBe(true);
    expect(executed.join(" | ")).toContain("ALTER ROLE u_aaaaaaaabbbb WITH LOGIN PASSWORD");
    expect(executed.join(" | ")).not.toContain("CREATE ROLE");
  });

  test("deprovision drops schema, owned objects and role", async () => {
    const executed: string[] = [];
    const m = await import("../src/lib/devhubDbProvision");
    const r = await m.deprovisionProjectDatabase({
      projectId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      adminUrl: "postgres://admin:pw@projects.internal:5432/pool",
      query: async (sql) => {
        executed.push(sql.trim());
        return { rows: [] };
      },
    });
    expect(r.ok).toBe(true);
    expect(executed).toContain("DROP SCHEMA IF EXISTS p_aaaaaaaabbbb CASCADE");
    expect(executed).toContain("DROP ROLE IF EXISTS u_aaaaaaaabbbb");
  });
});

describe("deleting a project drops its database", () => {
  test("no DATABASE_URL on the project → delete proceeds untouched", async () => {
    delete process.env.DEVHUB_DB_ADMIN_URL;
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "NoDb", stack: "next" });
    const r = await request(app).delete(`/api/devhub/projects/${cr.body.project.id}`);
    expect(r.status).toBe(200);
    expect(r.body.databaseDropped).toBeUndefined();
  });

  test("if the drop fails the project is NOT deleted — no orphan schema left behind", async () => {
    // A port nothing listens on: the real deprovision path fails fast, which
    // is exactly the situation that used to silently orphan a schema.
    process.env.DEVHUB_DB_ADMIN_URL = "postgres://admin:pw@127.0.0.1:1/pool";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "DropFails", stack: "next" });
    const id = cr.body.project.id;
    await request(app).put(`/api/devhub/projects/${id}/env`).send({ key: "DATABASE_URL", value: "postgres://u:p@h/db" });

    const r = await request(app).delete(`/api/devhub/projects/${id}`);
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/could not be dropped/);
    expect(r.body.hint).toMatch(/DELETE \/projects\/:id\/database/);

    // Still there, so the user can retry instead of losing track of the schema.
    const still = await request(app).get(`/api/devhub/projects/${id}`);
    expect(still.status).toBe(200);
    delete process.env.DEVHUB_DB_ADMIN_URL;
  }, 20_000);
});

describe("Railway deploy no longer restarts our own backend", () => {
  test("refuses with 501 by default and says what does work", async () => {
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.RAILWAY_PROJECT_ID = "proj";
    process.env.RAILWAY_SERVICE_ID = "svc";
    delete process.env.DEVHUB_RAILWAY_PER_PROJECT;

    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "DeployMe", stack: "next" });
    const id = cr.body.project.id;

    const r = await request(app).post(`/api/devhub/projects/${id}/deploy`).send({});
    expect(r.status).toBe(501);
    expect(r.body.error).toMatch(/not available yet/i);
    expect(r.body.alternative).toMatch(/Cloudflare Pages/);
    // Nothing was sent to Railway at all — that is the whole point.
    expect(fetchMock).not.toHaveBeenCalled();

    // And the attempt is recorded as failed rather than left "pending".
    const list = await request(app).get(`/api/devhub/projects/${id}/deployments`);
    expect(list.body.deployments[0].status).toBe("failed");
    expect(list.body.deployments[0].buildLog).toMatch(/AEVION platform service/);
  });

  test("capability reports railway as not_available instead of live", async () => {
    process.env.RAILWAY_API_TOKEN = "tok";
    delete process.env.DEVHUB_RAILWAY_PER_PROJECT;
    const app = makeApp();
    const r = await request(app).get("/api/devhub/studio/capabilities");
    const railway = r.body.capabilities.find((c: { id: string }) => c.id === "railway");
    expect(railway.status).toBe("not_available");
  });
});

describe("database quotas", () => {
  test("roles are created with a connection cap so one app cannot starve the rest", async () => {
    const executed: string[] = [];
    const m = await import("../src/lib/devhubDbProvision");
    await m.provisionProjectDatabase({
      projectId: "cccccccc-dddd-eeee-ffff-000000000000",
      adminUrl: "postgres://admin:pw@projects.internal:5432/pool",
      query: async (sql) => { executed.push(sql.trim().split("\n")[0]); return { rows: [] }; },
    });
    expect(executed.join(" | ")).toMatch(/CREATE ROLE u_ccccccccdddd LOGIN PASSWORD '.*' CONNECTION LIMIT 5/);
  });

  test("size is measured, not estimated", async () => {
    const m = await import("../src/lib/devhubDbProvision");
    const r = await m.projectSchemaSizeBytes({
      projectId: "cccccccc-dddd-eeee-ffff-000000000000",
      adminUrl: "postgres://admin:pw@projects.internal:5432/pool",
      query: async (sql, params) => {
        expect(sql).toContain("pg_total_relation_size");
        expect(params).toEqual(["p_ccccccccdddd"]);
        return { rows: [{ bytes: "2097152", tables: 3 }] };
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.bytes).toBe(2097152); expect(r.tables).toBe(3); }
  });

  test("usage endpoint answers honestly for an unprovisioned project", async () => {
    delete process.env.DEVHUB_DB_ADMIN_URL;
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "NoDbYet", stack: "next" });
    const r = await request(app).get(`/api/devhub/projects/${cr.body.project.id}/database`);
    expect(r.status).toBe(200);
    expect(r.body.provisioned).toBe(false);
    expect(r.body.connectionLimit).toBe(5);
  });
});

describe("aevion.build subdomain is only promised when it resolves", () => {
  test("an unresolvable custom domain does not become liveUrl", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_API_TOKEN = "cf";
    process.env.CLOUDFLARE_ZONE_ID = "zone";

    // wrangler upload, CNAME creation, then the domain probe fails (the zone
    // is not delegated) while pages.dev answers.
    vi.doMock("../src/lib/wranglerPagesDeploy", () => ({
      wranglerPagesDeploy: async () => ({ ok: true, url: "https://abc.aevion-x.pages.dev", skipped: []}),
    }));
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, result: {} }), text: async () => "" } as any);

    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "DomainCheck", stack: "static" });
    await request(app).put(`/api/devhub/projects/${cr.body.project.id}/file?path=index.html`).send({ content: "<h1>hi</h1>", language: "html" });

    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/deploy/pages`).send({});
    if (r.status === 200 && r.body.domainUrl) {
      // Whatever the probe decided, liveUrl must never be a domain reported as
      // not ready — that is the promise that was broken for two weeks.
      if (!r.body.domainReady) expect(r.body.liveUrl).toBe(r.body.pagesUrl);
      expect(r.body).toHaveProperty("domainReady");
    }
    vi.doUnmock("../src/lib/wranglerPagesDeploy");
    delete process.env.CLOUDFLARE_ZONE_ID;
  });
});

describe("per-project Railway deploys", () => {
  test("refuses to deploy user services into the platform's own Railway project", async () => {
    const { isSafeDeployTarget } = await import("../src/lib/devhubRailwayDeploy");
    expect(isSafeDeployTarget("proj-users", "proj-platform")).toBe(true);
    expect(isSafeDeployTarget("proj-platform", "proj-platform")).toBe(false); // next to our API and databases
    expect(isSafeDeployTarget(undefined, "proj-platform")).toBe(false);
  });

  test("reads owner/repo out of every URL form we store", async () => {
    const { repoSlugFromUrl } = await import("../src/lib/devhubRailwayDeploy");
    expect(repoSlugFromUrl("https://github.com/acme/widget")).toBe("acme/widget");
    expect(repoSlugFromUrl("https://github.com/acme/widget.git")).toBe("acme/widget");
    expect(repoSlugFromUrl("git@github.com:acme/widget.git")).toBe("acme/widget");
    expect(repoSlugFromUrl(null)).toBeNull();
  });

  test("without a repo it says so instead of creating an empty service", async () => {
    const { deployProjectToRailway } = await import("../src/lib/devhubRailwayDeploy");
    const r = await deployProjectToRailway({
      projectId: "p1", repoUrl: null, envVars: {},
      token: "tok", deployProjectId: "users", environmentId: "env", platformProjectId: "platform",
      gql: async () => { throw new Error("must not be called"); },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/GitHub repo/);
  });

  test("creates the service, pushes the project's env vars, returns a domain", async () => {
    const { deployProjectToRailway } = await import("../src/lib/devhubRailwayDeploy");
    const calls: string[] = [];
    const vars: Record<string, string> = {};
    const r = await deployProjectToRailway({
      projectId: "aaaaaaaa-bbbb", repoUrl: "https://github.com/acme/widget",
      envVars: { DATABASE_URL: "postgres://u:p@h/db", NODE_ENV: "production" },
      token: "tok", deployProjectId: "users", environmentId: "env", platformProjectId: "platform",
      gql: async (q, v: any) => {
        calls.push(q.split("(")[0].trim());
        if (q.includes("serviceCreate")) {
          expect(v.input.source.repo).toBe("acme/widget");
          return { serviceCreate: { id: "svc-1" } };
        }
        if (q.includes("repoTriggers")) return { service: { repoTriggers: { edges: [{ node: { repository: "acme/widget" } }] } } };
        if (q.includes("variableUpsert")) { vars[v.input.name] = v.input.value; return { variableUpsert: true }; }
        if (q.includes("serviceDomainCreate")) return { serviceDomainCreate: { domain: "widget-production.up.railway.app" } };
        return { serviceInstanceRedeploy: true };
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.domain).toBe("widget-production.up.railway.app");
    expect(r.created).toBe(true);
    // The whole point of the rewrite: the app gets its own database URL.
    expect(vars.DATABASE_URL).toBe("postgres://u:p@h/db");
    expect(vars.NODE_ENV).toBe("production");
  });

  test("a redeploy reuses the service instead of billing a new container", async () => {
    const { deployProjectToRailway } = await import("../src/lib/devhubRailwayDeploy");
    let createdCalled = false;
    const r = await deployProjectToRailway({
      projectId: "p1", repoUrl: "https://github.com/acme/widget", envVars: {},
      token: "tok", deployProjectId: "users", environmentId: "env", platformProjectId: "platform",
      existingServiceId: "svc-existing",
      gql: async (q) => {
        if (q.includes("serviceCreate")) { createdCalled = true; return { serviceCreate: { id: "svc-new" } }; }
        if (q.includes("serviceDomainCreate")) return { serviceDomainCreate: { domain: "d.up.railway.app" } };
        return { serviceInstanceRedeploy: true };
      },
    });
    expect(createdCalled).toBe(false);
    expect(r.ok && r.serviceId).toBe("svc-existing");
    expect(r.ok && r.created).toBe(false);
  });

  test("a GraphQL 200-with-errors body is a failure, not a success", async () => {
    const { deployProjectToRailway } = await import("../src/lib/devhubRailwayDeploy");
    const r = await deployProjectToRailway({
      projectId: "p1", repoUrl: "https://github.com/acme/widget", envVars: {},
      token: "tok", deployProjectId: "users", environmentId: "env", platformProjectId: "platform",
      gql: async () => { throw new Error("Not Authorized"); },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Not Authorized/);
  });
});

describe("Railway repo attachment is verified, not assumed", () => {
  test("a service created without the repo actually attached is a failure", async () => {
    const { deployProjectToRailway } = await import("../src/lib/devhubRailwayDeploy");
    // Reproduces what the live API did on 2026-07-26: serviceCreate returned an
    // id, and repoTriggers came back empty — the service would have built
    // nothing while the deploy reported success.
    const r = await deployProjectToRailway({
      projectId: "p1", repoUrl: "https://github.com/acme/widget", envVars: {},
      token: "tok", deployProjectId: "users", environmentId: "env", platformProjectId: "platform",
      gql: async (q) => {
        if (q.includes("serviceCreate")) return { serviceCreate: { id: "svc-1" } };
        if (q.includes("repoTriggers")) return { service: { repoTriggers: { edges: [] } } };
        return {};
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/did not attach/);
      expect(r.error).toMatch(/GitHub App/);
    }
  });
});

describe("Deleting a project takes its Railway service with it", () => {
  // The project delete path already drops the database schema and role, for a
  // stated reason. The service was the same thing with a bill attached: a
  // container built from the user's repo, carrying their env, on a live
  // domain, with nothing left pointing at it once the project row was gone.
  test("the service is deleted, and only after Railway confirms it is in the user-deploy project", async () => {
    const { deleteProjectService } = await import("../src/lib/devhubRailwayDeploy");
    const calls: string[] = [];
    const r = await deleteProjectService({
      serviceId: "svc-user-1",
      token: "tok",
      deployProjectId: "users",
      platformProjectId: "platform",
      platformServiceIds: ["svc-platform"],
      gql: async (q) => {
        calls.push(q.includes("serviceDelete") ? "delete" : "lookup");
        if (q.includes("service(id")) return { service: { projectId: "users" } };
        return { serviceDelete: true };
      },
    });
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["lookup", "delete"]);
  });

  test("refuses to delete the platform's own service", async () => {
    const { deleteProjectService } = await import("../src/lib/devhubRailwayDeploy");
    let deleted = false;
    const r = await deleteProjectService({
      serviceId: "svc-platform",
      token: "tok",
      deployProjectId: "users",
      platformProjectId: "platform",
      platformServiceIds: ["svc-platform"],
      gql: async (q) => { if (q.includes("serviceDelete")) deleted = true; return {}; },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/platform's own/i);
    expect(deleted).toBe(false); // never even asked
  });

  test("refuses a service that lives outside the user-deploy project", async () => {
    const { deleteProjectService } = await import("../src/lib/devhubRailwayDeploy");
    let deleted = false;
    const r = await deleteProjectService({
      serviceId: "svc-elsewhere",
      token: "tok",
      deployProjectId: "users",
      platformProjectId: "platform",
      gql: async (q) => {
        if (q.includes("serviceDelete")) { deleted = true; return {}; }
        return { service: { projectId: "someone-elses-project" } };
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not the user-deploy project/);
    expect(deleted).toBe(false);
  });

  test("a service Railway no longer knows about counts as cleaned up", async () => {
    const { deleteProjectService } = await import("../src/lib/devhubRailwayDeploy");
    const r = await deleteProjectService({
      serviceId: "svc-gone",
      token: "tok",
      deployProjectId: "users",
      platformProjectId: "platform",
      gql: async () => ({ service: null }),
    });
    expect(r.ok).toBe(true);
  });

  test("a failed service delete blocks the project delete instead of orphaning it", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "OrphanGuard", stack: "next" });
    const id = cr.body.project.id;
    await request(app).put(`/api/devhub/projects/${id}/env`).send({ key: "RAILWAY_SERVICE_ID", value: "svc-user-1" });

    const prevToken = process.env.RAILWAY_API_TOKEN;
    const prevFlag = process.env.DEVHUB_RAILWAY_PER_PROJECT;
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.DEVHUB_RAILWAY_PER_PROJECT = "1";
    // No RAILWAY_DEPLOY_PROJECT_ID: the guard refuses, so the delete must fail.
    const del = await request(app).delete(`/api/devhub/projects/${id}`);
    if (prevToken === undefined) delete process.env.RAILWAY_API_TOKEN; else process.env.RAILWAY_API_TOKEN = prevToken;
    if (prevFlag === undefined) delete process.env.DEVHUB_RAILWAY_PER_PROJECT; else process.env.DEVHUB_RAILWAY_PER_PROJECT = prevFlag;

    expect(del.status).toBe(502);
    expect(del.body.serviceId).toBe("svc-user-1");
    // The project must still be there — a deleted row with a live service is
    // exactly the orphan this is meant to prevent.
    const still = await request(app).get(`/api/devhub/projects/${id}`);
    expect(still.status).toBe(200);
  });
});


describe("the domain capability reports what deploys actually observed", () => {
  test("an unresolvable custom domain turns the capability degraded, not live", async () => {
    // "Tokens are set" was the whole basis for calling `domain` live, while
    // the aevion.build zone stayed undelegated and every subdomain failed DNS.
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();

    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_API_TOKEN = "cf";
    process.env.CLOUDFLARE_ZONE_ID = "zone";
    vi.doMock("../src/lib/wranglerPagesDeploy", () => ({
      wranglerPagesDeploy: async () => ({ ok: true, url: "https://abc.aevion-x.pages.dev", skipped: []}),
    }));
    // Cloudflare API calls succeed; the domain probe itself never answers 2xx.
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes(".aevion.build")
        ? { ok: false, status: 522, json: async () => ({}), text: async () => "" }
        : { ok: true, status: 200, json: async () => ({ success: true, result: {} }), text: async () => "" },
    );

    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "DomainHealth", stack: "static" });
    await request(app).put(`/api/devhub/projects/${cr.body.project.id}/file?path=index.html`).send({ content: "<h1>hi</h1>", language: "html" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/deploy/pages`).send({});

    if (r.status === 200 && r.body.domain) {
      expect(r.body.domainReady).toBe(false);
      const health = getProviderHealth("domain");
      expect(health?.ok).toBe(false);
      expect(health?.reason).toMatch(/not delegated|does not resolve/);
    }

    vi.doUnmock("../src/lib/wranglerPagesDeploy");
    delete process.env.CLOUDFLARE_ZONE_ID;
    __resetProviderHealth();
  });
});

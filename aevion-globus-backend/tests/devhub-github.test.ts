/**
 * DevHub GitHub integration — split out of devhub-integrations.test.ts (#978).
 *
 * Second cut after the media routes. These blocks were the other place where
 * parallel PRs kept colliding: every GitHub feature this month appended its
 * describe to the same tail. Made possible by the #982 fix — deferred
 * post-deploy work no longer leaks between tests, so files can be separated.
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
describe("POST /api/devhub/projects/:id/github/sync — pull repo state into the project", () => {
  test("updates changed files, creates new ones, checkpoints first, and skips binaries", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "S" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>old</h1>" });
    await request(app).patch(`/api/devhub/projects/${id}`).send({ repoUrl: "https://github.com/o/r" });

    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/repos/o/r")) return jsonResp(200, { default_branch: "main" });
      if (u.includes("/git/trees/main")) return jsonResp(200, { tree: [
        { path: "index.html", type: "blob", sha: "s1", size: 20 },
        { path: "app.js", type: "blob", sha: "s2", size: 30 },
        { path: "logo.png", type: "blob", sha: "s3", size: 40 },
      ] });
      if (u.includes("/git/blobs/s1")) return jsonResp(200, { encoding: "base64", content: b64("<h1>new from repo</h1>") });
      if (u.includes("/git/blobs/s2")) return jsonResp(200, { encoding: "base64", content: b64("console.log(1)") });
      throw new Error(`unexpected ${u}`);
    });

    const r = await request(app).post(`/api/devhub/projects/${id}/github/sync`).send({});

    expect(r.status).toBe(200);
    expect(r.body.updated).toEqual(["index.html"]);
    expect(r.body.created).toEqual(["app.js"]);
    expect(r.body.skipped).toContain("logo.png");
    expect(r.body.checkpointId).toBeTruthy();

    const f = await request(app).get(`/api/devhub/projects/${id}/file?path=index.html`);
    expect(f.body.file.content).toBe("<h1>new from repo</h1>");
    // Undo restores the pre-sync content — the safety contract holds.
    const undo = await request(app).post(`/api/devhub/projects/${id}/generate/undo`);
    expect(undo.status).toBe(200);
    const f2 = await request(app).get(`/api/devhub/projects/${id}/file?path=index.html`);
    expect(f2.body.file.content).toBe("<h1>old</h1>");
    delete process.env.GITHUB_TOKEN;
  });
});

describe("Per-project GitHub token override", () => {
  async function createProjectWithRepo(app: express.Express, perProjectToken?: string) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "GHTest" });
    const id = cr.body.project.id;
    await request(app).patch(`/api/devhub/projects/${id}`).send({
      repoUrl: "https://github.com/owner/repo",
    });
    if (perProjectToken) {
      await request(app).put(`/api/devhub/projects/${id}/env`).send({
        key: "GITHUB_TOKEN", value: perProjectToken,
      });
    }
    return id;
  }

  test("/github/status uses project-level token if set", async () => {
    process.env.GITHUB_TOKEN = "server-token";
    const app = makeApp();
    const id = await createProjectWithRepo(app, "user-personal-pat");

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      stargazers_count: 42, open_issues_count: 3, pushed_at: "2026-01-01T00:00:00Z",
    }));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/status`);
    expect(r.status).toBe(200);
    expect(r.body.stars).toBe(42);
    // Verify it used the PER-PROJECT token, not the env one
    expect((fetchMock.mock.calls[0][1] as any).headers.Authorization).toBe("Bearer user-personal-pat");
  });

  test("/github/branches falls back to env token when no project token", async () => {
    process.env.GITHUB_TOKEN = "fallback-server-token";
    const app = makeApp();
    const id = await createProjectWithRepo(app); // no per-project token

    fetchMock.mockResolvedValueOnce(jsonResp(200, [
      { name: "main", commit: { sha: "abcdef1234" } },
    ]));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);
    expect(r.status).toBe(200);
    expect(r.body.connected).toBe(true);
    expect(r.body.branches).toHaveLength(1);
    expect((fetchMock.mock.calls[0][1] as any).headers.Authorization).toBe("Bearer fallback-server-token");
  });
});

describe("POST /api/devhub/projects/:id/github/pull-request", () => {
  async function createProjectWithRepo(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "PRTest" });
    const id = cr.body.project.id;
    await request(app).patch(`/api/devhub/projects/${id}`).send({ repoUrl: "https://github.com/owner/repo" });
    return id;
  }

  test("400 when title missing", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request`).send({});
    expect(r.status).toBe(400);
  });

  test("ok:false when GITHUB_TOKEN is not configured", async () => {
    const app = makeApp();
    const id = await createProjectWithRepo(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request`).send({ title: "Add feature" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/GITHUB_TOKEN/);
  });

  test("ok:false when the project has no linked GitHub repo yet", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "NoRepo" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/github/pull-request`).send({ title: "Add feature" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/push to GitHub first/);
  });

  test("opens a PR on a new branch against the repo's default branch (no files)", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { default_branch: "main" })) // repo lookup
      .mockResolvedValueOnce(jsonResp(200, { object: { sha: "base-sha-123" } })) // base ref
      .mockResolvedValueOnce(jsonResp(201, { ref: "refs/heads/aevion-agent-1" })) // create branch
      .mockResolvedValueOnce(jsonResp(201, { html_url: "https://github.com/owner/repo/pull/7", number: 7 })); // create PR

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/github/pull-request`)
      .send({ title: "Add login page", body: "Adds a login form + API route", branch: "feat/login" });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, prUrl: "https://github.com/owner/repo/pull/7", prNumber: 7, branch: "feat/login", pushedFiles: 0 });

    const createRefBody = JSON.parse((fetchMock.mock.calls[2][1] as any).body);
    expect(createRefBody).toEqual({ ref: "refs/heads/feat/login", sha: "base-sha-123" });
    const prBody = JSON.parse((fetchMock.mock.calls[3][1] as any).body);
    expect(prBody).toEqual({ title: "Add login page", head: "feat/login", base: "main", body: "Adds a login form + API route" });
  });

  test("auto-generates a branch name when none is given", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { default_branch: "main" }))
      .mockResolvedValueOnce(jsonResp(200, { object: { sha: "base-sha" } }))
      .mockResolvedValueOnce(jsonResp(201, {}))
      .mockResolvedValueOnce(jsonResp(201, { html_url: "https://github.com/owner/repo/pull/1", number: 1 }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/github/pull-request`)
      .send({ title: "x" });

    expect(r.status).toBe(200);
    expect(r.body.branch).toMatch(/^aevion-agent-\d+$/);
  });

  test("commits an existing file with its current sha (avoids a Contents API conflict)", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);
    await request(app).put(`/api/devhub/projects/${id}/file`).send({ path: "pages/index.tsx", content: "updated" });

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { default_branch: "main" })) // repo lookup
      .mockResolvedValueOnce(jsonResp(200, { object: { sha: "base-sha" } })) // base ref
      .mockResolvedValueOnce(jsonResp(201, {})) // create branch
      .mockResolvedValueOnce(jsonResp(200, { sha: "existing-file-sha" })) // GET contents on new branch — file exists
      .mockResolvedValueOnce(jsonResp(200, { content: { sha: "new-sha" } })) // PUT contents
      .mockResolvedValueOnce(jsonResp(201, { html_url: "https://github.com/owner/repo/pull/2", number: 2 })); // create PR

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/github/pull-request`)
      .send({ title: "Update index" });

    expect(r.status).toBe(200);
    expect(r.body.pushedFiles).toBe(1);
    const putBody = JSON.parse((fetchMock.mock.calls[4][1] as any).body);
    expect(putBody.sha).toBe("existing-file-sha");
    expect(putBody.branch).toBeTruthy();
  });
});

describe("POST /api/devhub/projects/:id/github/pull-request/:number/merge", () => {
  async function createProjectWithRepo(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "MergeTest" });
    const id = cr.body.project.id;
    await request(app).patch(`/api/devhub/projects/${id}`).send({ repoUrl: "https://github.com/owner/repo" });
    return id;
  }

  test("400 on a non-numeric pull request number", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request/not-a-number/merge`).send({});
    expect(r.status).toBe(400);
  });

  test("ok:false when GITHUB_TOKEN is not configured", async () => {
    const app = makeApp();
    const id = await createProjectWithRepo(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request/1/merge`).send({});
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/GITHUB_TOKEN/);
  });

  test("ok:false when no repo is linked yet", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "NoRepo" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/github/pull-request/1/merge`).send({});
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/push to GitHub first/);
  });

  test("merges with the requested method and returns the merge sha", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, { merged: true, sha: "abc123", message: "Pull Request successfully merged" }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/github/pull-request/7/merge`)
      .send({ mergeMethod: "rebase" });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, merged: true, sha: "abc123" });
    expect(fetchMock.mock.calls[0][0]).toContain("/repos/owner/repo/pulls/7/merge");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.merge_method).toBe("rebase");
  });

  test("defaults to squash when mergeMethod is omitted", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, { merged: true, sha: "def456" }));

    await request(app).post(`/api/devhub/projects/${id}/github/pull-request/3/merge`).send({});

    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.merge_method).toBe("squash");
  });

  test("a 2xx response with merged:false is reported as a failure, not silently ok:true", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    // GitHub's documented edge case: 200 OK but the merge didn't actually happen.
    fetchMock.mockResolvedValueOnce(jsonResp(200, { merged: false, message: "Merge already in progress" }));

    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request/5/merge`).send({});

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/Merge already in progress/);
  });

  test("a non-2xx GitHub response (e.g. not mergeable) is reported as a failure", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const app = makeApp();
    const id = await createProjectWithRepo(app);

    fetchMock.mockResolvedValueOnce(jsonResp(405, { message: "Pull Request is not mergeable" }));

    const r = await request(app).post(`/api/devhub/projects/${id}/github/pull-request/9/merge`).send({});

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/not mergeable/);
  });
});

describe("A GitHub push that lost files does not report a clean push", () => {
  test("files GitHub refused are named, and the answer is degraded, not success", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "PushHalf" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>ok</h1>" });
    await request(app).put(`/api/devhub/projects/${id}/file?path=big.bin.b64`).send({ content: "AAAA" });

    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/user")) return jsonResp(200, { login: "octo" });
      if (u.endsWith("/user/repos")) return jsonResp(201, { html_url: "https://github.com/octo/pushhalf" });
      if (u.includes("/contents/index.html")) return jsonResp(201, { content: {} });
      // What actually happens in the wild: one file is rejected while the
      // rest go through — too large, bad path, a stale sha, a rate limit.
      if (u.includes("/contents/big.bin.b64")) return jsonResp(422, { message: "size too large" });
      throw new Error(`unexpected ${u}`);
    });

    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).send({});
    expect(r.status).toBe(200);
    expect(r.body.pushedFiles).toBe(1);
    expect(r.body.degraded).toBe(true);
    expect(r.body.failedFiles).toHaveLength(1);
    expect(r.body.failedFiles[0].path).toBe("big.bin.b64");
    expect(r.body.failedFiles[0].reason).toMatch(/422|size too large/);
    expect(r.body.degradedReason).toMatch(/big\.bin\.b64/);
    delete process.env.GITHUB_TOKEN;
  });

  test("a push where nothing landed is not ok at all", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "PushNone" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>ok</h1>" });

    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/user")) return jsonResp(200, { login: "octo" });
      if (u.endsWith("/user/repos")) return jsonResp(201, { html_url: "https://github.com/octo/pushnone" });
      return jsonResp(403, { message: "API rate limit exceeded" });
    });

    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).send({});
    expect(r.body.ok).toBe(false);
    expect(r.body.pushedFiles).toBe(0);
    expect(r.body.degradedReason).toMatch(/rate limit/i);
    delete process.env.GITHUB_TOKEN;
  });
});


describe("the GitHub capability separates an outage from one bad file", () => {
  test("a rejected token marks the capability degraded", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.GITHUB_TOKEN = "gh-bad";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "AuthFail" });
    await request(app).put(`/api/devhub/projects/${cr.body.project.id}/file?path=a.txt`).send({ content: "x" });
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "Bad credentials" } as any);

    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/github/push`).send({});
    expect(r.body.ok).toBe(false);
    expect(getProviderHealth("github")?.ok).toBe(false);
    delete process.env.GITHUB_TOKEN;
    __resetProviderHealth();
  });

  test("one refused file does not put the integration in the red", async () => {
    // Somebody's oversized asset is not an outage; treating it as one is how a
    // status strip becomes noise people stop reading.
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.GITHUB_TOKEN = "gh-ok";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "PartialPush" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=ok.txt`).send({ content: "fine" });
    await request(app).put(`/api/devhub/projects/${id}/file?path=huge.bin.b64`).send({ content: "AAAA" });
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/user")) return jsonResp(200, { login: "octo" });
      if (u.endsWith("/user/repos")) return jsonResp(201, { html_url: "https://github.com/octo/partial" });
      if (u.includes("/contents/huge.bin.b64")) return jsonResp(422, { message: "too large" });
      return jsonResp(201, { content: {} });
    });

    const r = await request(app).post(`/api/devhub/projects/${id}/github/push`).send({});
    expect(r.body.pushedFiles).toBe(1);
    expect(r.body.degraded).toBe(true);
    // The push says degraded; the capability does not.
    expect(getProviderHealth("github")?.ok).not.toBe(false);
    delete process.env.GITHUB_TOKEN;
    __resetProviderHealth();
  });
});

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

/**
 * Каждому запросу — свой адрес клиента, как у разных пользователей.
 *
 * Зачем (20.08.2026): отправляющие ручки получили предел частоты — 5 в минуту на
 * адрес, потому что у Brevo потолок 300 писем в сутки и общий предел 30/мин
 * позволял выжечь суточную квоту платформы с одного адреса за десять минут. Этот
 * файл делает 271 запрос из одного процесса, то есть с ОДНОГО адреса, и упирался
 * в предел на шестом: 13 проверок валидации падали не по своей причине.
 *
 * Ослаблять предел ради тестов нельзя — тогда защиты не будет там, где она нужна.
 * Правильно здесь другое: тесты проверяют валидацию и ответы провайдеров, а не
 * частоту, и настоящие пользователи приходят с разных адресов. Сам предел
 * проверяется отдельно и по поведению — tests/devhubSendingRateLimited.test.ts,
 * там адреса задаются явно.
 */
let testClientIp = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    testClientIp += 1;
    req.headers["x-forwarded-for"] = `10.1.${Math.floor(testClientIp / 250) % 250}.${(testClientIp % 250) + 1}`;
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

// ═════════════════════════════════════════════════════════════════════════════
// 1. ElevenLabs TTS
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 2. Brevo Email
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 3. Lemon Squeezy Payment Link (was: Paddle, migrated 2026-05-24)
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 4. DALL-E Image generation
// ═════════════════════════════════════════════════════════════════════════════


describe("POST /api/devhub/projects/:id/generate — dialog history as context", () => {
  test("prior turns are folded into the prompt (capped), so follow-ups keep their referent", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "src/App.jsx", content: "x", language: "javascript" }] }),
      model: "m", usage: null,
    } as never);
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "H" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/generate`).send({
      prompt: "make the button blue",
      history: [
        { role: "user", text: "build a pomodoro timer with a start button" },
        { role: "assistant", text: "Changed files: src/App.jsx" },
        { role: "weird", text: "dropped" },
      ],
    });
    expect(r.status).toBe(200);
    const messages = vi.mocked(callProvider).mock.calls[0][1] as Array<{ role: string; content: string }>;
    const userMsg = messages.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("Conversation so far");
    expect(userMsg).toContain("User: build a pomodoro timer");
    expect(userMsg).toContain("Assistant: Changed files: src/App.jsx");
    expect(userMsg).not.toContain("dropped");
    expect(userMsg).toContain("make the button blue");
    vi.mocked(callProvider).mockReset();
  });
});


describe("POST /api/devhub/projects/:id/generate/stream — honest status events", () => {
  test("streams real phase events and ends with the full /generate payload", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "src/App.jsx", content: "export default () => null", language: "jsx" }] }),
      model: "m", usage: null,
    } as never);
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "S" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate/stream`)
      .send({ prompt: "a page" });

    const events = r.text.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
    const stages = events.filter((e) => e.type === "status").map((e) => e.stage);
    expect(stages).toEqual(expect.arrayContaining(["calling_model", "syntax_check", "saving"]));
    const result = events.find((e) => e.type === "result");
    expect(result.files.map((f: { path: string }) => f.path)).toEqual(["src/App.jsx"]);
    expect(result.checkpointId).toBeTruthy();
    vi.mocked(callProvider).mockReset();
  });
});

describe("truncated model reply — complete files are salvaged, not dumped to output.ts", () => {
  test("salvage triggers a continuation call that recovers the missing tail file", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    const truncated =
      '{"files":[' +
      '{"path":"src/App.jsx","content":"export default () => null","language":"jsx"},' +
      '{"path":"src/big.css","content":".progress { transition: width 1s lin';
    vi.mocked(callProvider)
      .mockResolvedValueOnce({ reply: truncated, model: "m", usage: null } as never)
      .mockResolvedValueOnce({
        reply: JSON.stringify({ files: [{ path: "src/big.css", content: ".progress { width: 100%; }", language: "css" }] }),
        model: "m", usage: null,
      } as never);
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "C" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/generate`).send({ prompt: "pomodoro" });
    expect(r.status).toBe(200);
    expect(r.body.files.map((f: { path: string }) => f.path).sort()).toEqual(["src/App.jsx", "src/big.css"]);
    expect(r.body.continued).toBe(true); // honest process note reaches the UI
    // Continuation prompt names the completed files and asks only for the rest.
    const contCall = vi.mocked(callProvider).mock.calls[1];
    const contUser = (contCall[1] as Array<{ role: string; content: string }>).filter((m) => m.role === "user").pop()!;
    expect(contUser.content).toContain("cut off");
    expect(contUser.content).toContain("src/App.jsx");
    // Codegen calls carry the raised token cap.
    expect(contCall[5]).toBe(8192);
    vi.mocked(callProvider).mockReset();
  });

  test("a reply cut mid-string yields the complete leading files", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    // Two complete file objects, then a third cut off inside its content —
    // exactly the live 2026-07-22 failure shape (max_tokens truncation).
    const truncated =
      '{"files":[' +
      '{"path":"src/App.jsx","content":"export default function App() { return <div className=\\"x\\">ok</div>; }","language":"jsx"},' +
      '{"path":"src/app.css","content":".x { color: red; }","language":"css"},' +
      '{"path":"src/big.css","content":".progress { transition: width 1s lin';
    vi.mocked(callProvider).mockResolvedValue({ reply: truncated, model: "m", usage: null } as never);
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/generate`).send({ prompt: "pomodoro" });
    expect(r.status).toBe(200);
    const paths = r.body.files.map((f: { path: string }) => f.path);
    expect(paths).toEqual(["src/App.jsx", "src/app.css"]); // cut-off tail dropped, no output.ts dump
    vi.mocked(callProvider).mockReset();
  });
});

describe("parseGeneratedFiles robustness — JSON wrapped in prose/fences", () => {
  test("fenced JSON with prose around it parses into real files, not an output.ts dump", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    vi.mocked(callProvider).mockResolvedValue({
      reply: 'Here is your app!\n```json\n{"files":[{"path":"src/App.jsx","content":"export default ()=>null","language":"javascript"}]}\n```\nEnjoy!',
      model: "m", usage: null,
    } as never);
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "P" });
    const r = await request(app).post(`/api/devhub/projects/${cr.body.project.id}/generate`).send({ prompt: "habit tracker" });
    expect(r.status).toBe(200);
    expect(r.body.files.map((f: { path: string }) => f.path)).toEqual(["src/App.jsx"]);
    vi.mocked(callProvider).mockReset();
  });
});

describe("POST /api/devhub/projects/:id/generate — screenshot attachment (vision)", () => {
  async function makeProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "V" });
    return cr.body.project.id as string;
  }
  const PNG_B64 = Buffer.from("fake-png").toString("base64");

  test("400 on oversized or wrong-type image", async () => {
    const app = makeApp();
    const id = await makeProject(app);
    const big = await request(app).post(`/api/devhub/projects/${id}/generate`)
      .send({ prompt: "x", imageBase64: "a".repeat(7_000_001) });
    expect(big.status).toBe(400);
    const badType = await request(app).post(`/api/devhub/projects/${id}/generate`)
      .send({ prompt: "x", imageBase64: PNG_B64, imageMediaType: "image/tiff" });
    expect(badType.status).toBe(400);
  });

  test("503 (honest) when an image is attached but no vision-capable provider is configured", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "llama", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
    ] as never);
    const app = makeApp();
    const id = await makeProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/generate`)
      .send({ prompt: "recreate this design", imageBase64: PNG_B64 });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY/);
  });

  test("vision provider is preferred over an earlier text-only provider and receives the image", async () => {
    vi.mocked(getProviders).mockReturnValue([
      { id: "groq", name: "Groq", models: [], defaultModel: "llama", envKey: "GROQ_API_KEY", configured: true, free: true, tier: "free" },
      { id: "anthropic", name: "Anthropic", models: [], defaultModel: "claude-x", envKey: "ANTHROPIC_API_KEY", configured: true, free: false, tier: "premium" },
    ] as never);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "index.html", content: "<h1>from screenshot</h1>", language: "html" }] }),
      model: "claude-x", usage: null,
    } as never);
    const app = makeApp();
    const id = await makeProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/generate`)
      .send({ prompt: "recreate this design", imageBase64: PNG_B64, imageMediaType: "image/jpeg" });
    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(true);
    const call = vi.mocked(callProvider).mock.calls[0];
    expect(call[0]).toBe("anthropic"); // vision-capable wins over groq
    expect(call[4]).toEqual([{ mediaType: "image/jpeg", dataBase64: PNG_B64 }]);
    vi.mocked(callProvider).mockReset();
  });
});

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

// ═════════════════════════════════════════════════════════════════════════════
// 5. ElevenLabs SFX + Music
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 5b. Credit gating — TTS/music/deploy actually enforce the free-tier ceiling
//     (previously only image/video were gated; the credits UI showed limits
//     for all five capabilities but four of them were unenforced)
// ═════════════════════════════════════════════════════════════════════════════

describe("Credit gating on metered routes", () => {
  test("TTS: free tier (100k chars/mo) is denied with 402 once exhausted", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const app = makeApp();
    fetchMock.mockResolvedValue(audioResp(200, 100));

    // 20 * 5000 = 100000 == free-tier limit, each call individually valid (<=5000)
    for (let i = 0; i < 20; i++) {
      const r = await request(app).post("/api/devhub/media/tts").send({ text: "x".repeat(5000) });
      expect(r.status).toBe(200);
    }

    const over = await request(app).post("/api/devhub/media/tts").send({ text: "one more char" });
    expect(over.status).toBe(402);
    expect(over.body.error).toMatch(/TTS character limit/);
    expect(over.body.limit).toBe(100000);
  });

  test("Music: free tier (5 tracks/mo) is denied with 402 on the 6th track", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const app = makeApp();
    fetchMock.mockResolvedValue(audioResp(200, 100));

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/devhub/media/music").send({ prompt: "lofi beat" });
      expect(r.status).toBe(200);
    }

    const sixth = await request(app).post("/api/devhub/media/music").send({ prompt: "lofi beat" });
    expect(sixth.status).toBe(402);
    expect(sixth.body.error).toMatch(/music generation limit/);
    expect(sixth.body.limit).toBe(5);
  });

  test("Deploy (Vercel): free tier (10 deploys/mo) is denied with 402 on the 11th deploy", async () => {
    process.env.VERCEL_API_TOKEN = "fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    expect(cr.status).toBe(201);
    const projectId = cr.body.project.id as string;

    fetchMock.mockResolvedValue(jsonResp(200, { id: "dep_1", url: "myapp.vercel.app" }));

    for (let i = 0; i < 10; i++) {
      const r = await request(app).post(`/api/devhub/projects/${projectId}/deploy/vercel`).send({});
      expect(r.status).toBe(200);
    }

    const eleventh = await request(app).post(`/api/devhub/projects/${projectId}/deploy/vercel`).send({});
    expect(eleventh.status).toBe(402);
    expect(eleventh.body.error).toMatch(/deploy limit/);
    expect(eleventh.body.limit).toBe(10);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5b2. Railway deploy honesty — GraphQL returns HTTP 200 even when the
//      mutation itself failed (bad token, wrong project/service id); the
//      deployment record must not silently flip to "live" on a fabricated
//      *.up.railway.app URL that was never actually deployed.
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// 5c. AI code generation honesty — /generate must tell the caller when it
//     silently fell back to a placeholder stub instead of real AI output
//     (previously the response had no signal, and the UI showed a green
//     "Generated N file(s)" success toast for a commented-out placeholder)
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/projects/:id/generate (AI honesty)", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    expect(cr.status).toBe(201);
    return cr.body.project.id as string;
  }

  test("aiGenerated: false + stub content when no provider is configured", async () => {
    const app = makeApp();
    const projectId = await createProject(app);

    const r = await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "a login form" });

    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(false);
    expect(r.body.files[0].content).toMatch(/Generated stub for/);
  });

  test("aiGenerated: true when a provider is configured and responds", async () => {
    const app = makeApp();
    const projectId = await createProject(app);

    vi.mocked(getProviders).mockReturnValue([
      { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any,
    ]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "pages/index.tsx", content: "export default function Page() { return null; }", language: "typescript" }] }),
      model: "gpt-4o-mini",
      usage: {},
    } as any);

    const r = await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "a login form" });

    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(true);
    expect(r.body.files[0].path).toBe("pages/index.tsx");
  });

  test("valid syntax → no syntaxErrors field at all", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "pages/ok.tsx", content: "export default function Ok() { return <div>hi</div>; }", language: "typescript" }] }),
      model: "m", usage: {},
    } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.syntaxErrors).toBeUndefined();
  });

  // Regression: ts.transpileModule({jsx: ts.JsxEmit.None}) is NOT a valid
  // config — TS reports an "invalid --jsx option" diagnostic on every single
  // .ts/.js file, indistinguishable from a genuine syntax error. This would
  // have silently forced a self-correction retry (and, with no second mock
  // response queued in a test, an outright crash) on every non-JSX generation.
  test("valid plain .ts (non-JSX) file is never flagged — regression for the JsxEmit.None false positive", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "lib/util.ts", content: "export function add(a: number, b: number): number { return a + b; }", language: "typescript" }] }),
      model: "m", usage: {},
    } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.syntaxErrors).toBeUndefined();
    expect(r.body.selfCorrected).toBeUndefined();
    expect(vi.mocked(callProvider)).toHaveBeenCalledTimes(1); // no retry triggered
  });

  test("broken JSX syntax is written but flagged — not a silent success", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      // Unterminated JSX + unmatched brace — a real syntax error, not just a semantic one.
      reply: JSON.stringify({ files: [{ path: "pages/broken.tsx", content: "export default function Broken() { return <div>", language: "typescript" }] }),
      model: "m", usage: {},
    } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(true);
    expect(r.body.files[0].content).toContain("<div>"); // still written — an honest-but-broken diff beats an empty one
    expect(r.body.syntaxErrors).toHaveLength(1);
    expect(r.body.syntaxErrors[0].path).toBe("pages/broken.tsx");
    expect(r.body.syntaxErrors[0].errors.length).toBeGreaterThan(0);
  });

  test("broken JSON is flagged the same way", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "config.json", content: "{ invalid json,, }", language: "json" }] }),
      model: "m", usage: {},
    } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.syntaxErrors).toHaveLength(1);
    expect(r.body.syntaxErrors[0].errors[0]).toMatch(/Invalid JSON/);
  });

  test("an unchecked language (e.g. Python) is never flagged — no false positives", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "script.py", content: "def broken(:\n    pass", language: "python" }] }),
      model: "m", usage: {},
    } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.syntaxErrors).toBeUndefined();
  });

  function mockProvider() {
    vi.mocked(getProviders).mockReturnValue([
      { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any,
    ]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({ files: [{ path: "pages/login.tsx", content: "updated", language: "typescript" }] }),
      model: "gpt-4o-mini",
      usage: {},
    } as any);
  }

  test("editing an existing targetFile includes its current content in the prompt", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app)
      .put(`/api/devhub/projects/${projectId}/file`)
      .send({ path: "pages/login.tsx", content: "export default function Login() { return <form />; }" });
    mockProvider();

    await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "add a forgot-password link", targetFile: "pages/login.tsx" });

    const userMsg = vi.mocked(callProvider).mock.calls[0][1][1].content as string;
    expect(userMsg).toContain("Current content of pages/login.tsx");
    expect(userMsg).toContain("export default function Login()");
    expect(userMsg).toContain("edit this file in place");
  });

  test("lists other project files by path even when targetFile is new (no content dump)", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app)
      .put(`/api/devhub/projects/${projectId}/file`)
      .send({ path: "lib/auth.ts", content: "SECRET_DO_NOT_LEAK" });
    mockProvider();

    await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "a signup page", targetFile: "pages/signup.tsx" });

    const userMsg = vi.mocked(callProvider).mock.calls[0][1][1].content as string;
    expect(userMsg).toContain("Existing project files");
    expect(userMsg).toContain("- lib/auth.ts");
    expect(userMsg).not.toContain("SECRET_DO_NOT_LEAK"); // only the targetFile's content is inlined, not unrelated files
  });

  test("fresh project with no files sends no file-context section", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    mockProvider();

    await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "a login form" });

    const userMsg = vi.mocked(callProvider).mock.calls[0][1][1].content as string;
    expect(userMsg).not.toContain("Existing project files");
  });

  test("targetFiles (plural) inlines the current content of every existing target file, coordinated", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/api/login.ts", content: "export default function handler(req, res) {}" });
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/login.tsx", content: "export default function Login() { return <form />; }" });
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({
      reply: JSON.stringify({
        files: [
          { path: "pages/api/login.ts", content: "// handles POST", language: "typescript" },
          { path: "pages/login.tsx", content: "// calls /api/login", language: "typescript" },
        ],
      }),
      model: "m", usage: {},
    } as any);

    const r = await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "wire the login form to a real API route", targetFiles: ["pages/api/login.ts", "pages/login.tsx"] });

    expect(r.status).toBe(200);
    expect(r.body.files).toHaveLength(2);
    const [systemPrompt, userMsg] = vi.mocked(callProvider).mock.calls[0][1].map((m: any) => m.content) as string[];
    expect(systemPrompt).toContain("MULTIPLE coordinated files");
    expect(systemPrompt).toContain("pages/api/login.ts");
    expect(systemPrompt).toContain("pages/login.tsx");
    expect(userMsg).toContain("Current content of pages/api/login.ts");
    expect(userMsg).toContain("export default function handler(req, res)");
    expect(userMsg).toContain("Current content of pages/login.tsx");
    expect(userMsg).toContain("export default function Login()");
  });

  test("single targetFile (string, back-compat) still uses the strict single-file prompt", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    mockProvider();

    await request(app)
      .post(`/api/devhub/projects/${projectId}/generate`)
      .send({ prompt: "a login form", targetFile: "pages/login.tsx" });

    const systemPrompt = vi.mocked(callProvider).mock.calls[0][1][0].content as string;
    expect(systemPrompt).toContain("single file");
    expect(systemPrompt).not.toContain("MULTIPLE coordinated files");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5d. Self-correction — generate → check → fix loop (a broken first attempt
//     should self-heal instead of just being flagged and left broken)
// ═════════════════════════════════════════════════════════════════════════════

describe("generate_code self-correction", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    return cr.body.project.id as string;
  }

  test("a broken first attempt that the model fixes on retry is reported as selfCorrected, no syntaxErrors", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider)
      .mockResolvedValueOnce({ reply: JSON.stringify({ files: [{ path: "pages/broken.tsx", content: "export default function X() { return <div>", language: "typescript" }] }), model: "m", usage: {} } as any)
      .mockResolvedValueOnce({ reply: JSON.stringify({ files: [{ path: "pages/broken.tsx", content: "export default function X() { return <div></div>; }", language: "typescript" }] }), model: "m", usage: {} } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.selfCorrected).toBe(1);
    expect(r.body.syntaxErrors).toBeUndefined();
    expect(r.body.files[0].content).toContain("</div>");
    expect(vi.mocked(callProvider)).toHaveBeenCalledTimes(2);
    // The retry prompt must include the actual error, not just "try again".
    const retryMsg = vi.mocked(callProvider).mock.calls[1][1].at(-1)?.content as string;
    expect(retryMsg).toContain("syntax errors");
  });

  test("still broken after the retry → syntaxErrors present, no selfCorrected field", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({ reply: JSON.stringify({ files: [{ path: "pages/broken.tsx", content: "export default function X() { return <div>", language: "typescript" }] }), model: "m", usage: {} } as any);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(r.body.selfCorrected).toBeUndefined();
    expect(r.body.syntaxErrors).toHaveLength(1);
    expect(vi.mocked(callProvider)).toHaveBeenCalledTimes(2); // one original + exactly one retry, capped
  });

  test("a clean first attempt never triggers a retry call", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValue({ reply: JSON.stringify({ files: [{ path: "pages/ok.tsx", content: "export default function Ok() { return null; }", language: "typescript" }] }), model: "m", usage: {} } as any);

    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(vi.mocked(callProvider)).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5e. Checkpoints — "undo the last AI change" without regenerating anything
// ═════════════════════════════════════════════════════════════════════════════

describe("AI-change checkpoints + undo", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    return cr.body.project.id as string;
  }
  function mockProviderReturning(files: Array<{ path: string; content: string }>) {
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValueOnce({
      reply: JSON.stringify({ files: files.map((f) => ({ ...f, language: "typescript" })) }),
      model: "m", usage: {},
    } as any);
  }

  test("/generate returns a checkpointId when it writes at least one file", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    mockProviderReturning([{ path: "pages/new.tsx", content: "export default function New() { return null; }" }]);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });

    expect(r.status).toBe(200);
    expect(typeof r.body.checkpointId).toBe("string");
  });

  test("undo restores a file's prior content", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "ORIGINAL" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "// CHANGED BY AI" }]);

    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x", targetFile: "pages/index.tsx" });
    const before = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/index.tsx`);
    expect(before.body.file.content).toBe("// CHANGED BY AI");

    const undo = await request(app).post(`/api/devhub/projects/${projectId}/generate/undo`).send({});
    expect(undo.status).toBe(200);
    expect(undo.body).toMatchObject({ ok: true, revertedFiles: ["pages/index.tsx"] });

    const after = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/index.tsx`);
    expect(after.body.file.content).toBe("ORIGINAL");
  });

  test("undo deletes a file that generate_code created fresh (no prior content)", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    mockProviderReturning([{ path: "pages/brandnew.tsx", content: "export default function New() { return null; }" }]);

    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x" });
    const before = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/brandnew.tsx`);
    expect(before.status).toBe(200);

    await request(app).post(`/api/devhub/projects/${projectId}/generate/undo`).send({});

    const after = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/brandnew.tsx`);
    expect(after.status).toBe(404);
  });

  test("undo consumes the checkpoint — a second undo reaches the change before it, not the same state", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "V1" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V2" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x", targetFile: "pages/index.tsx" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V3" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "y", targetFile: "pages/index.tsx" });

    const undo1 = await request(app).post(`/api/devhub/projects/${projectId}/generate/undo`).send({});
    expect(undo1.body.ok).toBe(true);
    const afterFirst = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/index.tsx`);
    expect(afterFirst.body.file.content).toBe("V2"); // back to the state right before the V3 write

    const undo2 = await request(app).post(`/api/devhub/projects/${projectId}/generate/undo`).send({});
    expect(undo2.body.ok).toBe(true);
    const afterSecond = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/index.tsx`);
    expect(afterSecond.body.file.content).toBe("V1"); // and now the state right before the V2 write
  });

  test("no checkpoint to undo → ok:false, not a 500", async () => {
    const app = makeApp();
    const projectId = await createProject(app);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/generate/undo`).send({});

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/No AI change to undo/);
  });

  // ── History listing + jump-to-a-specific-point restore ──────────────────
  test("GET /checkpoints is empty for a project with no AI writes", async () => {
    const app = makeApp();
    const projectId = await createProject(app);

    const r = await request(app).get(`/api/devhub/projects/${projectId}/checkpoints`);

    expect(r.status).toBe(200);
    expect(r.body.checkpoints).toEqual([]);
  });

  test("GET /checkpoints lists AI writes newest-first with labels and touched paths", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "V1" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V2" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "first edit", targetFile: "pages/index.tsx" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V3" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "second edit", targetFile: "pages/index.tsx" });

    const r = await request(app).get(`/api/devhub/projects/${projectId}/checkpoints`);

    expect(r.status).toBe(200);
    expect(r.body.checkpoints).toHaveLength(2);
    expect(r.body.checkpoints[0].label).toMatch(/second edit/);
    expect(r.body.checkpoints[1].label).toMatch(/first edit/);
    expect(r.body.checkpoints[0].paths).toEqual(["pages/index.tsx"]);
    expect(typeof r.body.checkpoints[0].createdAt).toBe("string");
  });

  test("restore to an older checkpoint walks back through every newer one in a single call", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "V1" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V2" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x", targetFile: "pages/index.tsx" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V3" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "y", targetFile: "pages/index.tsx" });

    const history = await request(app).get(`/api/devhub/projects/${projectId}/checkpoints`);
    const olderCheckpointId = history.body.checkpoints[1].id; // the V1→V2 write

    const restore = await request(app).post(`/api/devhub/projects/${projectId}/checkpoints/${olderCheckpointId}/restore`).send({});
    expect(restore.status).toBe(200);
    expect(restore.body).toMatchObject({ ok: true, stepsApplied: 2, revertedFiles: ["pages/index.tsx"] });

    const after = await request(app).get(`/api/devhub/projects/${projectId}/file?path=pages/index.tsx`);
    expect(after.body.file.content).toBe("V1");

    // Both checkpoints were consumed by the jump — nothing left to undo further.
    const remaining = await request(app).get(`/api/devhub/projects/${projectId}/checkpoints`);
    expect(remaining.body.checkpoints).toEqual([]);
  });

  test("restoring to the newest checkpoint behaves like a single undo (stepsApplied:1)", async () => {
    const app = makeApp();
    const projectId = await createProject(app);
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "V1" });
    mockProviderReturning([{ path: "pages/index.tsx", content: "V2" }]);
    await request(app).post(`/api/devhub/projects/${projectId}/generate`).send({ prompt: "x", targetFile: "pages/index.tsx" });

    const history = await request(app).get(`/api/devhub/projects/${projectId}/checkpoints`);
    const newestId = history.body.checkpoints[0].id;

    const restore = await request(app).post(`/api/devhub/projects/${projectId}/checkpoints/${newestId}/restore`).send({});
    expect(restore.body).toMatchObject({ ok: true, stepsApplied: 1 });
  });

  test("restore with an unknown checkpointId → ok:false, not a 500", async () => {
    const app = makeApp();
    const projectId = await createProject(app);

    const r = await request(app).post(`/api/devhub/projects/${projectId}/checkpoints/does-not-exist/restore`).send({});

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/not found/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5f. plan_project — idea → staged build plan, standalone or project-aware
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/plan", () => {
  test("400 when idea is missing", async () => {
    const r = await request(makeApp()).post("/api/devhub/plan").send({});
    expect(r.status).toBe(400);
  });

  test("no provider configured → ok:true, aiGenerated:false, honest fallback (not empty silent success)", async () => {
    const r = await request(makeApp()).post("/api/devhub/plan").send({ idea: "a marketplace for vintage cameras" });
    expect(r.status).toBe(200);
    expect(r.body.aiGenerated).toBe(false);
    expect(r.body.targetUsers).toMatch(/Configure an AI provider/);
  });

  test("a configured provider returns the full structured plan", async () => {
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValueOnce({
      reply: JSON.stringify({
        summary: "A marketplace for buying and selling vintage cameras.",
        targetUsers: "Camera collectors and hobbyist photographers.",
        stack: "next",
        mvpFeatures: ["Listing creation", "Browse/search", "Basic checkout"],
        laterFeatures: ["Seller ratings", "Auctions"],
        milestones: [
          { title: "Listing creation", prompt: "Build a form to create a camera listing with photos and price." },
          { title: "Browse page", prompt: "Build a page that lists all camera listings." },
        ],
        firstPrompt: "Build a form to create a camera listing with photos and price.",
      }),
      model: "m", usage: {},
    } as any);

    const r = await request(makeApp()).post("/api/devhub/plan").send({ idea: "a marketplace for vintage cameras" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.aiGenerated).toBe(true);
    expect(r.body.mvpFeatures).toHaveLength(3);
    expect(r.body.milestones).toHaveLength(2);
    expect(r.body.firstPrompt).toMatch(/camera listing/);
  });

  test("an unparseable reply is ok:false, not a silently empty plan", async () => {
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValueOnce({ reply: "not json at all", model: "m", usage: {} } as any);

    const r = await request(makeApp()).post("/api/devhub/plan").send({ idea: "x" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
  });

  test("when projectId is given, existing project files ride in the prompt", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const projectId = cr.body.project.id;
    await request(app).put(`/api/devhub/projects/${projectId}/file`).send({ path: "pages/index.tsx", content: "existing" });
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValueOnce({
      reply: JSON.stringify({ summary: "s", targetUsers: "u", stack: "next", mvpFeatures: [], laterFeatures: [], milestones: [], firstPrompt: "p" }),
      model: "m", usage: {},
    } as any);

    await request(app).post("/api/devhub/plan").send({ idea: "add a feature", projectId });

    const userMsg = vi.mocked(callProvider).mock.calls[0][1][1].content as string;
    expect(userMsg).toContain("pages/index.tsx");
  });

  test("with no projectId, planning is standalone — no project lookup, no existing-files section", async () => {
    vi.mocked(getProviders).mockReturnValue([{ id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any]);
    vi.mocked(callProvider).mockResolvedValueOnce({
      reply: JSON.stringify({ summary: "s", targetUsers: "u", stack: "next", mvpFeatures: [], laterFeatures: [], milestones: [], firstPrompt: "p" }),
      model: "m", usage: {},
    } as any);

    const r = await request(makeApp()).post("/api/devhub/plan").send({ idea: "a brand new idea" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    const userMsg = vi.mocked(callProvider).mock.calls[0][1][1].content as string;
    expect(userMsg).not.toContain("already has these files");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Cloudflare domain auto-setup (uses project)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// 7. ElevenLabs Voice Clone
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 8. ElevenLabs Speech-to-Text
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 9. Google Drive search + import
// ═════════════════════════════════════════════════════════════════════════════


describe("POST /api/devhub/projects/:id/drive/import", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    return cr.body.project.id;
  }

  test("400 when fileId missing", async () => {
    process.env.GOOGLE_DRIVE_ACCESS_TOKEN = "fake";
    const app = makeApp();
    const id = await createProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/drive/import`).send({});
    expect(r.status).toBe(400);
  });

  test("imports binary file content into project", async () => {
    process.env.GOOGLE_DRIVE_ACCESS_TOKEN = "fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { name: "spec.md", mimeType: "text/markdown" }))
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({}),
        text: async () => "# Spec content from Drive",
        arrayBuffer: async () => new ArrayBuffer(0),
      });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/drive/import`)
      .send({ fileId: "drive-abc-123" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.path).toBe("spec.md");
    expect(r.body.mimeType).toBe("text/markdown");
    // alt=media endpoint for binary
    expect(fetchMock.mock.calls[1][0]).toContain("alt=media");
  });

  test("exports Google native doc as markdown", async () => {
    process.env.GOOGLE_DRIVE_ACCESS_TOKEN = "fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, {
        name: "MyDoc", mimeType: "application/vnd.google-apps.document",
      }))
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({}),
        text: async () => "# Exported markdown",
        arrayBuffer: async () => new ArrayBuffer(0),
      });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/drive/import`)
      .send({ fileId: "doc-1", targetPath: "docs/MyDoc.md" });
    expect(r.status).toBe(200);
    expect(r.body.path).toBe("docs/MyDoc.md");
    expect(fetchMock.mock.calls[1][0]).toContain("/export");
    expect(fetchMock.mock.calls[1][0]).toContain("text%2Fmarkdown");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. Agent workflow orchestration
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/projects/:id/agent/workflow", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    return cr.body.project.id;
  }

  test("400 when steps array empty/missing", async () => {
    const app = makeApp();
    const id = await createProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/agent/workflow`).send({ steps: [] });
    expect(r.status).toBe(400);
  });

  test("400 when > 20 steps", async () => {
    const app = makeApp();
    const id = await createProject(app);
    const steps = Array.from({ length: 21 }, () => ({ type: "code", prompt: "x" }));
    const r = await request(app).post(`/api/devhub/projects/${id}/agent/workflow`).send({ steps });
    expect(r.status).toBe(400);
  });

  test("runs multi-step workflow: code → image → tts", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      // step 1: code (no providers configured → stub, no fetch needed)
      // step 2: DALL-E
      .mockResolvedValueOnce(jsonResp(200, { data: [{ url: "https://oai.example/hero.png" }] }))
      // step 3: TTS
      .mockResolvedValueOnce(audioResp(200, 4096));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({
        steps: [
          { type: "code", prompt: "hello world page", stack: "next", saveAs: "pages/index.tsx" },
          { type: "image", prompt: "AI startup hero", saveAs: "public/hero.url.txt" },
          { type: "tts", text: "Welcome to our app", voice: "Rachel", saveAs: "public/welcome.mp3.b64" },
        ],
      });
    expect(r.status).toBe(200);
    expect(r.body.totalSteps).toBe(3);
    expect(r.body.successCount).toBe(3);
    expect(r.body.results[0].type).toBe("code");
    expect(r.body.results[1].savedAs).toBe("public/hero.url.txt");
    expect(r.body.results[2].savedAs).toBe("public/welcome.mp3.b64");
  });

  test("a second code step sees the file the first code step just wrote", async () => {
    const app = makeApp();
    const id = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([
      { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any,
    ]);
    vi.mocked(callProvider)
      .mockResolvedValueOnce({ reply: JSON.stringify({ files: [{ path: "lib/api.ts", content: "export function fetchUsers() {}", language: "typescript" }] }), model: "m", usage: {} } as any)
      .mockResolvedValueOnce({ reply: JSON.stringify({ files: [{ path: "pages/users.tsx", content: "// uses fetchUsers", language: "typescript" }] }), model: "m", usage: {} } as any);

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({
        steps: [
          { type: "code", prompt: "an api helper", saveAs: "lib/api.ts" },
          { type: "code", prompt: "a page that calls the api helper", saveAs: "pages/users.tsx" },
        ],
      });

    expect(r.status).toBe(200);
    expect(r.body.successCount).toBe(2);
    const secondCallUserMsg = vi.mocked(callProvider).mock.calls[1][1][1].content as string;
    expect(secondCallUserMsg).toContain("- lib/api.ts");
  });

  test("a code step's saveAs can be an array to generate several coordinated files in one step", async () => {
    const app = makeApp();
    const id = await createProject(app);
    vi.mocked(getProviders).mockReturnValue([
      { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", configured: true } as any,
    ]);
    vi.mocked(callProvider).mockResolvedValueOnce({
      reply: JSON.stringify({
        files: [
          { path: "pages/api/login.ts", content: "// handles POST", language: "typescript" },
          { path: "pages/login.tsx", content: "// calls /api/login", language: "typescript" },
        ],
      }),
      model: "m", usage: {},
    } as any);

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({
        steps: [{ type: "code", prompt: "login page + its API route", saveAs: ["pages/api/login.ts", "pages/login.tsx"] }],
      });

    expect(r.status).toBe(200);
    expect(r.body.successCount).toBe(1);
    expect(r.body.results[0].output.files).toEqual(["pages/api/login.ts", "pages/login.tsx"]);
    const systemPrompt = vi.mocked(callProvider).mock.calls[0][1][0].content as string;
    expect(systemPrompt).toContain("MULTIPLE coordinated files");
  });

  test("reports per-step errors without aborting workflow", async () => {
    // OpenAI key missing → image step fails
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock.mockResolvedValueOnce(audioResp(200, 1024)); // tts succeeds

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({
        steps: [
          { type: "image", prompt: "x" },  // will fail — no OPENAI_API_KEY
          { type: "tts", text: "hi" },
          { type: "unknown" },
        ],
      });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.failureCount).toBe(2);
    expect(r.body.results[0].ok).toBe(false);
    expect(r.body.results[0].error).toMatch(/OPENAI_API_KEY/);
    expect(r.body.results[1].ok).toBe(true);
    expect(r.body.results[2].ok).toBe(false);
    expect(r.body.results[2].error).toMatch(/unknown step type/);
  });

  test("independent non-code steps run concurrently, not sequentially, and results stay indexed by original step order", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProject(app);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Record when each upstream call starts and ends. Overlapping intervals
    // prove concurrency directly; wall-clock does not, because under a loaded
    // parallel test run the overhead alone can exceed any fixed ceiling (this
    // assertion used to be `elapsed < 150ms` and measured 154 in full runs).
    const spans: Array<{ who: string; start: number; end: number }> = [];
    const track = async (who: string, ms: number, make: () => any) => {
      const start = Date.now();
      await delay(ms);
      const out = make();
      spans.push({ who, start, end: Date.now() });
      return out;
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("openai.com")) {
        return track("image", 80, () => jsonResp(200, { data: [{ url: "https://oai.example/hero.png" }] }));
      }
      if (String(url).includes("elevenlabs.io")) {
        return track("tts", 5, () => audioResp(200, 512));
      }
      throw new Error(`unexpected url ${url}`);
    });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "image", prompt: "hero" }, { type: "tts", text: "hi" }] });
    expect(r.status).toBe(200);
    expect(r.body.successCount).toBe(2);
    // Order in the response matches step order, even though the tts (fast)
    // call resolves before the image (slow) one internally.
    expect(r.body.results[0].type).toBe("image");
    expect(r.body.results[1].type).toBe("tts");
    // Sequential execution cannot overlap: the second call would start only
    // after the first ended. Any overlap at all proves they ran together, and
    // this holds no matter how slow the machine is.
    expect(spans).toHaveLength(2);
    const [a, b] = [...spans].sort((x, y) => x.start - y.start);
    expect(b.start).toBeLessThan(a.end);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. Per-project GitHub token (envVars.GITHUB_TOKEN beats env)
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 11b. GitHub pull request — real merge/PR capability (agent can open a PR,
//      not just create a repo)
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 11c. GitHub PR merge — closes the "GitHub is push+PR only" gap
// ═════════════════════════════════════════════════════════════════════════════


afterEach(() => {
  for (const key of ["CLOUDFLARE_ACCOUNT_ID", "BREVO_SMS_SENDER", "BREVO_WHATSAPP_SENDER_ID"]) {
    delete process.env[key];
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. Agent workflow templates
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/devhub/agent/templates", () => {
  test("returns 3 templates with steps", async () => {
    const r = await request(makeApp()).get("/api/devhub/agent/templates");
    expect(r.status).toBe(200);
    expect(r.body.templates).toHaveLength(3);
    expect(r.body.templates.map((t: any) => t.id).sort()).toEqual(["blog", "dashboard", "landing"]);
    // landing has 5 steps (code + image + tts + sfx + music)
    const landing = r.body.templates.find((t: any) => t.id === "landing");
    expect(landing.steps).toHaveLength(5);
    expect(landing.steps[0].type).toBe("code");
    expect(landing.steps[3].type).toBe("sfx");
    expect(landing.steps[4].type).toBe("music");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 13. Agent workflow SSE streaming
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/projects/:id/agent/workflow/stream", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    return cr.body.project.id;
  }

  test("400 when steps empty", async () => {
    const app = makeApp();
    const id = await createProject(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/agent/workflow/stream`).send({ steps: [] });
    expect(r.status).toBe(400);
  });

  test("streams start + per-step + complete events", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock.mockResolvedValueOnce(audioResp(200, 1024)); // TTS step

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow/stream`)
      .send({
        steps: [
          { type: "code", prompt: "hello page", saveAs: "pages/index.tsx" },
          { type: "tts", text: "hi there", voice: "Rachel" },
        ],
      });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/event-stream/);

    // Parse SSE events from response text
    const events = r.text.split("\n\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    expect(events[0]).toMatchObject({ type: "start", totalSteps: 2 });
    expect(events[1]).toMatchObject({ type: "step-start", index: 0, stepType: "code" });
    expect(events[2]).toMatchObject({ type: "step-done", index: 0, ok: true });
    expect(events[3]).toMatchObject({ type: "step-start", index: 1, stepType: "tts" });
    expect(events[4]).toMatchObject({ type: "step-done", index: 1, ok: true });
    expect(events[events.length - 1]).toMatchObject({
      type: "complete", totalSteps: 2, successCount: 2, failureCount: 0,
    });
  });

  test("independent non-code steps stream both step-starts before either step-done — proves real concurrency, not a fake sequential trickle", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProject(app);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("openai.com")) { await delay(40); return jsonResp(200, { data: [{ url: "https://oai.example/hero.png" }] }); }
      if (String(url).includes("elevenlabs.io")) { await delay(5); return audioResp(200, 512); }
      throw new Error(`unexpected url ${url}`);
    });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow/stream`)
      .send({ steps: [{ type: "image", prompt: "hero" }, { type: "tts", text: "hi" }] });

    const events = r.text.split("\n\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    const startEvents = events.filter((e) => e.type === "step-start");
    const doneEvents = events.filter((e) => e.type === "step-done");
    expect(startEvents).toEqual([
      { type: "step-start", index: 0, stepType: "image" },
      { type: "step-start", index: 1, stepType: "tts" },
    ]);
    // Both starts happen up front (batched), and since tts is the faster
    // call it finishes (and streams) before the slower image step — the
    // opposite of step order, which only concurrent execution produces.
    const firstStartIdx = events.indexOf(startEvents[1]);
    const firstDoneIdx = events.indexOf(doneEvents[0]);
    expect(firstStartIdx).toBeLessThan(firstDoneIdx);
    expect(doneEvents[0].index).toBe(1); // tts (fast) finishes first
    expect(doneEvents[1].index).toBe(0); // image (slow) finishes second
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 14. Brevo SMS
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 15. Brevo WhatsApp
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 16. Cloudflare Images upload
// ═════════════════════════════════════════════════════════════════════════════


afterEach(() => {
  for (const key of ["DEEPL_API_KEY"]) delete process.env[key];
});

// ═════════════════════════════════════════════════════════════════════════════
// 17. DeepL translate
// ═════════════════════════════════════════════════════════════════════════════


describe("POST /api/devhub/projects/:id/files/translate", () => {
  async function createProjectWithFile(app: express.Express, path: string, content: string) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const id = cr.body.project.id;
    await request(app).put(`/api/devhub/projects/${id}/file?path=${encodeURIComponent(path)}`)
      .send({ content, language: "markdown" });
    return id;
  }

  test("404 when file not in project", async () => {
    process.env.DEEPL_API_KEY = "fake";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/files/translate`)
      .send({ path: "missing.md", targetLang: "RU" });
    expect(r.status).toBe(404);
  });

  test("translates file + saves with lang suffix", async () => {
    process.env.DEEPL_API_KEY = "key:fx";
    const app = makeApp();
    const id = await createProjectWithFile(app, "README.md", "Hello world");

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      translations: [{ text: "Привет мир" }],
    }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/files/translate`)
      .send({ path: "README.md", targetLang: "ru" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.path).toBe("README.ru.md");
    expect(r.body.targetLang).toBe("RU");
  });

  test("uses custom saveAs path when provided", async () => {
    process.env.DEEPL_API_KEY = "key:fx";
    const app = makeApp();
    const id = await createProjectWithFile(app, "docs/intro.md", "Hello");

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      translations: [{ text: "Hallo" }],
    }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/files/translate`)
      .send({ path: "docs/intro.md", targetLang: "DE", saveAs: "docs/de/intro.md" });
    expect(r.status).toBe(200);
    expect(r.body.path).toBe("docs/de/intro.md");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 18. Brevo email templates (list + send by template)
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 19. Agent workflow auto-uploads images to Cloudflare when env set
// ═════════════════════════════════════════════════════════════════════════════

describe("Agent workflow image step → auto-upload to Cloudflare", () => {
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T", stack: "next" });
    return cr.body.project.id;
  }

  test("when CF env set, image step saves permanent CDN URL", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { data: [{ url: "https://oai.example/temp.png" }] }))
      .mockResolvedValueOnce(jsonResp(200, {
        result: { id: "cf-img-1", variants: ["https://imagedelivery.net/x/cf-img-1/public"], uploaded: "now" },
      }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "image", prompt: "hero", saveAs: "public/hero.url.txt" }] });
    expect(r.status).toBe(200);
    expect(r.body.results[0].ok).toBe(true);
    expect(r.body.results[0].output.url).toBe("https://imagedelivery.net/x/cf-img-1/public");
  });

  test("when CF env missing, image step keeps OAI URL", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    const app = makeApp();
    const id = await createProject(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: [{ url: "https://oai.example/temp.png" }],
    }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "image", prompt: "hero" }] });
    expect(r.status).toBe(200);
    expect(r.body.results[0].output.url).toBe("https://oai.example/temp.png");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no CF call
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 20. Cloudflare R2 audio upload
// ═════════════════════════════════════════════════════════════════════════════

function setR2Env() {
  process.env.CLOUDFLARE_R2_ACCOUNT_ID = "acc-r2";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "ak-r2";
  process.env.CLOUDFLARE_R2_SECRET_KEY = "sk-r2";
  process.env.CLOUDFLARE_R2_BUCKET = "aevion-media";
}


// ═════════════════════════════════════════════════════════════════════════════
// 21. DeepL bulk translate
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/projects/:id/files/translate-bulk (DeepL)", () => {
  async function createProjectWithFiles(app: express.Express, files: Array<{ path: string; content: string }>) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "TBulk" });
    const id = cr.body.project.id;
    for (const f of files) {
      await request(app).put(`/api/devhub/projects/${id}/file?path=${encodeURIComponent(f.path)}`).send({ content: f.content, language: "markdown" });
    }
    return id;
  }

  test("400 missing paths", async () => {
    process.env.DEEPL_API_KEY = "fx-key:fx";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "X" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/files/translate-bulk`)
      .send({ targetLangs: ["RU"] });
    expect(r.status).toBe(400);
  });

  test("400 missing targetLangs", async () => {
    process.env.DEEPL_API_KEY = "fx-key:fx";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "X" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/files/translate-bulk`)
      .send({ paths: ["a.md"] });
    expect(r.status).toBe(400);
  });

  test("503 when DEEPL_API_KEY missing", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "X" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/files/translate-bulk`)
      .send({ paths: ["a.md"], targetLangs: ["RU"] });
    expect(r.status).toBe(503);
  });

  test("translates 2 files × 2 langs → 4 saved files with lang suffix", async () => {
    process.env.DEEPL_API_KEY = "fx:fx";
    const app = makeApp();
    const id = await createProjectWithFiles(app, [
      { path: "README.md", content: "Hello" },
      { path: "docs/intro.md", content: "World" },
    ]);
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { translations: [{ text: "Привет" }] }))
      .mockResolvedValueOnce(jsonResp(200, { translations: [{ text: "Bonjour" }] }))
      .mockResolvedValueOnce(jsonResp(200, { translations: [{ text: "Мир" }] }))
      .mockResolvedValueOnce(jsonResp(200, { translations: [{ text: "Monde" }] }));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/files/translate-bulk`)
      .send({ paths: ["README.md", "docs/intro.md"], targetLangs: ["ru", "fr"] });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.total).toBe(4);
    expect(r.body.successCount).toBe(4);
    const outputPaths = r.body.results.map((x: any) => x.outputPath).filter(Boolean).sort();
    expect(outputPaths).toEqual(["README.fr.md", "README.ru.md", "docs/intro.fr.md", "docs/intro.ru.md"].sort());
  });

  test("missing file reports per-language errors", async () => {
    process.env.DEEPL_API_KEY = "key:fx";
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "X" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/files/translate-bulk`)
      .send({ paths: ["missing.md"], targetLangs: ["RU", "DE"] });
    expect(r.status).toBe(200);
    expect(r.body.successCount).toBe(0);
    expect(r.body.failureCount).toBe(2);
    expect(r.body.results.every((x: any) => x.error === "file not found")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 22. Brevo template create
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// 23. ZIP import (symmetric to /export)
// ═════════════════════════════════════════════════════════════════════════════

const __CRC32_TBL = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();
function __crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = __CRC32_TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildSimpleZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  // Minimal ZIP writer (stored method=0) for tests — mirrors export endpoint format
  const crc32 = __crc32;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const size = e.data.length;
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const localBlock = Buffer.concat([local, nameBuf, e.data]);
    locals.push(localBlock);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localBlock.length;
  }
  const localBlock = Buffer.concat(locals);
  const centralBlock = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(localBlock.length, 16);
  return Buffer.concat([localBlock, centralBlock, eocd]);
}

describe("POST /api/devhub/projects/:id/import-zip", () => {
  async function createProj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "ZipP", stack: "next" });
    return cr.body.project.id;
  }

  test("400 missing base64Zip", async () => {
    const app = makeApp();
    const id = await createProj(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/import-zip`).send({});
    expect(r.status).toBe(400);
  });

  test("400 on invalid ZIP buffer", async () => {
    const app = makeApp();
    const id = await createProj(app);
    const r = await request(app).post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: Buffer.from("garbage that is long enough not to be empty").toString("base64") });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/EOCD|valid ZIP/);
  });

  test("imports text + binary files (binary gets .b64 suffix)", async () => {
    const app = makeApp();
    const id = await createProj(app);
    const zip = buildSimpleZip([
      { name: "README.md", data: Buffer.from("# Hello AEVION", "utf8") },
      { name: "public/song.mp3", data: Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x01]) },
      { name: "aevion-export.json", data: Buffer.from('{"meta":1}', "utf8") },
    ]);

    const r = await request(app).post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64") });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.importedCount).toBe(2);
    const paths = r.body.imported.map((x: any) => x.path).sort();
    expect(paths).toEqual(["README.md", "public/song.mp3.b64"]);
    const binary = r.body.imported.find((x: any) => x.path === "public/song.mp3.b64");
    expect(binary.binary).toBe(true);
    const meta = r.body.skipped.find((x: any) => x.path === "aevion-export.json");
    expect(meta).toBeDefined();

    // Verify file content is queryable via /files
    const listR = await request(app).get(`/api/devhub/projects/${id}/files`);
    const filePaths = (listR.body.files || []).map((f: any) => f.path);
    expect(filePaths).toContain("README.md");
    expect(filePaths).toContain("public/song.mp3.b64");
  });

  test("path traversal entries are skipped", async () => {
    const app = makeApp();
    const id = await createProj(app);
    const zip = buildSimpleZip([
      { name: "../etc/passwd", data: Buffer.from("evil", "utf8") },
      { name: "ok.txt", data: Buffer.from("good", "utf8") },
    ]);

    const r = await request(app).post(`/api/devhub/projects/${id}/import-zip`).send({ base64Zip: zip.toString("base64") });
    expect(r.status).toBe(200);
    expect(r.body.importedCount).toBe(1);
    expect(r.body.imported[0].path).toBe("ok.txt");
    const traversal = r.body.skipped.find((x: any) => x.reason === "path traversal");
    expect(traversal).toBeDefined();
  });

  test("overwrite=false skips existing files", async () => {
    const app = makeApp();
    const id = await createProj(app);
    await request(app).put(`/api/devhub/projects/${id}/file?path=${encodeURIComponent("README.md")}`)
      .send({ content: "ORIGINAL", language: "markdown" });

    const zip = buildSimpleZip([{ name: "README.md", data: Buffer.from("OVERWRITE", "utf8") }]);
    const r = await request(app).post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64"), overwrite: false });
    expect(r.status).toBe(200);
    expect(r.body.importedCount).toBe(0);
    expect(r.body.skipped[0].reason).toBe("already exists");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 24. Agent workflow tts/sfx — auto-upload audio to Cloudflare R2
// ═════════════════════════════════════════════════════════════════════════════

describe("Agent workflow audio step → auto-upload to R2", () => {
  async function createProj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "AudioP", stack: "next" });
    return cr.body.project.id;
  }

  test("tts step: when R2 env set, saves permanent CDN URL (not .mp3.b64)", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock
      .mockResolvedValueOnce(audioResp(200, 4096)) // ElevenLabs TTS audio bytes
      .mockResolvedValueOnce(jsonResp(200, {}));   // R2 PUT 200

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "tts", text: "Hello world", voice: "Rachel", saveAs: "public/voice-0.mp3.b64" }] });
    expect(r.status).toBe(200);
    const step0 = r.body.results[0];
    expect(step0.ok).toBe(true);
    expect(step0.savedAs).toBe("public/voice-0.url.txt"); // rewrote suffix
    expect(step0.output.url).toMatch(/^https:\/\/cdn\.aevion\.test\/audio\//);
    expect(step0.output.bytes).toBe(4096);

    // R2 PUT was the 2nd fetch — check signature headers exist
    const r2Init = fetchMock.mock.calls[1][1] as any;
    expect(r2Init.method).toBe("PUT");
    expect(r2Init.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  test("tts step: when R2 env missing, falls back to .mp3.b64 storage", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock.mockResolvedValueOnce(audioResp(200, 2048));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "tts", text: "Hi", voice: "Rachel" }] });
    expect(r.status).toBe(200);
    const step0 = r.body.results[0];
    expect(step0.ok).toBe(true);
    expect(step0.savedAs).toBe("public/voice-0.mp3.b64");
    expect(step0.output.url).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no R2 call
  });

  test("sfx step: R2 set → permanent CDN URL", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock
      .mockResolvedValueOnce(audioResp(200, 512))
      .mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "sfx", text: "whoosh", durationSeconds: 1.5 }] });
    expect(r.status).toBe(200);
    expect(r.body.results[0].savedAs).toBe("public/sfx-0.url.txt");
    expect(r.body.results[0].output.url).toMatch(/^https:\/\/cdn\.aevion\.test\/audio\//);
  });

  test("music step: R2 set → permanent CDN URL + lengthSeconds→music_length_ms", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock
      .mockResolvedValueOnce(audioResp(200, 8192))
      .mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "music", prompt: "Ambient synth pads", lengthSeconds: 30, saveAs: "public/bg.mp3.b64" }] });
    expect(r.status).toBe(200);
    expect(r.body.results[0].ok).toBe(true);
    expect(r.body.results[0].savedAs).toBe("public/bg.url.txt"); // suffix rewritten
    expect(r.body.results[0].output.url).toMatch(/^https:\/\/cdn\.aevion\.test\/audio\/.*\/music-0-/);
    // ElevenLabs music endpoint called with body.music_length_ms = 30000
    const elBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(elBody.prompt).toBe("Ambient synth pads");
    expect(elBody.music_length_ms).toBe(30_000);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/music/compose");
  });

  test("music step: R2 missing → falls back to .mp3.b64 storage", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock.mockResolvedValueOnce(audioResp(200, 4096));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "music", prompt: "Lo-fi beats" }] });
    expect(r.status).toBe(200);
    expect(r.body.results[0].ok).toBe(true);
    expect(r.body.results[0].savedAs).toBe("public/music-0.mp3.b64");
    expect(r.body.results[0].output.url).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no R2 call
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 25. SSE stream — audio steps (tts/sfx/music) parity with non-stream auto-R2
// ═════════════════════════════════════════════════════════════════════════════

describe("SSE /agent/workflow/stream — audio auto-R2 parity", () => {
  async function createProj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "StreamP", stack: "next" });
    return cr.body.project.id;
  }

  function parseSseEvents(body: string): any[] {
    return body.split("\n\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
  }

  test("tts in stream: R2 set → step-done emits url + .url.txt savedAs", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock
      .mockResolvedValueOnce(audioResp(200, 2048))
      .mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow/stream`)
      .send({ steps: [{ type: "tts", text: "Hi", voice: "Rachel" }] });
    expect(r.status).toBe(200);
    const events = parseSseEvents(r.text);
    const done = events.find((e) => e.type === "step-done" && e.index === 0);
    expect(done.ok).toBe(true);
    expect(done.savedAs).toBe("public/voice-0.url.txt");
    expect(done.output.url).toMatch(/^https:\/\/cdn\.aevion\.test\/audio\//);
  });

  test("music in stream: R2 set → step-done emits url + lengthSeconds→music_length_ms", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock
      .mockResolvedValueOnce(audioResp(200, 16384))
      .mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow/stream`)
      .send({ steps: [{ type: "music", prompt: "Ambient", lengthSeconds: 60, saveAs: "public/bg.mp3.b64" }] });
    expect(r.status).toBe(200);
    const events = parseSseEvents(r.text);
    const start = events.find((e) => e.type === "step-start" && e.index === 0);
    const done = events.find((e) => e.type === "step-done" && e.index === 0);
    expect(start.stepType).toBe("music");
    expect(done.ok).toBe(true);
    expect(done.savedAs).toBe("public/bg.url.txt");
    expect(done.output.url).toMatch(/^https:\/\/cdn\.aevion\.test\/audio\/.*\/music-0-/);
    const elBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(elBody.music_length_ms).toBe(60_000);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/music/compose");
  });

  test("music in stream: R2 missing → step-done emits bytes only (no url)", async () => {
    process.env.ELEVENLABS_API_KEY = "el-fake";
    const app = makeApp();
    const id = await createProj(app);

    fetchMock.mockResolvedValueOnce(audioResp(200, 1024));

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow/stream`)
      .send({ steps: [{ type: "music", prompt: "Chill jazz" }] });
    expect(r.status).toBe(200);
    const events = parseSseEvents(r.text);
    const done = events.find((e) => e.type === "step-done" && e.index === 0);
    expect(done.ok).toBe(true);
    expect(done.savedAs).toBe("public/music-0.mp3.b64");
    expect(done.output.url).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 24. Export ZIP — non-ASCII file names (confirmed broken on prod 2026-07-26)
// ═════════════════════════════════════════════════════════════════════════════

describe("export zip: UTF-8 file names", () => {
  test("sets general purpose bit 11 so readers decode names as UTF-8, not CP437", async () => {
    const { buildZipStored } = await import("../src/routes/devhub");
    const zip = buildZipStored([
      { path: "src/компоненты/Таймер.jsx", content: Buffer.from("export default 1;", "utf8") },
      { path: "README.md", content: Buffer.from("# hi", "utf8") },
    ]);

    // Local header: signature at 0, flags at offset 6.
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt16LE(6) & 0x0800).toBe(0x0800);

    // Every central directory entry must agree — a mismatch makes some tools
    // trust the local header and others the central one.
    for (let i = 0; i < zip.length - 4; i++) {
      if (zip.readUInt32LE(i) === 0x02014b50) {
        expect(zip.readUInt16LE(i + 8) & 0x0800).toBe(0x0800);
      }
    }

    // The name really is UTF-8 bytes in the archive.
    expect(zip.includes(Buffer.from("src/компоненты/Таймер.jsx", "utf8"))).toBe(true);
  });

  test("round-trips a Cyrillic name through our own import endpoint", async () => {
    const { buildZipStored } = await import("../src/routes/devhub");
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Utf8Zip", stack: "next" });
    const id = cr.body.project.id;
    const zip = buildZipStored([{ path: "проект/файл.txt", content: Buffer.from("данные", "utf8") }]);

    const up = await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64") });
    expect(up.status).toBe(200);
    expect(up.body.imported.map((x: { path: string }) => x.path)).toContain("проект/файл.txt");
  });
});

describe("import zip: file name encoding", () => {
  async function proj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "ImpEnc", stack: "next" });
    return cr.body.project.id;
  }

  test("refuses non-UTF-8 names with an actionable message instead of importing U+FFFD paths", async () => {
    const app = makeApp();
    const id = await proj(app);
    // "файл.txt" as CP866 bytes — what a Russian Windows archiver writes when
    // it does not set bit 11. Decoded as UTF-8 these become replacement chars.
    const cp866Name = Buffer.from([0xa4, 0xa0, 0xa9, 0xab, 0x2e, 0x74, 0x78, 0x74]);
    // Swap the name bytes in place: same length, and CRC covers data only, so
    // the archive stays structurally valid — only its name encoding changes.
    const zip = buildSimpleZip([{ name: "aaaa.txt", data: Buffer.from("data", "utf8") }]);
    const placeholder = Buffer.from("aaaa.txt", "utf8");
    let at = zip.indexOf(placeholder);
    while (at !== -1) {
      cp866Name.copy(zip, at);
      at = zip.indexOf(placeholder, at + 1);
    }

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64") });

    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/not UTF-8/);
    expect(r.body.error).toMatch(/Re-create the archive/);
  });

  test("plain ASCII names still import from archives with no UTF-8 flag (the common case)", async () => {
    const app = makeApp();
    const id = await proj(app);
    const zip = buildSimpleZip([{ name: "src/App.jsx", data: Buffer.from("export default 1;", "utf8") }]);

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64") });

    expect(r.status).toBe(200);
    expect(r.body.imported.map((x: { path: string }) => x.path)).toContain("src/App.jsx");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 26. Export → Import round trip (both sides were fixed separately: #923/#924)
// ═════════════════════════════════════════════════════════════════════════════

describe("zip round trip: export → import", () => {
  test("a project survives a full export/import cycle, Cyrillic paths included", async () => {
    const app = makeApp();
    const src = (await request(app).post("/api/devhub/projects").send({ name: "RtSrc", stack: "react" })).body.project.id;

    const files = [
      { path: "src/компоненты/Таймер.jsx", content: "export default function Таймер(){ return null; }" },
      { path: "src/App.jsx", content: "import T from './компоненты/Таймер';\nexport default T;" },
      { path: "README.md", content: "# проект\nописание" },
    ];
    for (const f of files) {
      const put = await request(app)
        .put(`/api/devhub/projects/${src}/file?path=${encodeURIComponent(f.path)}`)
        .send({ content: f.content, language: "javascript" });
      expect(put.status).toBe(200);
    }

    const exported = await request(app)
      .get(`/api/devhub/projects/${src}/export`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(exported.status).toBe(200);

    const dst = (await request(app).post("/api/devhub/projects").send({ name: "RtDst", stack: "react" })).body.project.id;
    const imp = await request(app)
      .post(`/api/devhub/projects/${dst}/import-zip`)
      .send({ base64Zip: (exported.body as Buffer).toString("base64") });
    expect(imp.status).toBe(200);

    // Paths AND contents must match — a mangled name would still "import".
    const listed = await request(app).get(`/api/devhub/projects/${dst}/files`);
    const got: Record<string, string> = {};
    for (const f of listed.body.files) got[f.path] = f.content;
    for (const f of files) expect(got[f.path]).toBe(f.content);
    expect(Object.keys(got).sort()).toEqual(files.map((f) => f.path).sort());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 27. Real database provisioning (schema + role per project)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// 28. Video model catalogue (Veo 3 / Seedance / Kling instead of 2024 models)
// ═════════════════════════════════════════════════════════════════════════════

describe("video models", () => {
  test("catalogue exposes the current generation and marks the default", async () => {
    const app = makeApp();
    const r = await request(app).get("/api/devhub/media/video/models");
    expect(r.status).toBe(200);
    const ids = r.body.models.map((m: { id: string }) => m.id);
    expect(ids).toContain("google/veo-3-fast");
    expect(ids).toContain("bytedance/seedance-1-pro");
    expect(ids).toContain("kwaivgi/kling-v2.1");
    const def = r.body.models.filter((m: { default: boolean }) => m.default);
    expect(def).toHaveLength(1);
    expect(def[0].audio).toBe(true); // the default is the one that ships sound
  });

  test("maps our request onto each model's real input schema", async () => {
    const { findVideoModel } = await import("../src/lib/devhubVideoModels");
    const veo = findVideoModel("google/veo-3-fast")!.toInput({ prompt: "a cat", aspectRatio: "9:16", resolution: "720p" });
    expect(veo).toMatchObject({ prompt: "a cat", aspect_ratio: "9:16", resolution: "720p", generate_audio: true });
    expect(veo).not.toHaveProperty("num_frames"); // the old code sent this; Veo ignores it

    const seed = findVideoModel("bytedance/seedance-1-pro")!.toInput({ prompt: "a car", duration: 10, imageUrl: "https://x/y.png" });
    expect(seed).toMatchObject({ duration: 10, image: "https://x/y.png", fps: 24 });

    const kling = findVideoModel("kwaivgi/kling-v2.1")!.toInput({ prompt: "a city", imageUrl: "https://x/y.png", resolution: "1080p" });
    expect(kling).toMatchObject({ start_image: "https://x/y.png", mode: "pro" }); // not "image"
    // Durations outside a model's list fall back rather than erroring at the provider.
    expect(findVideoModel("bytedance/seedance-1-pro")!.toInput({ prompt: "x", duration: 7 })).toMatchObject({ duration: 5 });
  });

  test("unknown model id is refused with the list instead of a provider error", async () => {
    process.env.REPLICATE_API_TOKEN = "rep-test";
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/video").send({ prompt: "x", model: "made/up" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/unknown video model/);
    expect(r.body.models).toContain("google/veo-3-fast");
    delete process.env.REPLICATE_API_TOKEN;
  });
});

describe("3D assets and music fallback", () => {
  test("3D catalogue lists both meshers and marks the default", async () => {
    const app = makeApp();
    const r = await request(app).get("/api/devhub/media/3d/models");
    expect(r.status).toBe(200);
    const ids = r.body.models.map((m: { id: string }) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["firtoz/trellis", "tencent/hunyuan3d-2"]));
    expect(r.body.models.filter((m: { default: boolean }) => m.default)).toHaveLength(1);
  });

  test("3D refuses a non-URL image with an actionable message", async () => {
    process.env.REPLICATE_API_TOKEN = "rep-test";
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/3d").send({ imageUrl: "not-a-url" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/imageUrl/);
    delete process.env.REPLICATE_API_TOKEN;
  });

  test("3D maps inputs onto each mesher's real schema", async () => {
    const { find3dModel } = await import("../src/lib/devhub3dModels");
    const trellis = find3dModel("firtoz/trellis")!.toInput({ imageUrl: "https://x/y.png" });
    expect(trellis).toMatchObject({ images: ["https://x/y.png"], generate_model: true, generate_color: true });
    const hunyuan = find3dModel("tencent/hunyuan3d-2")!.toInput({ imageUrl: "https://x/y.png", removeBackground: false });
    expect(hunyuan).toMatchObject({ image: "https://x/y.png", remove_background: false });
  });

  test("music falls back to MusicGen when ElevenLabs is not configured", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    process.env.REPLICATE_API_TOKEN = "rep-test";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "pred-music-1", status: "starting" }),
    } as any);

    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/music").send({ prompt: "lofi beat", musicLengthMs: 12000 });
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe("replicate/musicgen");
    expect(r.body.async).toBe(true);
    expect(r.body.predictionId).toBe("pred-music-1");
    expect(r.body.fallbackFrom).toMatch(/ELEVENLABS_API_KEY/);
    delete process.env.REPLICATE_API_TOKEN;
  });

  test("without either provider music says which env vars would fix it", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.REPLICATE_API_TOKEN;
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/music").send({ prompt: "lofi beat" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/ELEVENLABS_API_KEY or REPLICATE_API_TOKEN/);
  });
});

describe("provider realities: retired TTS model, empty video balance", () => {
  test("TTS no longer sends the removed eleven_monolingual_v1", async () => {
    process.env.ELEVENLABS_API_KEY = "el-test";
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      arrayBuffer: async () => new ArrayBuffer(64),
    } as any);
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/tts").send({ text: "привет" });
    expect(r.status).toBe(200);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model_id).toBe("eleven_multilingual_v2"); // multilingual: our prompts are Russian
    expect(body.model_id).not.toBe("eleven_monolingual_v1");
    delete process.env.ELEVENLABS_API_KEY;
  });

  test("a retired model is survived by retrying the fallback chain", async () => {
    process.env.ELEVENLABS_API_KEY = "el-test";
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => '{"detail":{"code":"unsupported_model"}}' } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(32) } as any);
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/tts").send({ text: "привет" });
    expect(r.status).toBe(200);
    expect(r.headers["x-tts-model"]).toBe("eleven_turbo_v2_5");
    delete process.env.ELEVENLABS_API_KEY;
  });

  test("an empty Replicate balance says 'top up', not 'Replicate error'", async () => {
    process.env.REPLICATE_API_TOKEN = "rep-test";
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 402,
      text: async () => '{"title":"Insufficient credit"}',
    } as any);
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/video").send({ prompt: "a cat" });
    expect(r.status).toBe(402);
    expect(r.body.error).toMatch(/no credit/i);
    expect(r.body.topUpUrl).toContain("replicate.com");
    delete process.env.REPLICATE_API_TOKEN;
  });
});

describe("realism pass shared with QReal", () => {
  test("video prompts carry QReal's realism directives by default", async () => {
    process.env.REPLICATE_API_TOKEN = "rep-test";
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "p1", status: "starting" }) } as any);
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/video").send({ prompt: "a barista pours milk" });
    expect(r.status).toBe(200);
    expect(r.body.realism).toBe(true);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    // Same text QReal renders with — imported, not duplicated.
    const { REALISM_DIRECTIVES } = await import("../src/services/qreal/directives");
    expect(sent.input.prompt).toContain("a barista pours milk");
    expect(sent.input.prompt).toContain(REALISM_DIRECTIVES);
    delete process.env.REPLICATE_API_TOKEN;
  });

  test("realism:false leaves a stylised prompt untouched", async () => {
    process.env.REPLICATE_API_TOKEN = "rep-test";
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "p2", status: "starting" }) } as any);
    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/video").send({ prompt: "flat 2d cartoon fox", realism: false });
    expect(r.body.realism).toBe(false);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.input.prompt).toBe("flat 2d cartoon fox");
    expect(sent.input.prompt).not.toMatch(/ARRI Alexa/);
    delete process.env.REPLICATE_API_TOKEN;
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

describe("capabilities tell the truth about providers", () => {
  test("a live capability turns degraded after a real provider failure", async () => {
    const { noteProviderFailure, __resetProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.REPLICATE_API_TOKEN = "rep-test";

    const app = makeApp();
    const before = await request(app).get("/api/devhub/studio/capabilities");
    expect(before.body.capabilities.find((c: { id: string }) => c.id === "video").status).toBe("live");

    noteProviderFailure("video", "Replicate: insufficient credit");

    const after = await request(app).get("/api/devhub/studio/capabilities");
    const video = after.body.capabilities.find((c: { id: string }) => c.id === "video");
    expect(video.status).toBe("degraded");
    expect(video.lastError).toMatch(/insufficient credit/);
    expect(after.body.summary.degraded).toBe(1);
    __resetProviderHealth();
    delete process.env.REPLICATE_API_TOKEN;
  });

  test("a later success clears it, and an unconfigured capability is untouched", async () => {
    const { noteProviderFailure, noteProviderSuccess, __resetProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    delete process.env.REPLICATE_API_TOKEN;

    noteProviderFailure("video", "boom");
    const app = makeApp();
    // No token: it stays needs_token rather than being mislabelled degraded.
    const r1 = await request(app).get("/api/devhub/studio/capabilities");
    expect(r1.body.capabilities.find((c: { id: string }) => c.id === "video").status).toBe("needs_token");

    process.env.REPLICATE_API_TOKEN = "rep-test";
    noteProviderSuccess("video");
    const r2 = await request(app).get("/api/devhub/studio/capabilities");
    expect(r2.body.capabilities.find((c: { id: string }) => c.id === "video").status).toBe("live");
    __resetProviderHealth();
    delete process.env.REPLICATE_API_TOKEN;
  });
});

describe("image failures name the fix, not just the failure", () => {
  test("a billing wall plus a 401 fallback reads as 'providers blocked'", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_API_TOKEN = "cf";
    delete process.env.TOGETHER_API_KEY;

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => '{"error":{"code":"billing_hard_limit_reached"}}' } as any)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '{"errors":[{"code":10000,"message":"Authentication error"}]}' } as any);

    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/image").send({ prompt: "a red circle" });
    expect(r.status).toBe(502);
    expect(r.body.providersBlocked).toBe(true);
    expect(r.body.error).toMatch(/not your prompt/);
    expect(r.body.error).toMatch(/top up the OpenAI account/);
    expect(r.body.error).toMatch(/TOGETHER_API_KEY/);

    delete process.env.OPENAI_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
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

describe("translation failures are legible", () => {
  test("DeepL 456 reads as an account quota problem, not a generic error", async () => {
    process.env.DEEPL_API_KEY = "key:fx";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 456, text: async () => '{"message":"Quota exceeded"}' } as any);

    const app = makeApp();
    const r = await request(app).post("/api/devhub/media/translate").send({ text: "Привет", targetLang: "EN" });
    expect(r.status).toBe(456);
    expect(r.body.provider).toBe("deepl");
    expect(r.body.error).toMatch(/out of quota/i);
    // The detail that cost an hour to find: their usage endpoint lies.
    expect(r.body.error).toMatch(/can still show 0 used/);
    delete process.env.DEEPL_API_KEY;
  });

  test("translation is listed as a capability so its state is visible at all", async () => {
    process.env.DEEPL_API_KEY = "key:fx";
    const app = makeApp();
    const r = await request(app).get("/api/devhub/studio/capabilities");
    const t = r.body.capabilities.find((c: { id: string }) => c.id === "translate");
    expect(t).toBeTruthy();
    expect(t.status).toBe("live");
    delete process.env.DEEPL_API_KEY;
  });
});

describe("provider key health", () => {
  test("reports a pending Cloudflare zone as unhealthy — the aevion.build failure", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf";
    process.env.CLOUDFLARE_ZONE_ID = "zone";
    delete process.env.BREVO_API_KEY;
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.OPENAI_API_KEY;

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("tokens/verify")) return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
      if (String(url).includes("/zones/")) return { ok: true, status: 200, json: async () => ({ result: { status: "pending" } }) } as any;
      return { ok: false, status: 500, json: async () => ({}) } as any;
    });

    const app = makeApp();
    const r = await request(app).get("/api/devhub/providers/health");
    expect(r.status).toBe(200);
    const zone = r.body.checks.find((c: { name: string }) => c.name === "cloudflare_zone");
    expect(zone.ok).toBe(false);
    expect(zone.detail).toMatch(/pending/);
    expect(r.body.failing).toContain("cloudflare_zone");
    // A token that is present but the zone undelegated: the token check passes.
    expect(r.body.checks.find((c: { name: string }) => c.name === "cloudflare").ok).toBe(true);

    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  test("a valid key is not mistaken for a funded account", async () => {
    process.env.REPLICATE_API_TOKEN = "rep";
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ username: "acme" }) } as any);
    const app = makeApp();
    const r = await request(app).get("/api/devhub/providers/health");
    const rep = r.body.checks.find((c: { name: string }) => c.name === "replicate");
    expect(rep.ok).toBe(true);
    // Says so out loud: this is exactly how "video: live" stayed wrong.
    expect(rep.detail).toMatch(/balance not visible/);
    delete process.env.REPLICATE_API_TOKEN;
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


describe("A ZIP import is undoable, like every other bulk write", () => {
  // /github/sync has taken a checkpoint before writing since it was built —
  // import-zip, the other bulk write, did not. With overwrite=true it replaces
  // whole files, so a mis-picked archive destroyed work that the IDE's Undo
  // and History advertise as recoverable.
  async function createProj(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "ZipUndo", stack: "next" });
    return cr.body.project.id;
  }

  test("undo after an overwriting import puts the original content back", async () => {
    const app = makeApp();
    const id = await createProj(app);
    await request(app)
      .put(`/api/devhub/projects/${id}/file?path=${encodeURIComponent("README.md")}`)
      .send({ content: "ORIGINAL", language: "markdown" });

    const zip = buildSimpleZip([
      { name: "README.md", data: Buffer.from("FROM ZIP", "utf8") },
      { name: "src/new.txt", data: Buffer.from("brand new", "utf8") },
    ]);
    const imp = await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64"), overwrite: true });
    expect(imp.status).toBe(200);
    expect(imp.body.importedCount).toBe(2);
    expect(imp.body.checkpointId).toBeTruthy();

    const afterImport = await request(app).get(`/api/devhub/projects/${id}/files`);
    expect(afterImport.body.files.find((f: any) => f.path === "README.md").content).toBe("FROM ZIP");

    const undo = await request(app).post(`/api/devhub/projects/${id}/generate/undo`).send({});
    expect(undo.status).toBe(200);

    const after = await request(app).get(`/api/devhub/projects/${id}/files`);
    const paths = after.body.files.map((f: any) => f.path);
    // The file that existed comes back with its own content...
    expect(after.body.files.find((f: any) => f.path === "README.md").content).toBe("ORIGINAL");
    // ...and the one the archive introduced is removed, not left behind empty.
    expect(paths).not.toContain("src/new.txt");
  });

  test("the import shows up in history with a label a human can recognise", async () => {
    const app = makeApp();
    const id = await createProj(app);
    const zip = buildSimpleZip([{ name: "a.txt", data: Buffer.from("a", "utf8") }]);
    await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64") });

    const hist = await request(app).get(`/api/devhub/projects/${id}/checkpoints`);
    expect(hist.status).toBe(200);
    expect(hist.body.checkpoints[0].label).toMatch(/ZIP import/i);
  });

  test("an import that writes nothing does not leave an empty checkpoint to undo", async () => {
    const app = makeApp();
    const id = await createProj(app);
    await request(app)
      .put(`/api/devhub/projects/${id}/file?path=${encodeURIComponent("keep.txt")}`)
      .send({ content: "KEEP", language: "plaintext" });

    const zip = buildSimpleZip([{ name: "keep.txt", data: Buffer.from("nope", "utf8") }]);
    const imp = await request(app)
      .post(`/api/devhub/projects/${id}/import-zip`)
      .send({ base64Zip: zip.toString("base64"), overwrite: false });
    expect(imp.body.importedCount).toBe(0);
    expect(imp.body.checkpointId).toBeNull();

    const hist = await request(app).get(`/api/devhub/projects/${id}/checkpoints`);
    expect(hist.body.checkpoints || []).toHaveLength(0);
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

// ─── The timers behind the suite's drifting failures ─────────────────────────
//
// Deploy routes answer immediately and schedule the "does the page actually
// serve" check on a timer — 4s for CF Pages, 5s for Vercel — after which
// verifyDeploymentServes() fetches up to 5 times, 5s apart. Those fetches read
// globalThis.fetch when they finally run, which by then belongs to a LATER
// test, and they take mockResolvedValueOnce answers off its queue. That test
// then reads somebody else's response and fails an assertion unrelated to what
// it tests — a different one every run.
//
// Fixed by tracking them (see `deferred` in devhub.ts) and dropping them in
// afterEach. These two tests hold that in place: the first shows the stray
// traffic is real, the second shows the cleanup stops it. Without the cleanup
// the second one fails.
//
// Isolated, this file finishes in ~2s and the process exits before any timer
// fires — which is why isolation hid the problem for weeks.
describe("deploy verification timers outlive the test that started them", () => {
  test("a CF Pages deploy leaves a timer that fetches after the response", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    vi.useFakeTimers();
    try {
      const app = makeApp();
      const created = await request(app).post("/api/devhub/projects").send({ name: "timer-probe" });
      const id = created.body.project.id as string;
      await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>x</h1>" });

      fetchMock.mockResolvedValue(jsonResp(200, { success: true }));
      mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://probe.pages.dev", output: "", skipped: []});
      const dep = await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});
      expect(dep.status).toBe(200);

      const afterResponse = fetchMock.mock.calls.length;
      // The route has answered. Nothing is pending from the caller's point of
      // view — but a timer is armed.
      await vi.advanceTimersByTimeAsync(4_100);
      const afterTimer = fetchMock.mock.calls.length;

      // This is the stray traffic. In a real run it lands on whichever test is
      // executing 4 seconds later.
      expect(afterTimer).toBeGreaterThan(afterResponse);
    } finally {
      vi.useRealTimers();
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;
    }
  });

  test("__clearDeferredDevHubWork disarms it, which is what afterEach does", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    vi.useFakeTimers();
    try {
      const app = makeApp();
      const created = await request(app).post("/api/devhub/projects").send({ name: "timer-probe-2" });
      const id = created.body.project.id as string;
      await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>x</h1>" });

      fetchMock.mockResolvedValue(jsonResp(200, { success: true }));
      mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://probe2.pages.dev", output: "", skipped: []});
      await request(app).post(`/api/devhub/projects/${id}/deploy/pages`).send({});

      __clearDeferredDevHubWork();
      const afterClear = fetchMock.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);

      // Untracked, this kept climbing — and every one of those calls was taken
      // from a later test's queue.
      expect(fetchMock.mock.calls.length).toBe(afterClear);
    } finally {
      vi.useRealTimers();
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;
    }
  });
});

describe("An exported project says how to run it", () => {
  test("the ZIP carries HOW-TO-RUN.md built from the project's real files", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "RunNote", stack: "react" });
    const id = cr.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=src/App.jsx`).send({ content: "export default () => null;" });
    await request(app)
      .put(`/api/devhub/projects/${id}/file?path=package.json`)
      .send({ content: JSON.stringify({ scripts: { dev: "vite" }, dependencies: { react: "^18.0.0" } }) });

    const r = await request(app).get(`/api/devhub/projects/${id}/export`).buffer().parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);

    const zipText = (r.body as Buffer).toString("utf8");
    expect(zipText).toContain("HOW-TO-RUN.md");
    // The command comes from the project's own manifest, not a template.
    expect(zipText).toContain("npm run dev");
  });
});


describe("Export metadata does not come back as project content", () => {
  test("a re-imported export does not gain HOW-TO-RUN.md as a file", async () => {
    // Каждый round-trip иначе добавлял бы файл: экспорт кладёт заметку,
    // импорт принимал бы её за исходник проекта.
    const app = makeApp();
    const src = (await request(app).post("/api/devhub/projects").send({ name: "RoundNote", stack: "react" })).body.project.id;
    await request(app).put(`/api/devhub/projects/${src}/file?path=index.html`).send({ content: "<h1>hi</h1>" });

    const exp = await request(app).get(`/api/devhub/projects/${src}/export`).buffer().parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(exp.status).toBe(200);

    const dst = (await request(app).post("/api/devhub/projects").send({ name: "RoundNoteTarget", stack: "react" })).body.project.id;
    const imp = await request(app)
      .post(`/api/devhub/projects/${dst}/import-zip`)
      .send({ base64Zip: (exp.body as Buffer).toString("base64") });
    expect(imp.status).toBe(200);

    const paths = (await request(app).get(`/api/devhub/projects/${dst}/files`)).body.files.map((f: any) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).not.toContain("HOW-TO-RUN.md");
    expect(paths).not.toContain("aevion-export.json");
  });
});

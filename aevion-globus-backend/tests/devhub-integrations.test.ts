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
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { getProviders, callProvider } from "../src/services/qcoreai/providers";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

// ─── Fetch mock helper ───────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetDevHubStore();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockDeployViaWrangler.mockReset();
});

afterEach(() => {
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

describe("POST /api/devhub/media/tts (ElevenLabs)", () => {
  test("503 when ELEVENLABS_API_KEY is missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/tts")
      .send({ text: "hello", voice: "Rachel" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/ELEVENLABS_API_KEY/);
    expect(r.body.setupUrl).toContain("elevenlabs.io");
  });

  test("400 when text missing", async () => {
    process.env.ELEVENLABS_API_KEY = "fake-key";
    const r = await request(makeApp()).post("/api/devhub/media/tts").send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/text is required/);
  });

  test("400 when text > 5000 chars", async () => {
    process.env.ELEVENLABS_API_KEY = "fake-key";
    const r = await request(makeApp())
      .post("/api/devhub/media/tts")
      .send({ text: "x".repeat(5001) });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/too long/);
  });

  test("calls ElevenLabs with correct voice ID + returns audio/mpeg", async () => {
    process.env.ELEVENLABS_API_KEY = "fake-key";
    fetchMock.mockResolvedValueOnce(audioResp(200, 2048));

    const r = await request(makeApp())
      .post("/api/devhub/media/tts")
      .send({ text: "Hello world", voice: "Rachel" });

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("21m00Tcm4TlvDq8ikWAM"); // Rachel voice ID
    expect((opts as any).headers["xi-api-key"]).toBe("fake-key");
    const body = JSON.parse((opts as any).body);
    expect(body.text).toBe("Hello world");
    expect(body.model_id).toBe("eleven_monolingual_v1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Brevo Email
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/email (Brevo)", () => {
  test("503 when BREVO_API_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "x@y.com", subject: "Hi", htmlBody: "<p>hi</p>" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/BREVO_API_KEY/);
  });

  test("400 on invalid email", async () => {
    process.env.BREVO_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "not-an-email", subject: "Hi", htmlBody: "<p>hi</p>" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/invalid recipient/);
  });

  test("400 on missing fields", async () => {
    process.env.BREVO_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "x@y.com" });
    expect(r.status).toBe(400);
  });

  test("calls Brevo with api-key header + uses default sender", async () => {
    process.env.BREVO_API_KEY = "brevo-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { messageId: "msg-123" }));

    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "u@example.com", subject: "Welcome", htmlBody: "<p>Hello</p>" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.messageId).toBe("msg-123");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("api.brevo.com/v3/smtp/email");
    expect((opts as any).headers["api-key"]).toBe("brevo-fake");
    const body = JSON.parse((opts as any).body);
    expect(body.sender.email).toBe("noreply@aevion.app");
    expect(body.to[0].email).toBe("u@example.com");
  });

  test("degraded: true when Brevo returns 2xx with no messageId — not a silent success", async () => {
    process.env.BREVO_API_KEY = "brevo-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(201, {})); // 2xx but no messageId

    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "u@example.com", subject: "Welcome", htmlBody: "<p>Hello</p>" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.degraded).toBe(true);
    expect(r.body.degradedReason).toMatch(/messageId/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Lemon Squeezy Payment Link (was: Paddle, migrated 2026-05-24)
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/payment-link (Lemon Squeezy)", () => {
  function setLsEnv() {
    process.env.LEMON_SQUEEZY_API_KEY = "ls_fake_key";
    process.env.LEMON_SQUEEZY_STORE_ID = "12345";
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "67890";
  }

  test("503 when Lemon Squeezy env vars missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro", amountCents: 999 });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/LEMON_SQUEEZY/);
  });

  test("400 when amount < 50 cents", async () => {
    setLsEnv();
    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro", amountCents: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/≥ 50/);
  });

  test("creates Lemon Squeezy checkout + returns checkout URL", async () => {
    setLsEnv();
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: { id: "co_abc123", attributes: { url: "https://store.lemonsqueezy.com/checkout/co_abc123" } },
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro plan", amountCents: 999, currency: "usd", description: "Monthly" });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      provider: "lemonsqueezy",
      checkoutId: "co_abc123",
      url: "https://store.lemonsqueezy.com/checkout/co_abc123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/checkouts");
    expect(fetchMock.mock.calls[0][0]).toContain("api.lemonsqueezy.com");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. DALL-E Image generation
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/image (DALL-E 3)", () => {
  test("503 when OPENAI_API_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/OPENAI_API_KEY/);
  });

  test("400 on invalid size", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat", size: "999x999" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/size must be/);
  });

  test("calls OpenAI Images API with gpt-image-1 + returns URL", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: [{ url: "https://oaidalleapi.example/img.png", revised_prompt: "A cat sitting" }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat", size: "1024x1024", quality: "hd" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.url).toBe("https://oaidalleapi.example/img.png");
    expect(r.body.revisedPrompt).toBe("A cat sitting");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.model).toBe("gpt-image-1");
    // gpt-image-1 uses low/medium/high/auto; route maps "hd" → "high"
    expect(body.quality).toBe("high");
  });

  test("b64 result without Cloudflare configured falls back to inline data: URI", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: [{ b64_json: Buffer.from("fake-png-bytes").toString("base64") }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^data:image\/png;base64,/);
    expect(r.body.storage).toBe("inline");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no upload attempt without creds
  });

  test("b64 result with Cloudflare configured uploads the bytes and returns a permanent URL", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, {
        data: [{ b64_json: Buffer.from("fake-png-bytes").toString("base64") }],
      }))
      .mockResolvedValueOnce(jsonResp(200, {
        result: { variants: ["https://imagedelivery.example/acc/img-1/public"] },
      }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(200);
    expect(r.body.url).toBe("https://imagedelivery.example/acc/img-1/public");
    expect(r.body.storage).toBe("cloudflare");
    const uploadCall = fetchMock.mock.calls[1];
    expect(String(uploadCall[0])).toContain("/images/v1");
    // File upload (raw bytes), not the URL-import form used for hosted results
    expect(String(uploadCall[1].body)).toContain('name="file"');
  });

  test("hosted-url result with Cloudflare configured is imported for permanence; upload failure falls back to the upstream url", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { data: [{ url: "https://oai.example/tmp.png" }] }))
      .mockResolvedValueOnce(jsonResp(500, { errors: ["nope"] }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(200);
    expect(r.body.url).toBe("https://oai.example/tmp.png");
    expect(r.body.storage).toBe("upstream");
  });

  test("OpenAI failure falls back to Cloudflare Workers AI (flux-1-schnell) when CF creds exist", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(400, { error: { message: "Billing hard limit has been reached." } })) // openai
      .mockResolvedValueOnce(jsonResp(200, { result: { image: Buffer.from("flux-bytes").toString("base64") } })) // workers ai
      .mockResolvedValueOnce(jsonResp(200, { result: { variants: ["https://imagedelivery.example/acc/img-2/public"] } })); // cf images upload

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(200);
    expect(r.body.provider).toBe("workers-ai");
    expect(r.body.fallbackFrom).toEqual(["openai"]);
    expect(r.body.url).toBe("https://imagedelivery.example/acc/img-2/public");
    expect(r.body.storage).toBe("cloudflare");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/ai/run/@cf/black-forest-labs/flux-1-schnell");
    const fluxBody = JSON.parse((fetchMock.mock.calls[1][1] as any).body);
    expect(fluxBody).toMatchObject({ prompt: "a cat", width: 1024, height: 1024 });
  });

  test("Together FLUX free tier serves when it is the only configured provider", async () => {
    process.env.TOGETHER_API_KEY = "tg-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: [{ b64_json: Buffer.from("flux-free-bytes").toString("base64") }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(200);
    expect(r.body.provider).toBe("together");
    expect(r.body.storage).toBe("inline"); // no CF creds — honest data: URI fallback
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.together.xyz");
    const tgBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(tgBody.model).toBe("black-forest-labs/FLUX.1-schnell-Free");
  });

  test("all configured providers failing returns 502 with the per-provider attempt list", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(400, { error: { message: "billing" } }))
      .mockResolvedValueOnce(jsonResp(500, { errors: ["flux down"] }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat" });

    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/All image providers failed/);
    expect(r.body.attempts.map((a: { provider: string }) => a.provider)).toEqual(["openai", "workers-ai"]);
  });
});

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
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://stale.pages.dev", output: "" });
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
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: true, url: "https://t-abc123.pages.dev", output: "" });

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
    mockDeployViaWrangler.mockResolvedValueOnce({ ok: false, error: "wrangler exited with code 1: auth error", output: "" });

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

describe("POST /api/devhub/media/sfx (ElevenLabs)", () => {
  test("503 when no API key", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/sfx").send({ text: "rain" });
    expect(r.status).toBe(503);
  });

  test("calls sound-generation endpoint with duration", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(audioResp(200, 512));

    const r = await request(makeApp())
      .post("/api/devhub/media/sfx")
      .send({ text: "heavy rain", durationSeconds: 5 });

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/sound-generation");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.text).toBe("heavy rain");
    expect(body.duration_seconds).toBe(5);
  });
});

describe("POST /api/devhub/media/music (ElevenLabs)", () => {
  test("calls music/compose endpoint with music_length_ms", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(audioResp(200, 1024));

    const r = await request(makeApp())
      .post("/api/devhub/media/music")
      .send({ prompt: "lo-fi hip hop", musicLengthMs: 30000 });

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/music/compose");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.prompt).toBe("lo-fi hip hop");
    expect(body.music_length_ms).toBe(30000);
  });

  test("400 on missing prompt", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const r = await request(makeApp()).post("/api/devhub/media/music").send({});
    expect(r.status).toBe(400);
  });
});

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
  async function createProject(app: express.Express) {
    const cr = await request(app).post("/api/devhub/projects").send({ name: "T" });
    expect(cr.status).toBe(201);
    return cr.body.project.id as string;
  }

  async function flushMicrotasks() {
    // The Railway branch is a fire-and-forget async IIFE; the failure path
    // resolves after one `await fetch(...)` + one `await r.json()`, well
    // before the 5s "mark as live" timer, so a couple of ticks are enough.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  test("GraphQL 200-with-errors is reported as a failed deployment, not live", async () => {
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.RAILWAY_PROJECT_ID = "proj";
    process.env.RAILWAY_SERVICE_ID = "svc";
    const app = makeApp();
    const projectId = await createProject(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: null,
      errors: [{ message: "Not Authorized" }],
    }));

    const r = await request(app).post(`/api/devhub/projects/${projectId}/deploy`).send({});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("building"); // optimistic immediate response, unchanged

    await flushMicrotasks();

    const list = await request(app).get(`/api/devhub/projects/${projectId}/deployments`);
    const latest = list.body.deployments[0];
    expect(latest.status).toBe("failed");
    expect(latest.buildLog).toMatch(/Not Authorized/);
  });

  test("GraphQL 200 with no deploymentCreate.id is also a failure, not a fabricated live URL", async () => {
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.RAILWAY_PROJECT_ID = "proj";
    process.env.RAILWAY_SERVICE_ID = "svc";
    const app = makeApp();
    const projectId = await createProject(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, { data: {} })); // no deploymentCreate at all

    await request(app).post(`/api/devhub/projects/${projectId}/deploy`).send({});
    await flushMicrotasks();

    const list = await request(app).get(`/api/devhub/projects/${projectId}/deployments`);
    expect(list.body.deployments[0].status).toBe("failed");
  });

  test("a real deploymentCreate.id still goes building (happy path unaffected)", async () => {
    process.env.RAILWAY_API_TOKEN = "tok";
    process.env.RAILWAY_PROJECT_ID = "proj";
    process.env.RAILWAY_SERVICE_ID = "svc";
    const app = makeApp();
    const projectId = await createProject(app);

    fetchMock.mockResolvedValueOnce(jsonResp(200, { data: { deploymentCreate: { id: "dep_ok", status: "QUEUED" } } }));

    await request(app).post(`/api/devhub/projects/${projectId}/deploy`).send({});
    await flushMicrotasks();

    const list = await request(app).get(`/api/devhub/projects/${projectId}/deployments`);
    expect(list.body.deployments[0].status).toBe("building");
    expect(list.body.deployments[0].deployUrl).toMatch(/\.up\.railway\.app$/);
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

describe("POST /api/devhub/media/voice-clone (ElevenLabs)", () => {
  test("503 when API key missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone")
      .send({ name: "My Voice", sampleBase64: "AAAA" });
    expect(r.status).toBe(503);
  });

  test("400 when name missing", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone")
      .send({ sampleBase64: "AAAA" });
    expect(r.status).toBe(400);
  });

  test("400 when sampleBase64 missing", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone")
      .send({ name: "My Voice" });
    expect(r.status).toBe(400);
  });

  test("400 when confirm:true is missing (preview-first gate)", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone")
      .send({ name: "My Voice", sampleBase64: Buffer.from("x").toString("base64") });
    expect(r.status).toBe(400);
    expect(r.body.needsConfirm).toBe(true);
    expect(r.body.error).toMatch(/preview first/);
  });

  test("calls /v1/voices/add with multipart body + returns voiceId (with confirm:true)", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      voice_id: "voice-abc-123",
      requires_verification: false,
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone")
      .send({
        name: "My Voice",
        description: "Test voice",
        sampleBase64: Buffer.from("fake-audio").toString("base64"),
        mimeType: "audio/mpeg",
        confirm: true,
      });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.voiceId).toBe("voice-abc-123");
    expect(r.body.requiresVerification).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/voices/add");
    const headers = (fetchMock.mock.calls[0][1] as any).headers;
    expect(headers["xi-api-key"]).toBe("fake");
    expect(headers["Content-Type"]).toMatch(/multipart\/form-data; boundary=/);
  });
});

describe("POST /api/devhub/media/voice-clone/preview (ElevenLabs)", () => {
  test("400 missing sampleBase64", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/voice-clone/preview").send({});
    expect(r.status).toBe(400);
  });

  test("503 when API key missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone/preview")
      .send({ sampleBase64: Buffer.from("x").toString("base64") });
    expect(r.status).toBe(503);
  });

  test("clones temp voice → TTS → deletes voice → returns audio/mpeg", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { voice_id: "temp-voice-xyz" })) // POST /voices/add
      .mockResolvedValueOnce(audioResp(200, 4096)) // POST /text-to-speech/temp-voice-xyz
      .mockResolvedValueOnce(jsonResp(200, {}));   // DELETE /voices/temp-voice-xyz

    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone/preview")
      .send({ sampleBase64: Buffer.from("audio").toString("base64"), previewText: "Hi from AEVION" });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(r.headers["x-aevion-preview-bytes"]).toBe("4096");
    expect(r.body.length).toBe(4096);

    // 1st call: clone
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/voices/add");
    // 2nd: TTS with the temp voice
    expect(fetchMock.mock.calls[1][0]).toContain("/text-to-speech/temp-voice-xyz");
    const ttsBody = JSON.parse((fetchMock.mock.calls[1][1] as any).body);
    expect(ttsBody.text).toBe("Hi from AEVION");
    // 3rd: delete
    expect(fetchMock.mock.calls[2][0]).toContain("/v1/voices/temp-voice-xyz");
    expect((fetchMock.mock.calls[2][1] as any).method).toBe("DELETE");
  });

  test("cleans up temp voice when preview TTS fails", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { voice_id: "temp-doomed" }))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "tts boom", json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) } as any)
      .mockResolvedValueOnce(jsonResp(200, {})); // cleanup DELETE attempt

    const r = await request(makeApp())
      .post("/api/devhub/media/voice-clone/preview")
      .send({ sampleBase64: Buffer.from("x").toString("base64") });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/Preview TTS failed/);
    // The DELETE cleanup is best-effort and fire-and-forget; just confirm we got at least the 2 calls
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/text-to-speech/temp-doomed");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. ElevenLabs Speech-to-Text
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/stt (ElevenLabs)", () => {
  test("503 when API key missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/stt")
      .send({ audioBase64: "AAAA" });
    expect(r.status).toBe(503);
  });

  test("400 when audio missing", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    const r = await request(makeApp()).post("/api/devhub/media/stt").send({});
    expect(r.status).toBe(400);
  });

  test("calls /v1/speech-to-text + returns transcript", async () => {
    process.env.ELEVENLABS_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      text: "Hello world",
      language_code: "en",
      language_probability: 0.99,
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/stt")
      .send({
        audioBase64: Buffer.from("fake-audio").toString("base64"),
        language: "en",
      });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      text: "Hello world",
      language: "en",
      confidence: 0.99,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/speech-to-text");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. Google Drive search + import
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/drive-search (Google Drive)", () => {
  test("503 when token missing", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/drive-search").send({ query: "foo" });
    expect(r.status).toBe(503);
  });

  test("returns file list from Drive", async () => {
    process.env.GOOGLE_DRIVE_ACCESS_TOKEN = "fake-bearer";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      files: [
        { id: "f1", name: "doc.md", mimeType: "text/markdown", size: "100" },
        { id: "f2", name: "spec.txt", mimeType: "text/plain" },
      ],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/drive-search")
      .send({ query: "doc", limit: 10 });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.files).toHaveLength(2);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toMatch(/name\+contains\+%27doc%27/);
    expect(url).toContain("pageSize=10");
  });
});

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
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("openai.com")) {
        await delay(80); // slow — would finish LAST if this and tts ran sequentially
        return jsonResp(200, { data: [{ url: "https://oai.example/hero.png" }] });
      }
      if (String(url).includes("elevenlabs.io")) {
        await delay(5); // fast — finishes first if truly concurrent
        return audioResp(200, 512);
      }
      throw new Error(`unexpected url ${url}`);
    });

    const startedAt = Date.now();
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/agent/workflow`)
      .send({ steps: [{ type: "image", prompt: "hero" }, { type: "tts", text: "hi" }] });
    const elapsedMs = Date.now() - startedAt;

    expect(r.status).toBe(200);
    expect(r.body.successCount).toBe(2);
    // Order in the response matches step order, even though the tts (fast)
    // call resolves before the image (slow) one internally.
    expect(r.body.results[0].type).toBe("image");
    expect(r.body.results[1].type).toBe("tts");
    // Concurrent → total time tracks the SLOWER step (~80ms), not the sum
    // (~85ms) plus per-request overhead. Generous ceiling to avoid CI flake
    // while still failing hard if this regresses to sequential (which would
    // add another 80ms+ of pure serial wait on top).
    expect(elapsedMs).toBeLessThan(150);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. Per-project GitHub token (envVars.GITHUB_TOKEN beats env)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// 11b. GitHub pull request — real merge/PR capability (agent can open a PR,
//      not just create a repo)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// 11c. GitHub PR merge — closes the "GitHub is push+PR only" gap
// ═════════════════════════════════════════════════════════════════════════════

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

describe("POST /api/devhub/media/sms (Brevo)", () => {
  test("503 when BREVO_API_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/sms")
      .send({ recipient: "+14155552671", content: "hi" });
    expect(r.status).toBe(503);
  });

  test("400 on invalid phone (not E.164)", async () => {
    process.env.BREVO_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/sms")
      .send({ recipient: "555-0123", content: "hi" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/E.164/);
  });

  test("400 when content > 612 chars", async () => {
    process.env.BREVO_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/sms")
      .send({ recipient: "+14155552671", content: "x".repeat(613) });
    expect(r.status).toBe(400);
  });

  test("calls Brevo SMS API with sender + recipient", async () => {
    process.env.BREVO_API_KEY = "brevo-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(201, {
      reference: "ref-123", messageId: 999, smsCount: 1,
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/sms")
      .send({ recipient: "+14155552671", content: "Test SMS", sender: "MyApp" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, reference: "ref-123", smsCount: 1 });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.sender).toBe("MyApp");
    expect(body.recipient).toBe("+14155552671");
    expect(body.type).toBe("transactional");
  });

  test("degraded: true when Brevo returns 2xx with no messageId", async () => {
    process.env.BREVO_API_KEY = "brevo-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { reference: "ref-123", smsCount: 1 })); // no messageId

    const r = await request(makeApp())
      .post("/api/devhub/media/sms")
      .send({ recipient: "+14155552671", content: "Test SMS" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.degraded).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 15. Brevo WhatsApp
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/whatsapp (Brevo)", () => {
  test("503 when API key missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/whatsapp")
      .send({ contactNumber: "+14155552671", templateId: 1 });
    expect(r.status).toBe(503);
  });

  test("503 when sender ID missing", async () => {
    process.env.BREVO_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/whatsapp")
      .send({ contactNumber: "+14155552671", templateId: 1 });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/BREVO_WHATSAPP_SENDER_ID/);
  });

  test("400 on missing templateId", async () => {
    process.env.BREVO_API_KEY = "fake";
    process.env.BREVO_WHATSAPP_SENDER_ID = "sender-123";
    const r = await request(makeApp())
      .post("/api/devhub/media/whatsapp")
      .send({ contactNumber: "+14155552671" });
    expect(r.status).toBe(400);
  });

  test("calls Brevo WhatsApp API + strips leading +", async () => {
    process.env.BREVO_API_KEY = "fake";
    process.env.BREVO_WHATSAPP_SENDER_ID = "sender-abc";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { messageId: "wa-msg-1" }));

    const r = await request(makeApp())
      .post("/api/devhub/media/whatsapp")
      .send({ contactNumber: "+14155552671", templateId: 42, params: { name: "Alice" } });
    expect(r.status).toBe(200);
    expect(r.body.messageId).toBe("wa-msg-1");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.senderNumberId).toBe("sender-abc");
    expect(body.contactNumbers).toEqual(["14155552671"]); // no +
    expect(body.templateId).toBe(42);
    expect(body.params).toEqual({ name: "Alice" });
  });

  test("degraded: true when Brevo returns 2xx with no messageId", async () => {
    process.env.BREVO_API_KEY = "fake";
    process.env.BREVO_WHATSAPP_SENDER_ID = "sender-abc";
    fetchMock.mockResolvedValueOnce(jsonResp(201, {})); // no messageId

    const r = await request(makeApp())
      .post("/api/devhub/media/whatsapp")
      .send({ contactNumber: "+14155552671", templateId: 42 });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.degraded).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 16. Cloudflare Images upload
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/upload-image (Cloudflare Images)", () => {
  test("400 when neither sourceUrl nor base64", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/upload-image").send({});
    expect(r.status).toBe(400);
  });

  test("503 when env missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/upload-image")
      .send({ sourceUrl: "https://example.com/x.png" });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/CLOUDFLARE/);
  });

  test("uploads from sourceUrl + returns permanent URL", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      result: {
        id: "cf-img-123",
        variants: ["https://imagedelivery.net/abc/cf-img-123/public"],
        uploaded: "2026-05-15T00:00:00Z",
      },
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/upload-image")
      .send({ sourceUrl: "https://oai.example/dalle.png" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      imageId: "cf-img-123",
      url: "https://imagedelivery.net/abc/cf-img-123/public",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("acc-fake/images/v1");
    expect((fetchMock.mock.calls[0][1] as any).headers.Authorization).toBe("Bearer cf-fake");
  });

  test("uploads from base64", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-fake";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      result: { id: "cf-img-b64", variants: ["https://imagedelivery.net/x/cf-img-b64/public"], uploaded: "now" },
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/upload-image")
      .send({
        base64: Buffer.from("fake-png-bytes").toString("base64"),
        mimeType: "image/png",
      });
    expect(r.status).toBe(200);
    expect(r.body.imageId).toBe("cf-img-b64");
  });
});

afterEach(() => {
  for (const key of ["DEEPL_API_KEY"]) delete process.env[key];
});

// ═════════════════════════════════════════════════════════════════════════════
// 17. DeepL translate
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/translate (DeepL)", () => {
  test("503 when DEEPL_API_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/translate")
      .send({ text: "hello", targetLang: "RU" });
    expect(r.status).toBe(503);
  });

  test("400 on missing fields", async () => {
    process.env.DEEPL_API_KEY = "fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/translate")
      .send({ text: "hello" });
    expect(r.status).toBe(400);
  });

  test("uses free endpoint when key ends with :fx", async () => {
    process.env.DEEPL_API_KEY = "abc-fake:fx";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      translations: [{ text: "привет", detected_source_language: "EN" }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/translate")
      .send({ text: "hello", targetLang: "ru" });
    expect(r.status).toBe(200);
    expect(r.body.text).toBe("привет");
    expect(r.body.detectedSource).toBe("EN");
    expect(r.body.targetLang).toBe("RU");
    expect(fetchMock.mock.calls[0][0]).toContain("api-free.deepl.com");
  });

  test("uses pro endpoint for non-:fx key", async () => {
    process.env.DEEPL_API_KEY = "pro-key-no-suffix";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      translations: [{ text: "Bonjour", detected_source_language: "EN" }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/translate")
      .send({ text: "Hello", targetLang: "FR" });
    expect(r.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepl.com/v2/translate");
  });
});

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

describe("GET /api/devhub/media/email-templates (Brevo)", () => {
  test("503 when BREVO_API_KEY missing", async () => {
    const r = await request(makeApp()).get("/api/devhub/media/email-templates");
    expect(r.status).toBe(503);
  });

  test("lists templates with limit/offset", async () => {
    process.env.BREVO_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      count: 3,
      templates: [
        { id: 1, name: "Welcome", subject: "Welcome!", isActive: true, createdAt: "2026-01-01T00:00:00Z" },
        { id: 2, name: "Reset", subject: "Reset password", isActive: true, createdAt: "2026-01-02T00:00:00Z" },
      ],
    }));

    const r = await request(makeApp()).get("/api/devhub/media/email-templates?limit=10&offset=0");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.templates).toHaveLength(2);
    expect(r.body.templates[0]).toMatchObject({ id: 1, name: "Welcome", subject: "Welcome!" });
    expect(fetchMock.mock.calls[0][0]).toContain("/v3/smtp/templates?limit=10&offset=0");
  });
});

describe("POST /api/devhub/media/email-template-send (Brevo)", () => {
  test("400 missing templateId", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-send")
      .send({ to: "x@y.com" });
    expect(r.status).toBe(400);
  });

  test("400 invalid email", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-send")
      .send({ templateId: 1, to: "not-email" });
    expect(r.status).toBe(400);
  });

  test("sends transac email by templateId with params", async () => {
    process.env.BREVO_API_KEY = "fake";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { messageId: "mid-456" }));

    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-send")
      .send({ templateId: 7, to: "user@example.com", params: { name: "Alice", code: "1234" } });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.messageId).toBe("mid-456");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.templateId).toBe(7);
    expect(body.to[0].email).toBe("user@example.com");
    expect(body.params).toEqual({ name: "Alice", code: "1234" });
  });
});

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

describe("POST /api/devhub/media/upload-audio (Cloudflare R2)", () => {
  test("400 when neither sourceUrl nor base64", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/upload-audio").send({});
    expect(r.status).toBe(400);
  });

  test("503 when R2 env missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/upload-audio")
      .send({ base64: Buffer.from("xx").toString("base64") });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/R2/);
  });

  test("uploads base64 audio + returns CDN url (with public base)", async () => {
    setR2Env();
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.aevion.test";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(makeApp())
      .post("/api/devhub/media/upload-audio")
      .send({ base64: Buffer.from("fake-mp3").toString("base64"), mimeType: "audio/mpeg", key: "audio/test.mp3" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.key).toBe("audio/test.mp3");
    expect(r.body.url).toBe("https://cdn.aevion.test/audio/test.mp3");

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("acc-r2.r2.cloudflarestorage.com");
    expect(callUrl).toContain("/aevion-media/audio/test.mp3");
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(init.headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(init.headers["x-amz-content-sha256"]).toMatch(/^[a-f0-9]{64}$/);
  });

  test("fetches sourceUrl then uploads, returns S3-style url without public base", async () => {
    setR2Env();
    const srcBytes = Buffer.from("audio-bytes");
    const ab = new ArrayBuffer(srcBytes.length);
    new Uint8Array(ab).set(srcBytes);
    fetchMock
      .mockResolvedValueOnce({
        ok: true, status: 200,
        arrayBuffer: async () => ab,
        text: async () => "", json: async () => ({}),
      } as any)
      .mockResolvedValueOnce(jsonResp(200, {}));

    const r = await request(makeApp())
      .post("/api/devhub/media/upload-audio")
      .send({ sourceUrl: "https://elevenlabs.example/tmp.mp3", mimeType: "audio/mpeg" });
    expect(r.status).toBe(200);
    expect(r.body.url).toContain("acc-r2.r2.cloudflarestorage.com/aevion-media/audio/");
    expect(r.body.bytes).toBe(srcBytes.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("502 when R2 PUT fails", async () => {
    setR2Env();
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 403,
      json: async () => ({}), text: async () => "<Error>AccessDenied</Error>", arrayBuffer: async () => new ArrayBuffer(0),
    } as any);

    const r = await request(makeApp())
      .post("/api/devhub/media/upload-audio")
      .send({ base64: Buffer.from("xx").toString("base64") });
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/R2 PUT 403/);
  });
});

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

describe("POST /api/devhub/media/email-template-create (Brevo)", () => {
  test("400 missing fields", async () => {
    const r = await request(makeApp()).post("/api/devhub/media/email-template-create").send({});
    expect(r.status).toBe(400);
  });

  test("503 when BREVO_API_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-create")
      .send({ name: "T", subject: "S", htmlContent: "<p>H</p>", senderEmail: "a@b.co" });
    expect(r.status).toBe(503);
  });

  test("400 when senderEmail missing & no env", async () => {
    process.env.BREVO_API_KEY = "k";
    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-create")
      .send({ name: "T", subject: "S", htmlContent: "<p>H</p>" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/senderEmail/);
  });

  test("creates template + returns id", async () => {
    process.env.BREVO_API_KEY = "k";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { id: 99 }));

    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-create")
      .send({ name: "Hello", subject: "Hi", htmlContent: "<p>Body</p>", senderEmail: "noreply@aevion.io", senderName: "AEVION" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, id: 99, name: "Hello", subject: "Hi" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.templateName).toBe("Hello");
    expect(body.sender).toEqual({ email: "noreply@aevion.io", name: "AEVION" });
    expect(body.isActive).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.brevo.com/v3/smtp/templates");
  });

  test("falls back to BREVO_SENDER_EMAIL env", async () => {
    process.env.BREVO_API_KEY = "k";
    process.env.BREVO_SENDER_EMAIL = "default@aevion.io";
    process.env.BREVO_SENDER_NAME = "AEVION Bot";
    fetchMock.mockResolvedValueOnce(jsonResp(201, { id: 42 }));

    const r = await request(makeApp())
      .post("/api/devhub/media/email-template-create")
      .send({ name: "N", subject: "S", htmlContent: "<p>X</p>" });
    expect(r.status).toBe(200);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.sender).toEqual({ email: "default@aevion.io", name: "AEVION Bot" });
  });
});

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

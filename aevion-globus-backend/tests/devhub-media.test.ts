/**
 * DevHub media routes — split out of devhub-integrations.test.ts (issue #978).
 *
 * The parent file had grown past 4500 lines and every parallel PR touching it
 * conflicted at the tail. Splitting was blocked until the cross-file
 * interference was understood: deploy routes scheduled post-deploy checks that
 * outlived their test and ate a later one's mocked fetch (issue #982). With
 * those timers cancelled in afterEach, the files can finally stand apart.
 *
 * The harness below is duplicated rather than shared: vi.mock is hoisted per
 * file and cannot come from a helper module.
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Предел отправки поднимается ДО импорта роутера — иначе он не подействует.
 *
 * `dhSendLimit()` читает `DEVHUB_SEND_RATE_LIMIT` при вычислении модуля, а импорты
 * хойстятся выше любого присваивания в теле файла. Поэтому значение ставится внутри
 * `vi.hoisted`, который выполняется раньше импортов.
 *
 * ЗАЧЕМ поднимать. Боевое умолчание — 5 отправок в минуту, и оно правильное: у
 * почтового провайдера потолок 300 писем в сутки, то есть с одного адреса суточная
 * квота платформы выжигается за час. Но этот файл проверяет ФОРМУ запросов к
 * провайдеру — коды ошибок, валидацию телефона, состав тела — и делает это двумя
 * десятками вызовов подряд. С боевым пределом тринадцать проверок возвращали 429,
 * то есть файл перестал проверять то, для чего написан.
 */
vi.hoisted(() => {
  process.env.DEVHUB_SEND_RATE_LIMIT = "1000";
});

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
function setR2Env() {
  process.env.CLOUDFLARE_R2_ACCOUNT_ID = "acc-r2";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "ak-r2";
  process.env.CLOUDFLARE_R2_SECRET_KEY = "sk-r2";
  process.env.CLOUDFLARE_R2_BUCKET = "aevion-media";
}

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
    // Was pinned to eleven_monolingual_v1 — a model ElevenLabs has since
    // REMOVED. The test stayed green while prod voice was fully broken, which
    // is why this now tracks the model we actually send.
    expect(body.model_id).toBe("eleven_multilingual_v2");
  });
});

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
    // The message now names the fix instead of restating the failure: this
    // mock is a billing rejection, so it must read as a blocked provider
    // rather than a bad prompt.
    expect(r.body.providersBlocked).toBe(true);
    expect(r.body.error).toMatch(/not your prompt/);
    expect(r.body.attempts.map((a: { provider: string }) => a.provider)).toEqual(["openai", "workers-ai"]);
  });
});

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


describe("media capabilities report what the provider actually did", () => {
  // Until now only image and video recorded outcomes, so voice kept reading
  // "live" through the weeks its model had been removed, and translation read
  // "live" while DeepL answered 456 to every call. Both are one call away from
  // the truth — the call was already being made.
  test("a failing ElevenLabs call marks the voice capability degraded", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.ELEVENLABS_API_KEY = "el-test";
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid api key" } as any);

    const r = await request(makeApp()).post("/api/devhub/media/tts").send({ text: "привет" });
    expect(r.status).toBe(401);
    const h = getProviderHealth("audio_tts");
    expect(h?.ok).toBe(false);
    expect(h?.reason).toMatch(/401|invalid api key/i);
    __resetProviderHealth();
  });

  test("a working ElevenLabs call clears it again", async () => {
    const { __resetProviderHealth, getProviderHealth, noteProviderFailure } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    noteProviderFailure("audio_tts", "stale failure from an earlier call");
    process.env.ELEVENLABS_API_KEY = "el-test";
    fetchMock.mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(64) } as any);

    const r = await request(makeApp()).post("/api/devhub/media/tts").send({ text: "привет" });
    expect(r.status).toBe(200);
    expect(getProviderHealth("audio_tts")?.ok).toBe(true);
    __resetProviderHealth();
  });

  test("DeepL's 456 marks translation degraded with its own reason", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.DEEPL_API_KEY = "dl-test";
    fetchMock.mockResolvedValue({ ok: false, status: 456, text: async () => "Quota exceeded" } as any);

    const r = await request(makeApp()).post("/api/devhub/media/translate").send({ text: "привет", targetLang: "EN" });
    expect(r.status).toBe(456);
    const h = getProviderHealth("translate");
    expect(h?.ok).toBe(false);
    expect(h?.reason).toMatch(/quota/i);
    __resetProviderHealth();
  });
});


describe("Brevo capabilities report delivery, not key presence", () => {
  // The three Brevo capabilities all read "live" from one env var. Brevo has
  // answered 401 from some IPs and 2xx-without-messageId on soft failures —
  // neither ever reached the shop window.
  test("a Brevo rejection marks email degraded", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.BREVO_API_KEY = "brevo-test";
    process.env.BREVO_SENDER_EMAIL = "noreply@test.aevion.dev";
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorised IP" } as any);

    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "a@test.aevion.dev", subject: "hi", htmlBody: "<p>hi</p>" });

    expect(r.status).toBe(401);
    const h = getProviderHealth("email");
    expect(h?.ok).toBe(false);
    expect(h?.reason).toMatch(/401|unauthorised/i);
    __resetProviderHealth();
  });

  test("a 2xx with no messageId is a failure too, not a green light", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.BREVO_API_KEY = "brevo-test";
    process.env.BREVO_SENDER_EMAIL = "noreply@test.aevion.dev";
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}), text: async () => "{}" } as any);

    const r = await request(makeApp())
      .post("/api/devhub/media/email")
      .send({ to: "a@test.aevion.dev", subject: "hi", htmlBody: "<p>hi</p>" });

    expect(r.status).toBe(200);
    expect(r.body.degraded).toBe(true);
    expect(getProviderHealth("email")?.ok).toBe(false);
    __resetProviderHealth();
  });
});


describe("music reports the capability, not one provider", () => {
  test("a MusicGen fallback still counts as working", async () => {
    // Crying "degraded" while the user is holding a track would train people
    // to ignore the strip.
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.ELEVENLABS_API_KEY = "el-test";
    process.env.REPLICATE_API_TOKEN = "rep-test";
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("elevenlabs")
        ? { ok: false, status: 429, text: async () => "rate limited" }
        : { ok: true, status: 201, json: async () => ({ id: "pred-1", status: "starting" }), text: async () => "{}" },
    );

    const r = await request(makeApp()).post("/api/devhub/media/music").send({ prompt: "lofi" });
    expect(r.status).toBe(200);
    expect(r.body.provider).toMatch(/musicgen/i);
    expect(getProviderHealth("audio_music")?.ok).toBe(true);
    __resetProviderHealth();
  });

  test("both providers out is a real failure", async () => {
    const { __resetProviderHealth, getProviderHealth } = await import("../src/lib/providerHealth");
    __resetProviderHealth();
    process.env.ELEVENLABS_API_KEY = "el-test";
    delete process.env.REPLICATE_API_TOKEN; // no fallback available
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" } as any);

    const r = await request(makeApp()).post("/api/devhub/media/music").send({ prompt: "lofi" });
    expect(r.status).toBe(429);
    const h = getProviderHealth("audio_music");
    expect(h?.ok).toBe(false);
    expect(h?.reason).toMatch(/no MusicGen fallback/i);
    __resetProviderHealth();
  });
});

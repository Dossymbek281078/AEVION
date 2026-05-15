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
  getProviders: () => [],
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

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
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    "GITHUB_TOKEN", "VERCEL_API_TOKEN", "ELEVENLABS_API_KEY",
    "BREVO_API_KEY", "STRIPE_SECRET_KEY", "OPENAI_API_KEY",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID",
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
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Stripe Payment Link
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/media/payment-link (Stripe)", () => {
  test("503 when STRIPE_SECRET_KEY missing", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro", amountCents: 999 });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/STRIPE_SECRET_KEY/);
  });

  test("400 when amount < 50 cents", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro", amountCents: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/≥ 50/);
  });

  test("calls Stripe 3 times in sequence: product → price → payment_link", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    fetchMock
      .mockResolvedValueOnce(jsonResp(200, { id: "prod_123" }))
      .mockResolvedValueOnce(jsonResp(200, { id: "price_456" }))
      .mockResolvedValueOnce(jsonResp(200, { id: "plink_789", url: "https://buy.stripe.com/test_789" }));

    const r = await request(makeApp())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Pro plan", amountCents: 999, currency: "usd", description: "Monthly" });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      paymentLinkId: "plink_789",
      url: "https://buy.stripe.com/test_789",
      productId: "prod_123",
      priceId: "price_456",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/products");
    expect(fetchMock.mock.calls[1][0]).toContain("/v1/prices");
    expect(fetchMock.mock.calls[2][0]).toContain("/v1/payment_links");
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

  test("calls OpenAI Images API with dall-e-3 + returns URL", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    fetchMock.mockResolvedValueOnce(jsonResp(200, {
      data: [{ url: "https://oaidalleapi.example/img.png", revised_prompt: "A cat sitting" }],
    }));

    const r = await request(makeApp())
      .post("/api/devhub/media/image")
      .send({ prompt: "a cat", size: "1024x1024", quality: "hd", style: "natural" });

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.url).toBe("https://oaidalleapi.example/img.png");
    expect(r.body.revisedPrompt).toBe("A cat sitting");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.model).toBe("dall-e-3");
    expect(body.quality).toBe("hd");
    expect(body.style).toBe("natural");
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

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
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_PUBLIC_URL",
    "DEEPL_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME",
    "GOOGLE_DRIVE_ACCESS_TOKEN",
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

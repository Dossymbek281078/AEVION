/**
 * Загрузки медиа гостя — с суточным потолком по адресу.
 *
 * 15.09.2026: /media/upload-image (Cloudflare Images, платно за штуку) и
 * /media/upload-audio (R2, до 25 МБ) открыты гостю без кредита; ограничитель
 * 30/мин пропускал 43 200 загрузок в сутки с одного адреса. Закреплено (предел стенда 20,
 * боевой по умолчанию 60): 20-я загрузка проходит, 21-я — 429 с текстом про сутки; с другого
 * адреса — проходит (контроль: потолок по адресу, а не общий).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Пределы читаются при загрузке модуля, поэтому переменные — ДО импорта роутера:
// суточный потолок 20 (меньше минутного 30, чтобы мерить именно его).
const { mockQuery } = vi.hoisted(() => { process.env.DEVHUB_UPLOAD_DAILY_LIMIT = "20"; return { mockQuery: vi.fn() }; });
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
const ENV = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
const было: Record<string, string | undefined> = {};

function makeApp(ip: string) {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => { req.headers["x-forwarded-for"] = ip; next(); });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => {
  __resetDevHubStore();
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ result: { id: "img", variants: ["https://imagedelivery.net/a/img/public"], uploaded: "2026-09-15T00:00:00Z" } }), text: async () => "" }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
});

const upload = (app: express.Express) => request(app).post("/api/devhub/media/upload-image").send({ sourceUrl: "https://example.com/x.png" });

describe("суточный потолок загрузок по адресу", () => {
  test("20 загрузок с адреса проходят (предел стенда), 21-я — 429 про сутки; с другого адреса — проходит", async () => {
    const same = makeApp("203.0.113.21");
    for (let i = 0; i < 20; i++) {
      const r = await upload(same);
      expect(r.status, `загрузка ${i + 1}: ${JSON.stringify(r.body)}`).toBe(200);
    }
    const over = await upload(same);
    expect(over.status).toBe(429);
    expect(String(over.body.error ?? over.body.message ?? "")).toMatch(/Суточный|сутки|завтра/);

    const other = makeApp("198.51.100.21");
    expect((await upload(other)).status, "потолок должен быть по адресу, а не общий").toBe(200);
  });
});

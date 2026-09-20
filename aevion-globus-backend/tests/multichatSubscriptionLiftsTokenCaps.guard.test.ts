import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Покупка Multichat ($40/мес) должна что-то ОТКРЫВАТЬ (20.09.2026, день запуска).
 *
 * Замер прода: вебхук писал покупку в AppSubscription, а дальше её никто не
 * читал — модуль вне платной стены, потолки токенов считались по тарифу
 * планеты. Покупатель получал ровно то же, что гость: «заплатил — и ничего».
 *
 * Сторож закрепляет смысл покупки: подписка снимает месячный потолок токенов
 * (сторож /chat) и премиум-потолок, а ручка /me/token-quota честно показывает
 * это же (appPass, metered=false). Контроль: без подписки тот же человек над
 * потолком получает 402 — значит потолок настоящий, а не выключенный.
 *
 * Мутация «убрать hasMultichatPass из monthlyQuotaHeadroom» обязана красить
 * случай 2. Отказ чтения базы читается как «нет подписки» (случай 4).
 */

const { mockQuery, providerMock } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  providerMock: vi.fn(),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/services/qcoreai/store", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getMonthlyTokens: vi.fn(async () => 1_000_000),
    getMonthlyPremiumTokens: vi.fn(async () => 0),
    addTokenUsage: vi.fn(async () => undefined),
  };
});
vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    resolveProvider: () => "gemini",
    getProviders: () => [{ id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash", envKey: "GEMINI_API_KEY", configured: true, free: false, tier: "free" }],
    callProviderResilient: providerMock,
    callProvider: providerMock,
  };
});

// eslint-disable-next-line import/first
import { qcoreaiRouter } from "../src/routes/qcoreai";
// eslint-disable-next-line import/first
import { resetAppEntitlementsCache } from "../src/lib/appEntitlements";

const SECRET = "test-secret-multichat-pass";
const BUYER = "buyer@example.com";
const OTHER = "someone@example.com";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qcoreai", qcoreaiRouter);
  return a;
}
function bearer(email: string) {
  return `Bearer ${jwt.sign({ sub: `u-${email}`, email, role: "user" }, SECRET, { algorithm: "HS256", expiresIn: "1h" })}`;
}
function dbWithSubscriptionFor(email: string, mode: "ok" | "down" = "ok") {
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (mode === "down" && /SELECT "appSlug"/.test(sql)) throw new Error("db down (probe)");
    if (/SELECT "appSlug"/.test(sql)) {
      return { rows: String(params?.[0] ?? "").toLowerCase() === email ? [{ appSlug: "multichat" }] : [] };
    }
    return { rows: [] };
  });
}

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ["AUTH_JWT_SECRET", "QCOREAI_FREE_QUOTA", "QCOREAI_FREE_TOKENS_PER_MONTH", "QCOREAI_PREMIUM_QUOTA"]) saved[k] = process.env[k];
  process.env.AUTH_JWT_SECRET = SECRET;
  process.env.QCOREAI_FREE_QUOTA = "1";
  process.env.QCOREAI_FREE_TOKENS_PER_MONTH = "100000";
  delete process.env.QCOREAI_PREMIUM_QUOTA;
  resetAppEntitlementsCache();
  mockQuery.mockReset();
  providerMock.mockReset();
  providerMock.mockResolvedValue({ reply: "PROBE-OK", model: "gemini-2.5-flash", usage: { input_tokens: 5, output_tokens: 2 } });
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const CHAT = { messages: [{ role: "user", content: "Reply with exactly: PROBE-OK" }] };

describe("подписка Multichat снимает месячные потолки токенов", () => {
  test("1. КОНТРОЛЬ: без подписки вошедший над потолком получает 402 — потолок настоящий", async () => {
    dbWithSubscriptionFor(BUYER);
    const r = await request(app()).post("/api/qcoreai/chat").set("Authorization", bearer(OTHER)).send(CHAT);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("upgrade_required");
    expect(providerMock).not.toHaveBeenCalled();
  });

  test("2. с подпиской тот же запрос над потолком проходит к модели", async () => {
    dbWithSubscriptionFor(BUYER);
    const r = await request(app()).post("/api/qcoreai/chat").set("Authorization", bearer(BUYER)).send(CHAT);
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe("PROBE-OK");
    expect(providerMock).toHaveBeenCalledTimes(1);
  });

  test("3. ручка квоты говорит то же, что сторож: appPass и metered=false", async () => {
    dbWithSubscriptionFor(BUYER);
    const buyer = await request(app()).get("/api/qcoreai/me/token-quota").set("Authorization", bearer(BUYER));
    expect(buyer.status).toBe(200);
    expect(buyer.body.appPass).toBe("multichat");
    expect(buyer.body.metered).toBe(false);
    expect(buyer.body.limitTokens).toBeNull();

    const other = await request(app()).get("/api/qcoreai/me/token-quota").set("Authorization", bearer(OTHER));
    expect(other.body.appPass).toBeUndefined();
    expect(other.body.metered).toBe(true);
    expect(other.body.exceeded).toBe(true);
  });

  test("4. база не читается → как «нет подписки»: потолок остаётся, безлимит по ошибке не раздаётся", async () => {
    dbWithSubscriptionFor(BUYER, "down");
    const r = await request(app()).post("/api/qcoreai/chat").set("Authorization", bearer(BUYER)).send(CHAT);
    expect(r.status).toBe(402);
  });
});

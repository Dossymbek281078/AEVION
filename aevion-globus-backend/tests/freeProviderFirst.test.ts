/**
 * Публичные ИИ-ручки должны брать БЕСПЛАТНОГО провайдера, когда он настроен.
 *
 * Почему это отдельный тест. В списке провайдеров первым стоит anthropic, и он
 * платный. Шаблон `getProviders().find(p => p.configured)` — «первый
 * настроенный» — поэтому в проде всегда выбирал платного, и публичные ручки
 * тратили деньги на каждом анонимном вызове. Исправлено 28.07.2026 в qjobs
 * (36bd8e01) и qreal (f9d20d19), но исправление без сторожа — обещание:
 * достаточно одной правки, чтобы всё вернулось молча.
 *
 * Тест держит именно ВЫБОР провайдера, а не работу ручки целиком.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "crypto";

/** Ручка требует токен — без него 401 и до провайдера дело не доходит. */
function signJwt(sub: string, secret = "dev-auth-secret"): string {
  const b = (x: Buffer) => x.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const h = b(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b(Buffer.from(JSON.stringify({ sub, iat: Math.floor(Date.now() / 1000) })));
  return `${h}.${p}.${b(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest())}`;
}
const TOKEN = signJwt("matcher-1");

const { callProviderMock } = vi.hoisted(() => ({ callProviderMock: vi.fn() }));

/** Настроены оба: платный первым (как в реальном списке) и бесплатный вторым. */
const PAID = { id: "anthropic", free: false, configured: true, defaultModel: "claude-haiku" };
const FREE = { id: "groq", free: true, configured: true, defaultModel: "llama-free" };

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [PAID, FREE],
  getFreeProviders: () => [FREE],
  pickConfiguredProvider: () => PAID.id, // как ведёт себя общий resolveProvider без предпочтения
  resolveProvider: () => PAID.id,
  callProvider: callProviderMock,
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  }),
}));

vi.mock("../src/lib/ensureQJobsTables", () => ({
  isQJobsDbReady: () => false,
  getQJobsDbError: () => null,
  ensureQJobsTables: async () => {},
}));

// eslint-disable-next-line import/first
import { qjobsRouter } from "../src/routes/qjobs";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qjobs", qjobsRouter);
  return a;
}

let ipSeq = 0;
const match = () =>
  request(app())
    .post("/api/qjobs/ai/match")
    .set("X-Forwarded-For", `198.51.100.${(ipSeq += 1)}`)
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ skills: ["ts"], experience: "3 года" });

beforeEach(() => {
  callProviderMock.mockReset();
  callProviderMock.mockResolvedValue({ reply: "[]" });
});

describe("qjobs /ai/match выбирает бесплатного провайдера", () => {
  test("вызов уходит в бесплатного, хотя платный настроен и стоит первым", async () => {
    await match();
    expect(callProviderMock).toHaveBeenCalled();
    expect(callProviderMock.mock.calls[0][0]).toBe(FREE.id);
  });

  test("платный провайдер не вызывается вовсе", async () => {
    await match();
    const used = callProviderMock.mock.calls.map((c) => c[0]);
    expect(used).not.toContain(PAID.id);
  });

  test("ручка ограничена по частоте: одиннадцатый запрос с одного адреса не проходит", async () => {
    const ip = "203.0.113.77";
    const hit = () =>
      request(app())
        .post("/api/qjobs/ai/match")
        .set("X-Forwarded-For", ip)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ skills: ["ts"], experience: "3 года" });
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await hit()).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });
});

import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "node:fs";
import path from "node:path";

/**
 * Согласие на письма с новостями и предложениями (4.11.2026).
 * Регистрация без галочки — НЕ согласие; отписка по ссылке из письма работает
 * и не принимает чужой токен.
 */

const calls: { sql: string; params?: unknown[] }[] = [];
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ c: 5 }] };
      return { rows: [], rowCount: 1 };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";
// eslint-disable-next-line import/first
import { parseMarketingConsent, marketingToken, marketingUnsubscribeUrl, verifyMarketingToken } from "../src/lib/marketingConsent";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};

describe("parseMarketingConsent: только строгое true", () => {
  test("true — согласие; всё остальное — нет", () => {
    expect(parseMarketingConsent({ marketingConsent: true })).toBe(true);
    expect(parseMarketingConsent({ marketingConsent: "true" })).toBe(false);
    expect(parseMarketingConsent({ marketingConsent: 1 })).toBe(false);
    expect(parseMarketingConsent({})).toBe(false);
    expect(parseMarketingConsent(undefined)).toBe(false);
  });
});

describe("токен отписки", () => {
  beforeEach(() => { process.env.AUTH_JWT_SECRET = "x".repeat(32); delete process.env.WAITLIST_UNSUB_SECRET; });

  test("токен привязан к адресу и не зависит от регистра", () => {
    const t = marketingToken("Ann@Mail.com")!;
    expect(verifyMarketingToken("ann@mail.com", t)).toBe(true);
    expect(verifyMarketingToken("bob@mail.com", t)).toBe(false);
    expect(verifyMarketingToken("ann@mail.com", "0".repeat(32))).toBe(false);
    expect(verifyMarketingToken("ann@mail.com", undefined)).toBe(false);
  });

  test("токен списка ожидания (приставка unsub:) не отписывает от рассылки", async () => {
    const { unsubToken } = await import("../src/lib/waitlistUnsubToken");
    expect(verifyMarketingToken("ann@mail.com", unsubToken("ann@mail.com"))).toBe(false);
  });

  test("ссылка отписки содержит адрес и токен; без секрета ссылки нет", () => {
    const u = marketingUnsubscribeUrl("ann@mail.com")!;
    expect(u).toContain("/api/auth/marketing/unsubscribe?email=ann%40mail.com&t=");
    delete process.env.AUTH_JWT_SECRET;
    expect(marketingUnsubscribeUrl("ann@mail.com")).toBeNull();
  });
});

describe("регистрация и отписка по ручкам", () => {
  beforeEach(() => { calls.length = 0; process.env.AUTH_JWT_SECRET = "x".repeat(32); delete process.env.WAITLIST_UNSUB_SECRET; });

  const insertParams = () => calls.find((c) => /INSERT INTO "AEVIONUser"/.test(c.sql))?.params;

  test("без галочки в базу уходит marketingConsent=false", async () => {
    await request(app()).post("/register").send({ email: "a@b.co", password: "secret1", name: "A" });
    expect(insertParams()?.[5]).toBe(false);
  });

  test("со строкой \"true\" вместо булева согласия нет", async () => {
    await request(app()).post("/register").send({ email: "a@b.co", password: "secret1", name: "A", marketingConsent: "true" });
    expect(insertParams()?.[5]).toBe(false);
  });

  test("с галочкой true в базу уходит согласие", async () => {
    await request(app()).post("/register").send({ email: "a@b.co", password: "secret1", name: "A", marketingConsent: true });
    expect(insertParams()?.[5]).toBe(true);
  });

  test("миграция только добавляет столбцы, по умолчанию FALSE", () => {
    // Создание таблиц выполняется один раз на процесс, поэтому проверяем текст миграции.
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "auth.ts"), "utf8");
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMPTZ/);
    const block = src.slice(src.indexOf('"marketingConsent" BOOLEAN') - 200, src.indexOf('"marketingConsentAt" TIMESTAMPTZ') + 120);
    expect(block).not.toMatch(/DROP |DELETE |UPDATE "AEVIONUser"/);
  });

  test("отписка с верным токеном выключает согласие", async () => {
    const t = marketingToken("ann@mail.com");
    const r = await request(app()).get("/marketing/unsubscribe").query({ email: "ann@mail.com", t });
    expect(r.status).toBe(200);
    const upd = calls.find((c) => /SET "marketingConsent" = FALSE/.test(c.sql));
    expect(upd?.params).toEqual(["ann@mail.com"]);
  });

  test("отписка с чужим токеном — 400 и базу не трогает", async () => {
    const r = await request(app()).get("/marketing/unsubscribe").query({ email: "ann@mail.com", t: "0".repeat(32) });
    expect(r.status).toBe(400);
    expect(calls.some((c) => /SET "marketingConsent"/.test(c.sql))).toBe(false);
  });

  test("нет секрета — 503, а не молчаливый успех", async () => {
    delete process.env.AUTH_JWT_SECRET;
    const r = await request(app()).get("/marketing/unsubscribe").query({ email: "ann@mail.com", t: "x" });
    expect(r.status).toBe(503);
  });

  test("выключатель в кабинете без входа — 401", async () => {
    const r = await request(app()).patch("/me/marketing-consent").send({ consent: true });
    expect(r.status).toBe(401);
  });
});

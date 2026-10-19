/**
 * 🔴 Волна 2 (19.10.2026): «вход → оплата → использование» для QRight и Биржи стартапов.
 *
 * Замер прода 19:22 (оркестратор): из 44 модулей платой закрыто 6, для QRight и Биржи
 * оплата ничего не открывала. Разворачиваем бесплатную норму + платное действие:
 *   • qright_register — POST /api/pipeline/protect (именно сюда шлёт витрина /qright,
 *     а не в POST /api/qright/objects) и /protect-batch (пакет = одно действие);
 *   • startup_publish — POST /api/startupx/ideas (просмотр, RSS, интерес — бесплатно).
 * Правила freeActionQuota: спит без PAID_ACTIONS; платящий проходит всегда; сбой счёта
 * не запирает. Здесь: норма исчерпана → 402 free_quota_exceeded ДО записи; спит → счётчик
 * не спрашивается и 402 нет.
 */
import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const каталогПодписок = mkdtempSync(join(tmpdir(), "aevion-wave2-"));
process.env.SUBSCRIPTIONS_FILE = join(каталогПодписок, "subscriptions.jsonl");
writeFileSync(process.env.SUBSCRIPTIONS_FILE, "", "utf8");
process.env.AUTH_JWT_SECRET = "test-secret-dlya-volny-2-32-znaka-i-bolshe-xx";
process.env.QSIGN_SECRET = "test-secret-wave2";

const { запросы, mockQuery } = vi.hoisted(() => ({ запросы: [] as string[], mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { pipelineRouter } = await import("../src/routes/pipeline");
const { startupExchangeRouter } = await import("../src/routes/startupExchange");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  a.use("/api/startupx", startupExchangeRouter);
  return a;
}
let использовано = 0;
beforeEach(() => {
  запросы.length = 0;
  использовано = 0;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const текст = String(sql);
    запросы.push(текст.slice(0, 60));
    if (/INSERT INTO "FreeActionUsage"/.test(текст)) { использовано += 1; return { rows: [{ count: использовано }] }; }
    return { rows: [] };
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  delete process.env.PAID_ACTIONS;
  delete process.env.FREE_QRIGHT_REGISTER_PER_MONTH;
  delete process.env.FREE_STARTUP_PUBLISH_PER_MONTH;
});
afterAll(() => { rmSync(каталогПодписок, { recursive: true, force: true }); });

const регистрация = () =>
  request(приложение()).post("/api/pipeline/protect").send({ title: "Проба нормы", description: "описание для проверки нормы регистраций", kind: "text" });
const публикация = () =>
  request(приложение()).post("/api/startupx/ideas").send({
    title: "Проба нормы публикаций", tier: "idea", oneLiner: "Сервис для проверки нормы публикаций на бирже стартапов",
    description: "Описание идеи достаточной длины, чтобы пройти проверку полей и дойти до нормы действий. ".repeat(3),
    sector: "other", stage: "idea", email: "founder@example.test",
    deal: { intent: "raise", askUsd: 50000, equityOfferedPct: 10 },
  });

describe("QRight: регистрация — платное действие qright_register", () => {
  test("норма исчерпана → 402 free_quota_exceeded ДО записи сертификата", async () => {
    process.env.PAID_ACTIONS = "qright_register";
    process.env.FREE_QRIGHT_REGISTER_PER_MONTH = "1";
    использовано = 5; // уже больше нормы
    const r = await регистрация();
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(402);
    expect(r.body.error).toBe("free_quota_exceeded");
    expect(r.body.module).toBe("qright");
    expect(String(r.body.upgradeUrl)).toContain("/pricing");
    expect(запросы.some((q) => /INSERT INTO "IPCertificate"/.test(q)), "сертификат записан несмотря на 402").toBe(false);
  });
  test("пакет /protect-batch — то же действие, 402 до записи", async () => {
    process.env.PAID_ACTIONS = "qright_register";
    process.env.FREE_QRIGHT_REGISTER_PER_MONTH = "1";
    использовано = 5;
    const r = await request(приложение()).post("/api/pipeline/protect-batch").send({ items: [{ title: "а", description: "б", kind: "text" }] });
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("free_quota_exceeded");
  });
  test("КОНТРОЛЬ: действие не названо в PAID_ACTIONS — счётчик не спрашивается и 402 нет", async () => {
    const r = await регистрация();
    expect(r.status).not.toBe(402);
    expect(запросы.some((q) => /FreeActionUsage/.test(q)), "счётчик опрошен при спящем механизме").toBe(false);
  });
});

describe("Биржа стартапов: публикация — платное действие startup_publish", () => {
  test("норма исчерпана → 402 free_quota_exceeded ДО сохранения карточки", async () => {
    process.env.PAID_ACTIONS = "startup_publish";
    process.env.FREE_STARTUP_PUBLISH_PER_MONTH = "1";
    использовано = 5;
    const r = await публикация();
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(402);
    expect(r.body.error).toBe("free_quota_exceeded");
    expect(r.body.module).toBe("startup-exchange");
  });
  test("КОНТРОЛЬ: спит без PAID_ACTIONS — 402 нет, счётчик не спрашивается", async () => {
    const r = await публикация();
    expect(r.status).not.toBe(402);
    expect(запросы.some((q) => /FreeActionUsage/.test(q))).toBe(false);
  });
});

import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Оплаченный тариф доезжает до человека, который зарегистрировался ПОСЛЕ
 * оплаты.
 *
 * Так устроена выдача: вебхук платёжной системы знает только адрес почты и
 * паркует тариф в "DevHubEmailTier". Модуль же спрашивает тариф по
 * идентификатору. Связывает их одно чтение с JOIN по адресу учётной записи —
 * и оно НЕ БЫЛО ПОКРЫТО НИЧЕМ (замер 29.08.2026: семь тестов на вебхук,
 * ноль на подхват).
 *
 * Сломайся это чтение — покупка проходит, деньги списываются, а человек
 * видит бесплатный тариф. Дефект того же вида, что уже найден для ГОСТЯ
 * (у гостя учётной записи нет вовсе — это отдельный, продуктовый вопрос).
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

function makeApp() {
  return express().use(express.json()).use("/api/devhub", devhubRouter);
}

describe("оплата, сделанная до регистрации, доезжает до тарифа", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test("прибор исправен: без записи по почте человек на бесплатном", async () => {
    // Отрицательный контроль. Без него «pro» ниже мог бы означать, что
    // модуль отвечает pro всегда.
    mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const r = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(r.status).toBe(200);
    expect(r.body.tier).toBe("free");
  });

  test("тариф, оплаченный по почте, подхватывается по идентификатору", async () => {
    mockQuery.mockImplementation(async (sql?: string) => {
      const q = typeof sql === "string" ? sql.toUpperCase() : "";
      // Записи по идентификатору ещё нет: человек зарегистрировался позже.
      if (q.includes('FROM "DEVHUBTIER"')) return { rows: [], rowCount: 0 };
      // А по адресу учётной записи — есть, её положил вебхук.
      if (q.includes("DEVHUBEMAILTIER")) return { rows: [{ tier: "pro" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(r.status).toBe(200);
    expect(r.body.tier, "оплаченный тариф не доехал — человек видит бесплатный").toBe("pro");
  });

  test("подхваченный тариф переносится на идентификатор, чтобы не искать снова", async () => {
    const seen: string[] = [];
    mockQuery.mockImplementation(async (sql?: string) => {
      const s = typeof sql === "string" ? sql : "";
      seen.push(s);
      const q = s.toUpperCase();
      if (q.includes('FROM "DEVHUBTIER"')) return { rows: [], rowCount: 0 };
      if (q.includes("DEVHUBEMAILTIER")) return { rows: [{ tier: "pro" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    await request(makeApp()).get("/api/devhub/studio/credits");
    const wrote = seen.some((s) => s.toUpperCase().includes('INSERT INTO "DEVHUBTIER"'));
    expect(wrote, "перенос не сделан: JOIN по почте будет выполняться каждый раз").toBe(true);
  });
});

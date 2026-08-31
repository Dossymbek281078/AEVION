import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Заплативший ГОСТЬ видит свой тариф.
 *
 * Модуль намеренно работает без аккаунта, а оплата приходит вебхуком с одним
 * лишь адресом почты. Тариф при этом искался только через учётную запись —
 * значит гость, заплативший $149, видел бесплатный тариф (замер 29.08.2026 на
 * живом проде: /studio/credits с заголовком гостя отдавал free).
 *
 * Здесь проверяется ЧТЕНИЕ: если связь «гость → почта» есть, оплаченный тариф
 * доезжает. Кто кладёт связь — решает владелец продукта, и от выбора варианта
 * это чтение не зависит.
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

function app() {
  return express().use(express.json()).use("/api/devhub", devhubRouter);
}

describe("оплата гостя доезжает до тарифа", () => {
  beforeEach(() => mockQuery.mockReset());

  test("прибор исправен: без связи гость на бесплатном", async () => {
    // Отрицательный контроль. Без него "pro" ниже мог бы означать, что модуль
    // отвечает pro всегда.
    mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const r = await request(app()).get("/api/devhub/studio/credits");
    expect(r.body.tier).toBe("free");
  });

  test("гость со связанной почтой видит оплаченный тариф", async () => {
    mockQuery.mockImplementation(async (sql?: string) => {
      const q = typeof sql === "string" ? sql.toUpperCase() : "";
      if (q.includes('FROM "DEVHUBTIER"')) return { rows: [], rowCount: 0 };
      // Тот самый UNION: вторая половина — путь гостя.
      if (q.includes("DEVHUBGUESTEMAIL")) return { rows: [{ tier: "pro" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await request(app()).get("/api/devhub/studio/credits");
    expect(r.body.tier, "оплата гостя не доехала — он видит бесплатный тариф").toBe("pro");
  });

  test("запрос вообще спрашивает про гостя", async () => {
    // Иначе тест выше проходил бы и на запросе, где ветки гостя нет:
    // подмена вернула бы pro на что угодно.
    const seen: string[] = [];
    mockQuery.mockImplementation(async (sql?: string) => {
      if (typeof sql === "string") seen.push(sql);
      return { rows: [], rowCount: 0 };
    });
    await request(app()).get("/api/devhub/studio/credits");
    const asks = seen.some((s) => s.toUpperCase().includes("DEVHUBGUESTEMAIL"));
    expect(asks, "в запросе тарифа нет ветки гостя").toBe(true);
  });
});

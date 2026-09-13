import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * ДВА РАЗНЫХ СМЫСЛА У ОДНОГО ИМЕНИ `grossUsd`, и на этом держится публичная
 * страница выручки.
 *
 *   /api/revenue/gumroad/balance  — gross ВКЛЮЧАЕТ свои проверочные покупки
 *                                   (намеренно: число должно сходиться с
 *                                   кабинетом Gumroad при сверке);
 *   /api/revenue/summary          — gross ИХ УЖЕ ИСКЛЮЧАЕТ.
 *
 * Страница /revenue берёт балансы каналов и вычитает внутренние сама:
 * `externalGross = totalGross - totalInternal`. То есть она полагается на
 * первое соглашение. Приведи кто-нибудь две ручки «к одному виду» — вычитание
 * произойдёт ДВАЖДЫ, и на публичной странице выручка станет отрицательной.
 * Замер на проде 13.09.2026: gross 178.97 при внутренних 158.99, то есть
 * ошибка дала бы -139.01 вместо 19.98.
 *
 * Ни одна проверка этого соглашения не закрепляла. Здесь оно закреплено с
 * ОБЕИХ сторон: и что баланс включает, и что сводка исключает, и что разность
 * между ними сходится.
 *
 * Свой проверочный адрес берём синтетический через REVENUE_INTERNAL_EMAILS —
 * настоящему адресу в тестах не место.
 */
const ИСХОДНЫЙ_FETCH = globalThis.fetch;
const СВОЙ = "svoi@test.local";

const продажа = (id: string, cents: number, fee: number, email: string) => ({
  id,
  price: cents,
  gumroad_fee: fee,
  email,
  product_permalink: "https://gum.co/x",
  created_at: new Date().toISOString(),
});

function страница(sales: unknown[]) {
  return { ok: true, json: async () => ({ success: true, sales }) } as unknown as Response;
}

const сохранено: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["GUMROAD_ACCESS_TOKEN", "REVENUE_INTERNAL_EMAILS", "LEMON_SQUEEZY_API_KEY"]) {
    сохранено[k] = process.env[k];
  }
  process.env.GUMROAD_ACCESS_TOKEN = "test-token";
  process.env.REVENUE_INTERNAL_EMAILS = СВОЙ;
  // LemonSqueezy выключаем: считать надо ОДИН канал, иначе разность
  // перестанет быть проверкой арифметики и станет проверкой сети.
  delete process.env.LEMON_SQUEEZY_API_KEY;
  vi.resetModules();
  globalThis.fetch = vi.fn(async () =>
    страница([
      продажа("ext-1", 1000, 100, "kupil-1@example.com"),
      продажа("ext-2", 2000, 200, "kupil-2@example.com"),
      продажа("svoya", 5000, 0, СВОЙ),
    ])
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ИСХОДНЫЙ_FETCH;
  for (const [k, v] of Object.entries(сохранено)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

async function поднять() {
  const { revenueRouter } = (await import("../src/routes/revenue")) as any;
  const app = express();
  app.use(express.json());
  app.use("/api/revenue", revenueRouter);
  return app;
}

describe("соглашение о внутренних покупках между балансом и сводкой", () => {
  test("баланс канала ВКЛЮЧАЕТ свои покупки и называет их отдельно", async () => {
    const app = await поднять();
    const r = await request(app).get("/api/revenue/gumroad/balance");

    expect(r.status).toBe(200);
    // 10 + 20 + 50 — все три, вместе со своей.
    expect(r.body.grossUsd, "баланс обязан сходиться с кабинетом провайдера").toBe(80);
    expect(r.body.internalUsd).toBe(50);
    expect(r.body.saleCount).toBe(3);
  });

  test("сводка свои покупки УЖЕ исключила", async () => {
    const app = await поднять();
    const r = await request(app).get("/api/revenue/summary");

    expect(r.status).toBe(200);
    expect(r.body.grossUsd, "в сводку своя покупка попасть не должна").toBe(30);
    expect(r.body.saleCount).toBe(2);
    // Но и не спрятана: рядом стоит своим полем.
    expect(r.body.internalUsd).toBe(50);
  });

  test("разность сходится — на ней держится страница /revenue", async () => {
    const app = await поднять();
    const баланс = (await request(app).get("/api/revenue/gumroad/balance")).body;
    const сводка = (await request(app).get("/api/revenue/summary")).body;

    // Ровно та арифметика, которую делает страница.
    expect(баланс.grossUsd - баланс.internalUsd).toBe(сводка.grossUsd);
    // И контроль в обратную сторону: если бы баланс уже исключал своё,
    // страница вычла бы второй раз и ушла в минус.
    expect(баланс.grossUsd - баланс.internalUsd).toBeGreaterThan(0);
  });
});

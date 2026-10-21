import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Бюро «Проверено», шаг 2 (21.10.2026): счёт за отметку открывается только на
 * СВОЁМ варианте кассы — LEMON_SQUEEZY_VARIANT_BUREAU_VERIFIED.
 *
 * Пока основатель не завёл вариант, POST /api/bureau/payment/intent обязан
 * отвечать 503 с причиной и НЕ звать кассу. До правки провайдер бросал внутри,
 * и человек получал 500 «webhook rejected» — неотличимо от поломки.
 *
 * Запрос идёт к настоящей ручке; подменены только база и сеть (fetch к LS).
 * Контроль: с заданным вариантом ручка доходит до кассы, и в тело уходит
 * именно этот вариант и номер проверки в custom_data.
 */

const VID = "bv-test-0001";
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) =>
      /SELECT \* FROM "BureauVerification"/.test(sql)
        ? { rows: [{ id: VID, email: "probe@aevion.app", paymentIntentId: null }] }
        : { rows: [] },
    ),
  }),
  getPoolStats: () => null,
}));

const ENV = [
  "BUREAU_PAYMENT_PROVIDER",
  "LEMON_SQUEEZY_VARIANT_BUREAU_VERIFIED",
  "LEMON_SQUEEZY_API_KEY",
  "LEMON_SQUEEZY_STORE_ID",
] as const;
const было: Record<string, string | undefined> = {};
const настоящийFetch = globalThis.fetch;
let кКассе: { url: string; body: any }[] = [];

beforeEach(() => {
  for (const k of ENV) было[k] = process.env[k];
  process.env.BUREAU_PAYMENT_PROVIDER = "lemonsqueezy";
  process.env.LEMON_SQUEEZY_API_KEY = "test-key";
  process.env.LEMON_SQUEEZY_STORE_ID = "1";
  delete process.env.LEMON_SQUEEZY_VARIANT_BUREAU_VERIFIED;
  кКассе = [];
  globalThis.fetch = vi.fn(async (url: any, init?: any) => {
    кКассе.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ data: { id: "ls-1", attributes: { url: "https://aevion.lemonsqueezy.com/checkout/x" } } }), {
      status: 201,
    });
  }) as typeof fetch;
});

afterEach(() => {
  for (const k of ENV) {
    if (было[k] === undefined) delete process.env[k];
    else process.env[k] = было[k];
  }
  globalThis.fetch = настоящийFetch;
});

// Холодный импорт bureau.ts дольше 30 с: в самом тесте он выглядел бы таймаутом,
// неотличимым от найденного дефекта. Поэтому — заранее и с запасом.
let app: express.Express;
beforeAll(async () => {
  const { bureauRouter } = await import("../src/routes/bureau.js");
  app = express();
  app.use(express.json());
  app.use("/api/bureau", bureauRouter);
}, 180_000);
async function поднять() {
  return app;
}

describe("счёт за «Проверено» — только на своём варианте кассы", () => {
  test("вариант не заведён — 503 с причиной, касса не звана", async () => {
    const r = await request(await поднять()).post("/api/bureau/payment/intent").send({ verificationId: VID });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("verified_variant_not_configured");
    expect(r.body.detail).toMatch(/LEMON_SQUEEZY_VARIANT_BUREAU_VERIFIED/);
    expect(кКассе).toHaveLength(0);
  });

  test("КОНТРОЛЬ: вариант заведён — касса звана с ним и с номером проверки", async () => {
    process.env.LEMON_SQUEEZY_VARIANT_BUREAU_VERIFIED = "987654";
    const r = await request(await поднять()).post("/api/bureau/payment/intent").send({ verificationId: VID });
    expect(r.status).toBe(201);
    expect(r.body.checkoutUrl).toMatch(/lemonsqueezy\.com/);
    const вызов = кКассе.find((c) => c.url.endsWith("/checkouts"));
    expect(вызов, "к кассе не ходили").toBeTruthy();
    expect(JSON.stringify(вызов!.body)).toContain('"987654"');
    expect(вызов!.body.data.attributes.checkout_data.custom.verificationId).toBe(VID);
  });

  test("заглушка (прод сейчас) — правка её не трогает", async () => {
    process.env.BUREAU_PAYMENT_PROVIDER = "stub";
    const r = await request(await поднять()).post("/api/bureau/payment/intent").send({ verificationId: VID });
    expect(r.status).not.toBe(503);
    expect(кКассе).toHaveLength(0);
  });
});

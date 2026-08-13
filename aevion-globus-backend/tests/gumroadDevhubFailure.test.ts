import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Второй живой рельс — тот же дефект, что чинился на Lemon Squeezy.
 *
 * `upgradeDevHubByEmail` ловила ошибку записи и молча возвращалась. Вызывающий
 * после этого печатал «devhub-studio-pro → tier=pro» и отвечал 200 с
 * `action: "devhub_tier_set"` — оба утверждения ложные. Gumroad считал доставку
 * успешной и не повторял её: человек заплатил, доступа не получил, следов нет.
 *
 * Здесь это особенно дорого: на Gumroad приходится вся фактическая выручка.
 */

process.env.NODE_ENV = "test";
delete process.env.GUMROAD_WEBHOOK_SECRET; // подпись необязательна — мерим обработку, не защиту

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");

function app() {
  const a = express();
  // Обработчик читает СЫРОЕ тело (req.rawBody), как в проде: `verify` у парсера
  // складывает туда байты. Без этого запрос доходит без полей и получает
  // «no_email» — на этом я и споткнулся, приняв ответ 200 за работу обработчика.
  const stash = (req: express.Request, _res: express.Response, buf: Buffer) => {
    (req as unknown as { rawBody?: Buffer }).rawBody = buf;
  };
  a.use(express.urlencoded({ extended: true, verify: stash }));
  a.use(express.json({ verify: stash }));
  a.use("/api/gumroad", gumroadWebhookRouter);
  return a;
}

let n = 0;
function ping(extra: Record<string, string> = {}) {
  n += 1;
  return request(app())
    .post("/api/gumroad/webhook")
    .type("form")
    .send({
      sale_id: `sale_${n}`,
      email: "buyer@test.aev",
      product_permalink: "https://aevion.gumroad.com/l/studio-pro",
      price: "14900",
      ...extra,
    });
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("покупка DevHub через Gumroad", () => {
  test("успешная выдача отвечает 200 и говорит, что тариф поставлен", async () => {
    const r = await ping();

    expect(r.status).toBe(200);
    expect(r.body.action).toBe("devhub_tier_set");
    expect(r.body.tier).toBe("pro");
  });

  test("сбой записи НЕ отвечает 200 — иначе Gumroad не повторит доставку", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));

    const r = await ping();

    expect(r.status).toBe(500);
    expect(r.body.ok).toBe(false);
    expect(r.body.error).toBe("devhub_tier_failed");
  });

  test("при сбое ответ не утверждает, что тариф поставлен", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));

    const r = await ping();

    expect(JSON.stringify(r.body)).not.toContain("devhub_tier_set");
  });
});

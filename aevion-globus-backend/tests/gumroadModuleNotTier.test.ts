import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Покупка ОДНОГО модуля должна давать этот модуль — не тариф.
 *
 * Найдено 13.08.2026: Constitution Pro за $9 на Gumroad превращался в тариф
 * `lite` ($19), а Lite даёт «один продукт на ВЫБОР». То есть за $9 человек
 * получал право взять любой модуль, включая те, что стоят $29–49 — больше и
 * дороже того, что купил. В логах это выглядело обычной успешной выдачей:
 * «provisioned lite».
 *
 * Класс тот же, что и утренний дефект с DevHub, только в другую сторону: не
 * недодали, а передали. Оба одинаково незаметны снаружи.
 */

process.env.NODE_ENV = "test";
delete process.env.GUMROAD_WEBHOOK_SECRET; // подпись необязательна — мерим выдачу, не защиту

const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
const provisioning = await import("../src/routes/provisioning");
vi.spyOn(provisioning, "provisionSubscription").mockImplementation(mockProvision as never);

function app() {
  const a = express();
  a.use(express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; },
  }));
  return a.use("/api/gumroad", gumroadWebhookRouter);
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
      product_permalink: "https://aevion.gumroad.com/l/pyiaz", // Constitution Pro $9
      price: "900",
      ...extra,
    });
}

/** Какие подписки на модули записаны и с каким статусом. */
function appSubWrites(): Array<{ slug: string; status: string }> {
  return mockQuery.mock.calls
    .filter((c) => String(c[0]).includes("AppSubscription"))
    .map((c) => {
      const p = c[1] as unknown[];
      return { slug: String(p[1]), status: String(p[3]) };
    });
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
});

describe("Gumroad: за $9 дают Конституцию, а не право выбрать что угодно", () => {
  test("покупка Constitution Pro записывает подписку именно на этот модуль", async () => {
    const r = await ping();

    expect(r.status).toBe(200);
    expect(r.body.action).toBe("app_activated");
    expect(r.body.appSlug).toBe("constitution");
    expect(appSubWrites()).toContainEqual({ slug: "constitution", status: "active" });
  });

  test("платформенный тариф при этом НЕ выдаётся", async () => {
    await ping();

    // Главное утверждение: никакого lite со свободным выбором.
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("возврат снимает доступ к модулю", async () => {
    const r = await ping({ refunded: "true" });

    expect(r.body.action).toBe("app_cancelled");
    expect(appSubWrites()).toContainEqual({ slug: "constitution", status: "cancelled" });
  });

  test("контроль: товар-тариф по-прежнему выдаёт тариф", async () => {
    // Иначе первые случаи прошли бы и при поломке всей ветки тарифов.
    const r = await request(app())
      .post("/api/gumroad/webhook")
      .type("form")
      .send({
        sale_id: "sale_tier",
        email: "buyer@test.aev",
        product_permalink: "https://aevion.gumroad.com/l/xpxzam", // All-Access
        price: "5900",
      });

    expect(r.body.action).toBe("activated");
    expect(mockProvision).toHaveBeenCalledTimes(1);
    expect(appSubWrites()).toEqual([]);
  });
});

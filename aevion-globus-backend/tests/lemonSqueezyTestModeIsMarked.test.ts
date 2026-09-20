import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Тестовая покупка не должна выглядеть выручкой.
 *
 * ЗАМЕР 20.09.2026, ради которого сторож. Слова `test_mode` не было в бэкенде НИ
 * РАЗУ: покупка из тестового режима LemonSqueezy провизионилась как настоящая и
 * попадала в выручку неотличимо. При этом через кассу за всё время прошёл ОДИН
 * заказ — своя же подписка ($149, 20.07). Значит первую живую проверку выдачи
 * придётся делать именно тестовым режимом, и без признака в данных отличить её
 * от настоящей продажи будет нечем.
 *
 * Доступ при тестовой покупке ВЫДАЁТСЯ намеренно: смысл проверки в том, чтобы
 * пройти цепочку целиком — подпись, права, письмо. Меняется одно: в записи
 * появляется поле `testMode`.
 *
 * Оговорка в комментарии тут не работает — нужен флаг в данных.
 */

const SECRET = "test-ls-secret-tm";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "7701";

const { mockQuery, mockProvision } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

function post(payload: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app)
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

let n = 0;
function event(testMode?: boolean) {
  n += 1;
  return {
    meta: { event_name: "subscription_created", ...(testMode === undefined ? {} : { test_mode: testMode }) },
    data: {
      id: `sub_tm_${n}`,
      attributes: { user_email: `buyer${n}@test.aev`, variant_id: "7701", total: 1900 },
    },
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ id: "sub_x" });
});

describe("тестовая покупка помечена в данных", () => {
  test("КОНТРОЛЬ: обычная покупка вообще доходит до выдачи", async () => {
    await post(event());
    expect(mockProvision, "вебхук не позвал выдачу — сторож проверял бы пустоту").toHaveBeenCalled();
  });

  test("meta.test_mode=true → в записи появляется testMode", async () => {
    await post(event(true));
    expect(mockProvision).toHaveBeenCalled();
    const arg = mockProvision.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.testMode, "тестовая покупка неотличима от выручки").toBe(true);
  });

  test("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: без test_mode поля нет", async () => {
    await post(event());
    const arg = mockProvision.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.testMode, "поле появляется само — тогда им нельзя пользоваться").toBeUndefined();
  });

  test("meta.test_mode=false тоже не ставит флаг", async () => {
    await post(event(false));
    const arg = mockProvision.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.testMode).toBeUndefined();
  });
});

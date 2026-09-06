import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

/**
 * Сторож: отмена подписки LemonSqueezy ЗАБИРАЕТ помодульный доступ.
 *
 * ЗАМЕР 02.09.2026. Обезвредил вызов отзыва в ветке деактивации — НЕ ПОЙМАНО
 * ни одним тестом. У paybox и paypal тот же вызов охраняется (мутация
 * ловится), у LemonSqueezy — нет.
 *
 * Следствие: подписку отменили или вернули деньги, а строка доступа к модулю
 * остаётся "active" — человек продолжает пользоваться оплаченным. Тариф при
 * этом понижается, но запасной путь стены (planGate → hasActiveAppSubscription)
 * пускает по помодульной записи.
 *
 * Проверяются все три события деактивации, а не одно: список в коде может
 * пополниться, и «хотя бы одно» терпит потерю остальных.
 */
const { вызовы } = vi.hoisted(() => ({ вызовы: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
// Обработчик НЕ импортирует помощник — у него СВОЯ локальная функция,
// которая пишет в базу напрямую. Поэтому подменяем соединение и читаем
// ушедший SQL: подмена модуля appEntitlements здесь не значит ничего.
// Именно поэтому этот путь и не был покрыт: тестам нужна была база.
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (_sql: string, params?: unknown[]) => {
      if (Array.isArray(params) && params.length >= 4) вызовы.push(`${params[2]}:${params[3]}`);
      return { rowCount: 1, rows: [] };
    },
  }),
}));

const SECRET = "test-ls-secret-deact";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "9001";

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

let n = 0;
async function событие(event: string) {
  n += 1;
  const тело = {
    meta: { event_name: event },
    data: {
      id: `ls-deact-${n}`,
      attributes: { user_email: "buyer@example.test", variant_id: 9001, status: "cancelled" },
    },
  };
  const сырое = JSON.stringify(тело);
  const подпись = crypto.createHmac("sha256", SECRET).update(сырое, "utf8").digest("hex");
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from(сырое);
    next();
  });
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(a)
    .post("/api/lemonsqueezy/webhook")
    .set("x-signature", подпись)
    .set("content-type", "application/json")
    .send(сырое);
}

beforeEach(() => {
  вызовы.length = 0;
});

describe("отмена LemonSqueezy забирает доступ к модулю", () => {
  test("КОНТРОЛЬ: покупка ВЫДАЁТ доступ", async () => {
    // Иначе «отозвано» удовлетворялось бы кодом, который не выдаёт вовсе.
    const r = await событие("subscription_created");
    expect(r.status, `покупка не прошла: ${JSON.stringify(r.body)}`).toBe(200);
    expect(
      вызовы.filter((v) => v.endsWith(":active")),
      "покупка не выдала помодульный доступ — сравнивать не с чем"
    ).not.toEqual([]);
  });

  test.each(["subscription_cancelled", "subscription_expired", "subscription_paused"])(
    "%s забирает доступ",
    async (event) => {
      const r = await событие(event);
      expect(r.status, `событие не обработано: ${JSON.stringify(r.body)}`).toBe(200);
      expect(
        вызовы.filter((v) => v.endsWith(":cancelled")),
        `${event}: доступ к модулю НЕ отозван — человек продолжит пользоваться оплаченным после отмены`
      ).not.toEqual([]);
    }
  );
});

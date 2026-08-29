/**
 * При отмене подписки доступ снимается РАНЬШЕ, чем правится учёт.
 *
 * У отмены две записи: строка прав (AppSubscription) и тариф, который реально
 * открывает доступ (DevHubEmailTier / DevHubTier — строку прав пока никто не
 * читает). Между ними возможен сбой, и порядок решает, в какую сторону мы
 * промахнёмся:
 *
 *   учёт → доступ   упало второе: права «отменено», а доступ ОСТАЛСЯ
 *   доступ → учёт   упало второе: доступа уже нет, учёт отстал на повтор
 *
 * Магазин повторит доставку (роут отвечает 500 и освобождает ключ
 * дедупликации), но повторы конечны: если они кончатся на первом порядке,
 * платный доступ останется навсегда после отмены.
 *
 * На АКТИВАЦИИ порядок обратный и это намеренно: человек заплатил, и открыть
 * доступ раньше, чем дописать учёт, для него лучше.
 *
 * Проверяется фактический порядок запросов к базе, а не текст исходника.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";

const queries: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      queries.push(String(sql).replace(/\s+/g, " ").trim());
      // SELECT "id" в upgradeDevHubByEmail: пустой результат — ветка
      // DevHubTier не выполняется, но DevHubEmailTier уже записан.
      return { rows: [], rowCount: 0 };
    },
  }),
}));

const SECRET = "test-ls-secret";
let app: import("express").Express;

async function build() {
  const express = (await import("express")).default;
  const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return a;
}

/** Индекс первого запроса, попавшего в таблицу. -1, если её не трогали. */
function firstTouch(table: string): number {
  return queries.findIndex((q) => q.includes(`"${table}"`));
}

beforeEach(async () => {
  queries.length = 0;
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
  process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "999001";
  app = await build();
});

afterEach(() => {
  delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  delete process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO;
  vi.restoreAllMocks();
});

let seq = 0;

/**
 * Каждому вызову — СВОЙ идентификатор подписки.
 *
 * Первая версия теста слала всем событиям id "sub_test_1", и второй вызов
 * молча отбрасывался дедупликацией вебхука: до базы не доходило ни одного
 * запроса, а выглядело это как «код не снимает тариф». Дедупликация тут
 * работает правильно — ошибка была в оснастке.
 */
async function send(eventName: string) {
  seq += 1;
  const request = (await import("supertest")).default;
  const { createHmac } = await import("node:crypto");
  const body = {
    meta: { event_name: eventName, custom_data: {} },
    data: {
      id: `sub_test_${seq}`,
      attributes: {
        user_email: "buyer@example.com",
        variant_id: 999001,
        status: eventName === "subscription_cancelled" ? "cancelled" : "active",
      },
    },
  };
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app)
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("x-signature", sig)
    .send(raw);
}

// прогрев модуля: первый динамический import большого роутера стоит секунд, и
// внутри бюджета первого теста под нагрузкой он однажды не уложился в 30 с
// (сосед по набору дал ложную красную на ровном месте). Дальше импорт берётся
// из кеша, поэтому достаточно оплатить его один раз в хуке.
beforeAll(async () => {
  await build();
});

describe("отмена снимает доступ раньше, чем правит учёт", () => {
  it("контроль прибора: событие вообще доходит до базы", async () => {
    // Без этого все проверки порядка ниже стали бы зелёными на подписи,
    // которая не прошла, или на варианте, который не распознан.
    await send("subscription_cancelled");
    expect(queries.length, "до базы не дошло ни одного запроса").toBeGreaterThan(0);
  });

  it("на отмене тариф снимается ПЕРЕД записью прав", async () => {
    await send("subscription_cancelled");
    const tier = firstTouch("DevHubEmailTier");
    const rights = firstTouch("AppSubscription");
    expect(tier, "тариф не снимали вовсе").toBeGreaterThan(-1);
    expect(rights, "права не правили вовсе").toBeGreaterThan(-1);
    // Суть правки: доступ закрывается первым.
    expect(tier).toBeLessThan(rights);
  });

  it("на активации порядок обратный — это намеренно", async () => {
    await send("subscription_created");
    const tier = firstTouch("DevHubEmailTier");
    const rights = firstTouch("AppSubscription");
    expect(tier).toBeGreaterThan(-1);
    expect(rights).toBeGreaterThan(-1);
    // Заплативший получает доступ не позже, чем мы дописываем учёт.
    expect(rights).toBeLessThan(tier);
  });
});

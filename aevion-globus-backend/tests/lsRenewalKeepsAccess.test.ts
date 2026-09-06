import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: продление подписки ПРОДЛЕВАЕТ доступ.
 *
 * ЗАЧЕМ ЭТО ВАЖНЕЕ ПРОЧЕГО. Срок доступа настоящий: подписка действует до того
 * же числа следующего месяца и потом гаснет. Продлевает её только событие от
 * кассы. Значит если обработка продления сломается, КАЖДЫЙ подписчик потеряет
 * доступ через месяц после покупки — и узнать об этом мы сможем только от него.
 *
 * ЗАМЕР 03.09.2026: убрал `subscription_updated` из списка активации — НЕ
 * ПОЙМАНО ни одним тестом. То есть самый дорогой отказ на денежном пути не
 * охранялся ничем.
 *
 * Проверяется поведение: событие продления обязано дать доступ (запись
 * подписки и активную помодульную строку), а не просто ответить 200.
 */
const { запросы } = vi.hoisted(() => ({ запросы: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (_sql: string, params?: unknown[]) => {
      if (Array.isArray(params) && params.length >= 4) запросы.push(`${params[2]}:${params[3]}`);
      return { rowCount: 1, rows: [] };
    },
  }),
}));

const SECRET = "test-ls-secret-renew";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO = "9001";
// Вариант ТАРИФА, а не модуля: запись подписки (и значит продление срока)
// идёт только по тарифной ветке. Первая версия теста слала модульный
// вариант и требовала записи подписки — требование было неверным.
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9002";

const каталог = mkdtempSync(join(tmpdir(), "aevion-renew-"));
const файлПодписок = join(каталог, "subs.jsonl");
process.env.SUBSCRIPTIONS_FILE = файлПодписок;

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

let n = 0;
async function событие(event: string, variant = 9002) {
  n += 1;
  const тело = {
    meta: { event_name: event },
    data: {
      id: `ls-renew-${n}`,
      attributes: {
        user_email: "buyer@example.test",
        variant_id: variant,
        status: "active",
        renews_at: "2030-01-01T00:00:00.000Z",
      },
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

function строкПодписок(): number {
  if (!existsSync(файлПодписок)) return 0;
  return readFileSync(файлПодписок, "utf8").split("\n").filter((l) => l.trim()).length;
}

beforeEach(() => {
  запросы.length = 0;
});

describe("продление сохраняет доступ", () => {
  test("продление ТАРИФА записывает подписку — срок сдвигается", async () => {
    const было = строкПодписок();
    const r = await событие("subscription_updated", 9002);
    expect(r.status, `событие продления не обработано: ${JSON.stringify(r.body)}`).toBe(200);
    expect(
      строкПодписок(),
      "продление не записало подписку: срок не сдвинулся, и через месяц подписчик потеряет доступ"
    ).toBeGreaterThan(было);
  });

  test("продление МОДУЛЯ оставляет помодульный доступ активным", async () => {
    // Второй путь того же события: у модульного варианта подписка не пишется,
    // зато обновляется строка доступа к модулю. Требовать оба от одного
    // события неверно — это разные ветки обработчика.
    const r = await событие("subscription_updated", 9001);
    expect(r.status).toBe(200);
    expect(
      запросы.filter((q) => q.endsWith(":active")),
      "продление не подтвердило доступ к модулю"
    ).not.toEqual([]);
  });

  test("КОНТРОЛЬ: неизвестное событие доступа НЕ даёт", async () => {
    // Иначе «доступ выдан» удовлетворялось бы кодом, который выдаёт на всё
    // подряд, — то есть кассой, раздающей подписки по любому пингу.
    const r = await событие("subscription_plan_changed_to_nothing");
    expect(r.status).toBe(200);
    expect(
      запросы.filter((q) => q.endsWith(":active")),
      "доступ выдан по неизвестному событию"
    ).toEqual([]);
  });
});

process.on("exit", () => rmSync(каталог, { recursive: true, force: true }));

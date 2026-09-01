import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Покупка доходит до сводки выручки — вся цепочка, а не половины.
 *
 * ЗАЧЕМ. 01.09.2026 собрано три звена: касса стала записывать фактически
 * списанное, канал поехал в ту же запись, появилась сводка по каналам. Каждое
 * звено проверено своим тестом — и это ровно тот случай, когда «каждый шаг
 * отвечает ок, а целое не работает»: между вебхуком и сводкой лежит ФАЙЛ, и
 * достаточно разойтись пути к нему, чтобы обе половины остались зелёными, а
 * денег в сводке не было.
 *
 * Поэтому здесь ничего не подменяется, кроме почты и базы: вебхук пишет
 * НАСТОЯЩЕЙ выдачей прав в НАСТОЯЩИЙ файл, а сводка читает его же.
 */

const SECRET = "test-ls-secret-chain";
const FILE = join(tmpdir(), "aevion-subs-chain.jsonl");
const TOKEN = "adm-chain-000";

process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9002";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
// Почту не шлём: проверяем деньги, а не доставку.
vi.mock("../src/lib/constitutionBrevo", () => ({ sendConstitutionEmail: vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";
// eslint-disable-next-line import/first
import { provisioningRouter } from "../src/routes/provisioning";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  a.use("/api/pricing/provisioning", provisioningRouter);
  return a;
}

/**
 * Номер пинга. Дедупликация вебхука живёт В МОДУЛЕ и переживает тесты: первая
 * редакция собирала id из суммы и канала, они повторились между случаями, и
 * второй тест видел одну покупку вместо двух. Выглядело как потеря записи —
 * оказалось повторным идентификатором. Соседний файл кассы предупреждает об
 * этом прямым текстом; я прочитал предупреждение уже после замера.
 */
let n = 0;

function ping(total: number, channel: string, email: string) {
  n += 1;
  const payload = {
    meta: { event_name: "subscription_created", custom_data: { channel } },
    data: {
      id: `sub_chain_${n}_${total}_${channel}`,
      attributes: { user_email: email, variant_id: "9002", total },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

beforeEach(() => {
  process.env.SUBSCRIPTIONS_FILE = FILE;
  process.env.ADMIN_TOKEN = TOKEN;
  rmSync(FILE, { force: true });
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

afterEach(() => {
  rmSync(FILE, { force: true });
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.ADMIN_TOKEN;
});

describe("покупка доходит от кассы до сводки выручки", () => {
  test("сумма и канал появляются в сводке той же цепочкой", async () => {
    const paid = await ping(1900, "tt", "buyer@test.aev");
    expect(paid.status, "касса не приняла пинг — дальше мерить нечего").toBe(200);

    const r = await request(app())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);

    expect(r.status).toBe(200);
    expect(r.body.total, "покупка не доехала до сводки").toBe(1);
    expect(r.body.byChannel.tt?.count, "канал потерян между кассой и сводкой").toBe(1);
    expect(r.body.byChannel.tt?.amountUsdSum, "сумма потеряна между кассой и сводкой").toBe(19);
    expect(r.body.withAmount).toBe(1);
    expect(r.body.withChannel).toBe(1);
  });

  test("две покупки разных каналов не смешиваются", async () => {
    const first = await ping(1900, "tt", "a@test.aev");
    const second = await ping(2900, "ig", "b@test.aev");
    // Утверждаем ОБА ответа: без этого «в сводке одна покупка» не отличить от
    // «вторая касса вернула отказ» — а это разные поломки.
    expect(first.status, "первый пинг отклонён").toBe(200);
    expect(second.status, "второй пинг отклонён: " + JSON.stringify(second.body)).toBe(200);
    expect(
      second.body,
      "второй пинг принят, но что он сделал: " + JSON.stringify(second.body),
    ).toHaveProperty("action", "activated");

    const r = await request(app())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);

    expect(r.body.total).toBe(2);
    expect(r.body.byChannel.tt?.amountUsdSum).toBe(19);
    expect(r.body.byChannel.ig?.amountUsdSum).toBe(29);
  });

  test("контроль: пустой файл даёт ноль, а не ошибку", async () => {
    // Без этого «сводка показала 1» могло бы означать «она всегда что-то
    // показывает». И отдельно: пустая история должна читаться как ноль
    // покупок, а не как отказ ручки.
    const r = await request(app())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(0);
    expect(r.body.byChannel).toEqual({});
  });
});

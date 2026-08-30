import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Отмена подписки на ОБЫЧНЫЙ модуль забирает доступ.
 *
 * Замер 29.08.2026. Снятие доступа при возврате проверялось только на DevHub —
 * а он исключение: у него СВОЙ механизм (`DevHubTier`/`DevHubEmailTier`), и в
 * соседнем файле на него приходится девять упоминаний против нуля у остальных.
 *
 * Между тем поштучно продаются ещё шесть модулей — QContract, QVenture,
 * IP Bureau, Smeta, QPayNet, CyberChess, — и у них доступ держится ТОЛЬКО на
 * строке прав `AppSubscription`, которую читает planGate. Её снятие не
 * закреплял ни один тест: покрыт был исключительный путь, а не общий.
 *
 * Цена пропуска — зеркальная той, что мы чиним весь день. «Заплатил и не
 * получил» человек замечает и жалуется. «Вернул деньги и продолжает
 * пользоваться» не заметит никто, кроме выручки.
 */

const SECRET = "test-ls-secret-revoke";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_QCONTRACT = "7301";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: vi.fn().mockResolvedValue({ subscription: { id: "s1" } }),
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
function event(name: string, email = "buyer@test.aev") {
  n += 1;
  return {
    meta: { event_name: name },
    data: { id: `sub_revoke_${n}`, attributes: { user_email: email, variant_id: "7301" } },
  };
}

/** Значения статуса, ушедшие в запись прав, по порядку. */
function statusesWritten(): string[] {
  return mockQuery.mock.calls
    .filter((c) => String(c[0]).includes('INSERT INTO "AppSubscription"'))
    .map((c) => String((c[1] as unknown[])?.[3]));
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

describe("возврат забирает доступ к обычному модулю", () => {
  test("контроль: покупка выдаёт доступ", () => {
    // Без этого «cancelled» ниже нельзя отличить от «ничего не записалось».
    return post(event("subscription_created")).then((res) => {
      expect(res.status).toBe(200);
      expect(statusesWritten()).toEqual(["active"]);
    });
  });

  test("отмена подписки помечает право отменённым", async () => {
    const res = await post(event("subscription_cancelled"));
    expect(res.status).toBe(200);
    expect(
      statusesWritten(),
      "право не снято — человек вернул деньги и продолжает пользоваться",
    ).toEqual(["cancelled"]);
  });

  test("истечение подписки тоже забирает доступ", async () => {
    const res = await post(event("subscription_expired"));
    expect(res.status).toBe(200);
    expect(statusesWritten()).toEqual(["cancelled"]);
  });

  test("снятие идёт по ТОМУ ЖЕ модулю, что и покупка", async () => {
    // Иначе отмена одной подписки закрыла бы чужой модуль, а свой оставила.
    await post(event("subscription_cancelled"));
    const slugs = mockQuery.mock.calls
      .filter((c) => String(c[0]).includes('INSERT INTO "AppSubscription"'))
      .map((c) => String((c[1] as unknown[])?.[1]));
    expect(slugs).toEqual(["qcontract"]);
  });

  test("у обычного модуля тариф DevHub не трогается", async () => {
    // DevHub — исключение со своим механизмом. Задень его отмена QContract, и
    // человек, купивший оба, потерял бы доступ к тому, за который платит.
    await post(event("subscription_cancelled"));
    const devhubWrites = mockQuery.mock.calls.filter((c) =>
      String(c[0]).includes("DevHubEmailTier"),
    );
    expect(devhubWrites.length, "отмена чужого модуля трогает тариф DevHub").toBe(0);
  });
});

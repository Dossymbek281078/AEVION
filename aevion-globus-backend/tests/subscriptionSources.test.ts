import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import express from "express";
import { aggregateSubscriptionSources, readSubscriptions } from "../src/lib/subscriptionSources";
import type { Subscription } from "../src/routes/provisioning";

// Разрез подписок по источнику трафика. Подписки продаются через LemonSqueezy —
// это все модули каталога, $19–$149/мес. Метка канала попадает в запись
// подписки из checkout[custom][channel].
//
// Считается количество, а не выручка: вебхук LemonSqueezy не сохраняет сумму, а
// домножать тариф на каталожную цену значит выдать оценку за факт.

const INTERNAL = "internal-tester@aevion.test";
let dir: string;

const sub = (over: Partial<Subscription> = {}): Subscription =>
  ({
    id: "sub_1",
    ts: "2026-07-27T00:00:00.000Z",
    email: "buyer@example.com",
    tierId: "lite",
    period: "monthly",
    seats: 1,
    modules: [],
    trialDays: 0,
    source: "lemonsqueezy",
    channel: "instagram",
    ...over,
  }) as Subscription;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sub-sources-test-"));
  process.env.SUBSCRIPTIONS_FILE = path.join(dir, "subscriptions.jsonl");
  process.env.REVENUE_INTERNAL_EMAILS = INTERNAL;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.REVENUE_INTERNAL_EMAILS;
});

describe("свод подписок по источнику", () => {
  test("подписки группируются по каналу и тарифу", () => {
    const r = aggregateSubscriptionSources([
      sub({ channel: "instagram", tierId: "lite" }),
      sub({ channel: "instagram", tierId: "full" }),
      sub({ channel: "facebook", tierId: "lite" }),
    ]);
    expect(r.total).toBe(3);
    expect(r.bySource.instagram.count).toBe(2);
    expect(r.bySource.instagram.byTier).toEqual({ lite: 1, full: 1 });
    expect(r.bySource.facebook.count).toBe(1);
  });

  test("подписка без метки попадает в unattributed, а не теряется", () => {
    const r = aggregateSubscriptionSources([sub({ channel: undefined })]);
    expect(r.bySource.unattributed.count).toBe(1);
    expect(r.total).toBe(1);
  });

  test("наши тестовые покупки не считаются", () => {
    const r = aggregateSubscriptionSources([sub({ email: INTERNAL }), sub()]);
    expect(r.total).toBe(1);
    expect(r.skipped.internal).toBe(1);
    expect(r.bySource.instagram.count).toBe(1);
  });

  test("запись о даунгрейде не считается приходом", () => {
    // Вебхук пишет tierId "free" на отмену. Складывать уход с покупками значит
    // завышать результат канала.
    const r = aggregateSubscriptionSources([sub({ tierId: "free" }), sub()]);
    expect(r.total).toBe(1);
    expect(r.skipped.downgrade).toBe(1);
  });

  test("отброшенное считается по причинам, а не молча", () => {
    const r = aggregateSubscriptionSources([
      sub({ email: INTERNAL }),
      sub({ tierId: "free" }),
      sub(),
    ]);
    expect(r.skipped).toEqual({ internal: 1, downgrade: 1, malformed: 0 });
  });
});

describe("чтение хранилища", () => {
  test("битая строка пропускается и считается, а не роняет ответ", () => {
    writeFileSync(
      process.env.SUBSCRIPTIONS_FILE!,
      [JSON.stringify(sub()), '{"id":"sub_2","emai', JSON.stringify(sub({ channel: "tiktok" }))].join("\n") + "\n",
      "utf8",
    );
    const { subs, malformed } = readSubscriptions();
    expect(subs).toHaveLength(2);
    expect(malformed).toBe(1);
  });

  test("отсутствующий файл — это ноль подписок, а не ошибка", () => {
    const { subs, malformed } = readSubscriptions();
    expect(subs).toEqual([]);
    expect(malformed).toBe(0);
  });
});

describe("GET /subscription-sources", () => {
  test("маршрут отдаёт свод и честно помечает, что это не выручка", async () => {
    writeFileSync(
      process.env.SUBSCRIPTIONS_FILE!,
      [
        JSON.stringify(sub({ channel: "instagram" })),
        JSON.stringify(sub({ channel: "instagram", tierId: "full" })),
        JSON.stringify(sub({ email: INTERNAL })),
      ].join("\n") + "\n",
      "utf8",
    );

    const { revenueRouter } = await import("../src/routes/revenue");
    const app = express();
    app.use("/api/revenue", revenueRouter);

    const r = await request(app).get("/api/revenue/subscription-sources");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.bySource.instagram.count).toBe(2);
    expect(r.body.skipped.internal).toBe(1);
    // Формулировка важна: без неё число легко прочитать как деньги.
    expect(r.body.note).toContain("не выручка");
  });
});

import { describe, test, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Окно веерной скидки НЕ должно продлеваться продлением подписки.
 *
 * Риск найден чтением routes/lemonSqueezyWebhook.ts 2026-07-26 (до первой
 * продажи): `subscription_updated` входит в ACTIVATE_EVENTS, а dedup-ключ там
 * намеренно включает `renews_at`, поэтому каждое ежемесячное продление вызывает
 * provisionSubscription() и пишет новую запись со свежим `ts`. Пока окно веера
 * считалось от `ts`, оно открывалось заново каждый месяц: дефицит времени, на
 * котором держится механика, исчезал, а активный подписчик получал −30%
 * навсегда.
 *
 * Тест идёт через РЕАЛЬНЫЙ стор подписок (только файл перенаправлен в temp) и
 * реальный provisionSubscription — иначе он проверял бы не тот путь, которым
 * ходит вебхук.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-fan-window-"));
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
// Без ключа Resend sendEmail() уходит в stub и ничего не отправляет.
delete process.env.RESEND_API_KEY;

import {
  provisionSubscription,
  readLatestSubscription,
  fanAnchorOf,
} from "../src/routes/provisioning";
import { computeFan, FAN_WINDOW_DAYS } from "../src/data/fanDiscounts";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("окно веера vs продление подписки", () => {
  test("продление с тем же тарифом и набором НЕ сдвигает якорь окна", async () => {
    const email = "renewal@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    const anchor1 = fanAnchorOf(first.subscription);
    expect(anchor1).toBe(first.subscription.ts);

    // Через 5 мс приходит subscription_updated (renews_at сменился) — вебхук
    // снова зовёт provisionSubscription с тем же тарифом и модулем.
    await new Promise((r) => setTimeout(r, 5));
    const renewal = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });

    expect(renewal.subscription.ts).not.toBe(first.subscription.ts); // новая запись
    expect(fanAnchorOf(renewal.subscription)).toBe(anchor1);         // якорь тот же
    expect(fanAnchorOf(readLatestSubscription(email)!)).toBe(anchor1);
  });

  test("покупка НОВОГО модуля сдвигает якорь — окно открывается заново", async () => {
    const email = "newmodule@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "medium", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await provisionSubscription({
      email, tierId: "medium", period: "monthly", modules: ["qsign", "qright"], source: "lemonsqueezy",
    });
    expect(fanAnchorOf(second.subscription)).toBe(second.subscription.ts);
    expect(fanAnchorOf(second.subscription)).not.toBe(fanAnchorOf(first.subscription));
  });

  test("смена тарифа сдвигает якорь", async () => {
    const email = "upgrade@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    await new Promise((r) => setTimeout(r, 5));
    const upgraded = await provisionSubscription({
      email, tierId: "medium", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    expect(fanAnchorOf(upgraded.subscription)).not.toBe(fanAnchorOf(first.subscription));
  });

  test("после 15 продлений окно всё равно закрывается по первой покупке", async () => {
    const email = "loop@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    for (let i = 0; i < 15; i++) {
      await provisionSubscription({
        email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
      });
    }
    const latest = readLatestSubscription(email)!;
    const anchor = fanAnchorOf(latest);
    expect(anchor).toBe(fanAnchorOf(first.subscription));

    // Смотрим на веер спустя окно+1 день от якоря — он обязан быть закрыт.
    const after = new Date(Date.parse(anchor) + (FAN_WINDOW_DAYS + 1) * 86_400_000);
    const fan = computeFan({
      tierId: latest.tierId, owned: latest.modules, lastPurchaseAt: anchor, now: after,
    });
    expect(fan.status).toBe("expired");
    expect(fan.offers.every((o) => o.discountRatio === 0)).toBe(true);
  });

  test("запись без fanAnchorAt (до 2026-07-26) читается по ts — старые данные не ломаются", () => {
    const legacy = {
      id: "sub_legacy", ts: "2026-07-01T00:00:00.000Z", email: "legacy@test.dev",
      tierId: "lite" as const, period: "monthly" as const, seats: 1,
      modules: ["qsign"], trialDays: 0,
    };
    expect(fanAnchorOf(legacy)).toBe("2026-07-01T00:00:00.000Z");
  });
});

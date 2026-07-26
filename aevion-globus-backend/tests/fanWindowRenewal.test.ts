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
  writeSubscription,
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

  test("продление НЕ присылает welcome-письмо, новая покупка — присылает", async () => {
    // ACTIVATE_EVENTS включает subscription_updated → вебхук зовёт провижининг
    // на каждом ежемесячном списании. Без этой проверки покупатель получал
    // «Добро пожаловать в AEVION» каждый месяц (чек за списание присылает сам
    // процессинг, наше письмо было и дублем, и по смыслу неверным).
    const email = "mail@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    expect(first.emailSkipped).toBeUndefined();
    expect(first.emailSent).toBe(true);

    const renewal = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    expect(renewal.emailSkipped).toBe("renewal");
    expect(renewal.emailSent).toBe(false);

    // Апгрейд — это новая покупка, письмо должно уйти.
    const upgrade = await provisionSubscription({
      email, tierId: "full", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    expect(upgrade.emailSkipped).toBeUndefined();
    expect(upgrade.emailSent).toBe(true);
  });

  test("возврат после отмены получает письмо (отмена пишет tierId free)", async () => {
    const email = "resub@test.aevion.dev";
    await provisionSubscription({ email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "ls" });
    // Отмена: вебхук пишет запись с tierId "free" напрямую через writeSubscription
    writeSubscription({
      id: "sub_cancel", ts: new Date().toISOString(), email, tierId: "free",
      period: "monthly", seats: 1, modules: [], trialDays: 0, source: "lemonsqueezy:cancel",
    });
    const back = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "ls",
    });
    expect(back.emailSkipped).toBeUndefined();
    expect(back.emailSent).toBe(true);
    // И окно веера открывается заново — это честно новая покупка.
    expect(fanAnchorOf(back.subscription)).toBe(back.subscription.ts);
  });

  test("вернувшийся клиент (подписка истекла давно) — это НОВАЯ покупка, не продление", async () => {
    // PayBox/PayPal — разовые платежи. Без проверки срока покупатель, вернувшийся
    // через месяцы, попадал бы под «продление»: тишина вместо письма и никакого
    // окна веера. Возврат клиента — это новая покупка.
    const email = "returning@test.aevion.dev";
    const stale = new Date(Date.now() - 90 * 86_400_000).toISOString();
    writeSubscription({
      id: "sub_stale", ts: stale, email, tierId: "lite", period: "monthly",
      seats: 1, modules: ["qsign"], trialDays: 0,
      // истекла 60 дней назад — далеко за пределами RENEWAL_GRACE_DAYS
      validUntil: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      source: "paybox",
    });
    const back = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "paybox",
    });
    expect(back.emailSkipped).toBeUndefined();
    expect(back.emailSent).toBe(true);
    expect(fanAnchorOf(back.subscription)).toBe(back.subscription.ts);
  });

  test("продление чуть позже срока (дрейф вебхука) остаётся продлением", async () => {
    const email = "jitter@test.aevion.dev";
    const anchor = new Date(Date.now() - 31 * 86_400_000).toISOString();
    writeSubscription({
      id: "sub_jitter", ts: anchor, email, tierId: "lite", period: "monthly",
      seats: 1, modules: ["qsign"], trialDays: 0,
      // истекла ВЧЕРА — это дрейф сроков LS, а не возвращение клиента
      validUntil: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      fanAnchorAt: anchor, source: "lemonsqueezy",
    });
    const renewal = await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    expect(renewal.emailSkipped).toBe("renewal");
    expect(fanAnchorOf(renewal.subscription)).toBe(anchor);
  });

  test("дубль вебхука после рестарта безвреден: без письма и без сдвига окна", async () => {
    // Дедуп в lemonSqueezyWebhook.ts — Set в памяти процесса, и в комментарии там
    // компромисс принят осознанно: «jsonl append-only, дубль терпим». После
    // fanAnchorAt + isRenewalOf это стало правдой ещё и для веера с письмом —
    // тест закрепляет ровно это, чтобы «терпим» не превратилось обратно в
    // «шлём письмо и открываем окно заново» при следующей правке.
    const email = "dup@test.aevion.dev";
    const first = await provisionSubscription({
      email, tierId: "medium", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });
    // Рестарт процесса → SEEN пуст → LS доставляет то же событие повторно.
    const dup = await provisionSubscription({
      email, tierId: "medium", period: "monthly", modules: ["qsign"], source: "lemonsqueezy",
    });

    expect(dup.emailSkipped).toBe("renewal");        // покупателя не беспокоим
    expect(dup.emailSent).toBe(false);
    expect(fanAnchorOf(dup.subscription)).toBe(fanAnchorOf(first.subscription)); // окно на месте
    // Единственное последствие — лишняя строка в сторе, и latest-wins её терпит.
    expect(readLatestSubscription(email)!.tierId).toBe("medium");
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

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { checkoutRouter } from "../src/routes/checkout";
import { paymentsRouter } from "../src/routes/payments";

/**
 * Сторож: две ручки состояния не имеют права спорить о том, кто
 * принимает деньги.
 *
 * Повод. 29.08.2026 на проде `/api/pricing/checkout/healthz` отвечал
 * `primaryProvider: "lemonsqueezy"`, а `/api/payments/health` в тот же
 * миг — `gumroad: { primary: true }` и про LemonSqueezy не знал вовсе.
 * Причина: у второй ручки `primary` стояло КОНСТАНТОЙ. Поле выглядело
 * замером, а было литералом, и после перехода на LemonSqueezy начало
 * лгать.
 *
 * Опаснее всего тут не сама ложь, а то, что спорят ДВА НАШИХ
 * СОБСТВЕННЫХ ответа об одном и том же. Человек, разбирающийся с
 * деньгами, поверит тому, который короче и увереннее.
 *
 * Проверяем ПОВЕДЕНИЕ при обоих состояниях настроек, а не текст:
 * тест, закреплённый на одном провайдере, устареет при следующем
 * переезде и будет охранять вчерашнюю правду.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  a.use("/api/payments", paymentsRouter);
  return a;
}

const КЛЮЧИ = ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET"] as const;
let было: Record<string, string | undefined> = {};

beforeEach(() => {
  было = {};
  for (const k of КЛЮЧИ) было[k] = process.env[k];
});
afterEach(() => {
  for (const k of КЛЮЧИ) {
    if (было[k] === undefined) delete process.env[k];
    else process.env[k] = было[k] as string;
  }
});

/** Кого называет основным каждая из ручек. */
async function ктоОсновной() {
  const a = app();
  const c = await request(a).get("/api/pricing/checkout/healthz");
  const p = await request(a).get("/api/payments/health");
  expect(c.status).toBe(200);
  expect(p.status).toBe(200);
  const поPayments = Object.entries(p.body as Record<string, { primary?: boolean }>)
    .filter(([, v]) => v && typeof v === "object" && v.primary === true)
    .map(([k]) => k);
  return { поCheckout: c.body.primaryProvider as string, поPayments };
}

describe("две ручки состояния согласны о том, кто принимает деньги", () => {
  test("LemonSqueezy настроен — обе называют его", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("lemonsqueezy");
    expect(поPayments).toEqual(["lemonsqueezy"]);
  });

  test("LemonSqueezy НЕ настроен — обе называют Gumroad", async () => {
    delete process.env.LEMON_SQUEEZY_API_KEY;
    delete process.env.LEMON_SQUEEZY_STORE_ID;
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("gumroad");
    expect(поPayments).toEqual(["gumroad"]);
  });

  test("healthz говорит не только «можно взять деньги», но и «дойдёт ли выдача»", async () => {
    // Секрет вебхука решает, дойдёт ли покупка до выдачи: без него
    // обработчик отвечает провайдеру ok и молча игнорирует событие,
    // провайдер считает доставку успешной и НЕ повторяет. Деньги
    // списаны, купленное не выдано, снаружи всё зелено.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";

    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    const без = await request(app()).get("/api/pricing/checkout/healthz");
    expect(без.body.providers.lemonsqueezy.webhookConfigured).toBe(false);
    // и при этом «можно взять деньги» остаётся правдой — то есть без
    // отдельного поля разница была бы невидима
    expect(без.body.providers.lemonsqueezy.configured).toBe(true);

    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "тест-секрет";
    const с = await request(app()).get("/api/pricing/checkout/healthz");
    expect(с.body.providers.lemonsqueezy.webhookConfigured).toBe(true);
  });

  test("основной ровно один — не ноль и не два", async () => {
    for (const настроен of [true, false]) {
      if (настроен) {
        process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
        process.env.LEMON_SQUEEZY_STORE_ID = "1234";
      } else {
        delete process.env.LEMON_SQUEEZY_API_KEY;
        delete process.env.LEMON_SQUEEZY_STORE_ID;
      }
      const { поPayments } = await ктоОсновной();
      expect(поPayments).toHaveLength(1);
    }
  });
});

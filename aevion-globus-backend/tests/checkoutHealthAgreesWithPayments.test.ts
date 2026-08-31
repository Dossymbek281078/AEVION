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

const КЛЮЧИ = ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET", "LEMON_SQUEEZY_VARIANT_LITE_MONTHLY"] as const;
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
  test("LemonSqueezy настроен И умеет выдавать — обе называют его", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    // Секрет вебхука здесь обязателен: «основной» отвечает на вопрос, кто
    // ДОВЕДЁТ покупку, а не кто возьмёт деньги. Без него основным обязан
    // стать Gumroad — это проверяет соседний тест ниже.
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "тест-секрет";
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("lemonsqueezy");
    expect(поPayments).toEqual(["lemonsqueezy"]);
  });

  test("ключ есть, а секрета вебхука нет — основным обязан стать Gumroad", async () => {
    // Ровно тот случай, ради которого правка. Раньше основным оставался
    // LemonSqueezy: деньги брались, вебхук отвечал 200 и молча игнорировал
    // событие, выдачи не происходило. У Gumroad секрет необязателен, и
    // выдача работает — значит покупателя надо вести туда.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("gumroad");
    expect(поPayments).toEqual(["gumroad"]);
  });

  test("PayBox: задан только продавец — обе ручки говорят «не настроен»", async () => {
    // PayBox нужны И продавец, И PAYBOX_SECRET: без секрета нельзя ни
    // подписать запрос, ни проверить ответ, и модуль это знает
    // (isPayboxConfigured требует оба). checkout/healthz звал эту функцию, а
    // /api/payments/health пересобирал готовность по одному продавцу.
    //
    // Сегодня обе отвечают «нет», и разница невидима. Она проявилась бы
    // ровно в день, когда данные PayBox заданы наполовину, — то есть когда
    // основатель начнёт настраивать кассу для тенге.
    process.env.PAYBOX_MERCHANT_ID = "merchant-1";
    delete process.env.PAYBOX_SECRET;
    const a = app();
    const c = await request(a).get("/api/pricing/checkout/healthz");
    const pmt = await request(a).get("/api/payments/health");
    expect(c.body.providers.paybox.configured).toBe(false);
    expect(pmt.body.paybox.configured).toBe(false);
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

  test("healthz говорит, что реально МОЖНО КУПИТЬ, а не только «настроен»", async () => {
    // `configured` отвечает «есть ключ и магазин». Начать покупку нельзя
    // без ВАРИАНТА товара — отдельная переменная на каждый тариф. Два
    // разных вопроса под одним словом; проверяем именно РАЗНИЦУ.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY;

    const без = await request(app()).get("/api/pricing/checkout/healthz");
    const s1 = без.body.providers.lemonsqueezy.sellable;
    expect(s1).toBeTruthy();
    expect(s1.missing).toContain("tier_lite_monthly");
    // и при этом «настроен» остаётся true — без отдельного поля разница
    // была бы невидима
    expect(без.body.providers.lemonsqueezy.configured).toBe(true);

    process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "12345";
    const с = await request(app()).get("/api/pricing/checkout/healthz");
    const s2 = с.body.providers.lemonsqueezy.sellable;
    expect(s2.configured).toContain("tier_lite_monthly");
    expect(s2.missing).not.toContain("tier_lite_monthly");

    // Значения переменных — идентификаторы товара в чужой панели, их в
    // ответе быть не должно: возвращаем только имена ссылок.
    expect(JSON.stringify(s2)).not.toContain("12345");
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

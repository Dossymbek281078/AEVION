import { describe, test, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { channelsHealthRouter } from "../src/routes/channelsHealth";

/**
 * Ручка отвечает на два вопроса владельца: может ли человек
 * ЗАРЕГИСТРИРОВАТЬСЯ и может ли ЗАПЛАТИТЬ.
 *
 * Повод: 19.08.2026 зарегистрироваться было нельзя ни одним из четырёх
 * способов, и ни одна проверка этого не видела — все спрашивали «отвечает ли
 * сервер», а не «получилось ли у человека».
 */

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/health", channelsHealthRouter);
  return a;
};

const VARS = [
  "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET",
  "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY", "RESEND_KEY",
  "LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET",
  "GUMROAD_ACCESS_TOKEN", "GUMROAD_WEBHOOK_SECRET",
  "PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET",
  "PAYPAL_WEBHOOK_ID",
];
const saved: Record<string, string | undefined> = {};
beforeEach(() => VARS.forEach((v) => { saved[v] = process.env[v]; delete process.env[v]; }));
afterEach(() => VARS.forEach((v) => { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; }));

const get = () => request(app()).get("/api/health/channels");

describe("Два главных поля", () => {
  test("ничего не настроено — canRegister и canPay оба false", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.body.canRegister).toBe(false);
    expect(r.body.canPay).toBe(false);
  });

  test("хватает ОДНОГО пути входа: только почта — canRegister true", async () => {
    process.env.RESEND_API_KEY = "re_x";
    expect((await get()).body.canRegister).toBe(true);
  });

  test("хватает ОДНОГО пути входа: только Google — canRegister true", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
    expect((await get()).body.canRegister).toBe(true);
  });

  test("половина пары OAuth не считается настройкой", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "id";   // секрета нет
    const r = await get();
    expect(r.body.signup.google.configured).toBe(false);
    expect(r.body.canRegister).toBe(false);
  });

  test("пробелы вместо значения настройкой не считаются", async () => {
    process.env.RESEND_API_KEY = "   ";
    expect((await get()).body.canRegister).toBe(false);
  });
});

describe("Подпись вебхука — отдельный признак, а не часть «настроено»", () => {
  test("процессинг настроен, подписи нет — configured true, signed false", async () => {
    process.env.GUMROAD_ACCESS_TOKEN = "tok";
    const r = await get();
    expect(r.body.payments.gumroad.configured).toBe(true);
    expect(r.body.payments.gumroad.signed).toBe(false);
    expect(r.body.canPay).toBe(true);
    // и это обязано попасть в подсказку: приём оплаты без подписи опаснее,
    // чем его отсутствие — права выдаются по слову отправителя.
    expect(String(r.body.missing)).toContain("GUMROAD_WEBHOOK_SECRET");
  });
});

describe("Секретов не отдаём", () => {
  test("ни значений, ни длин, ни префиксов", async () => {
    process.env.RESEND_API_KEY = "re_SUPERSECRET_VALUE";
    process.env.GUMROAD_ACCESS_TOKEN = "gum_SECRET";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "goog_SECRET";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "goog_ID";
    const body = JSON.stringify((await get()).body);
    for (const s of ["SUPERSECRET", "gum_SECRET", "goog_SECRET", "goog_ID"]) {
      expect(body).not.toContain(s);
    }
    // и никаких длин
    expect(body).not.toContain('"length"');
  });
});

describe("Подсказка называет, чего не хватает", () => {
  test("пусто настроено — в missing есть почта и оба OAuth", async () => {
    const m = String((await get()).body.missing);
    expect(m).toContain("RESEND_API_KEY");
    expect(m).toContain("GOOGLE_OAUTH_CLIENT_ID");
    expect(m).toContain("GITHUB_OAUTH_CLIENT_ID");
  });

  test("canPay говорит «да» там, где покупку начать нельзя — на это есть отдельное поле", async () => {
    // Два разных вопроса: «есть ли провайдер» и «начнётся ли покупка».
    // Покупка не начнётся без варианта товара у LemonSqueezy, а он
    // задаётся отдельной переменной на каждый тариф.
    //
    // Проверяем именно РАЗНИЦУ: тест на одно поле доказывал бы лишь то,
    // что оно существует.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("LEMON_SQUEEZY_VARIANT_")) delete process.env[k];
    }
    delete process.env.GUMROAD_ACCESS_TOKEN;
    delete process.env.PAYBOX_MERCHANT_ID;
    delete process.env.PAYPAL_CLIENT_ID;

    const без = await request(app()).get("/api/health/channels");
    expect(без.body.canPay).toBe(true);
    expect(без.body.canStartPurchase).toBe(false);

    process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "12345";
    const с = await request(app()).get("/api/health/channels");
    expect(с.body.canStartPurchase).toBe(true);
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY;
  });
});

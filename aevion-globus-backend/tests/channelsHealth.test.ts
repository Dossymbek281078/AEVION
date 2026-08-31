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
  "BREVO_API_KEY",
  "ADMIN_TOKEN",
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
});

describe("Почта: три пути, три ответа", () => {
  /*
   * 31.08.2026 два окна намеряли состояние почты и получили противоположные
   * ответы — оба верные. Одно спрашивало путь входа (Resend, работает), другое
   * видело молчащую отправку (SMTP без пароля). Слово «почта» покрывало три
   * механизма, и каждый был прав про свой.
   *
   * Эти проверки закрепляют, что общего ответа тут нет и не должно быть.
   */
  test("Resend поднимает ТОЛЬКО вход: подписка и уведомление молчат", async () => {
    process.env.RESEND_API_KEY = "re_x";
    const r = await get();

    expect(r.body.mail.signup.configured).toBe(true);
    expect(r.body.mail.waitlist.configured, "подписка идёт через Brevo, не Resend").toBe(false);
    expect(r.body.mail.founderNotify.configured, "уведомление идёт по SMTP").toBe(false);
  });

  test("Brevo поднимает ТОЛЬКО подписку", async () => {
    process.env.BREVO_API_KEY = "xkeysib_x";
    const r = await get();

    expect(r.body.mail.waitlist.configured).toBe(true);
    expect(r.body.mail.signup.configured).toBe(false);
    expect(r.body.mail.founderNotify.configured).toBe(false);
  });

  test("SMTP без пароля не поднимает НИЧЕГО — это и было настоящее состояние прода", async () => {
    // 31.08 на проде заданы SMTP_HOST, SMTP_USER, SMTP_PORT, SMTP_FROM — и не
    // задан SMTP_PASS. Транспорт при этом возвращает null и отправка выходит
    // молча: заявка на бирже принята, основатель о ней не узнаёт.
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_USER = "u";
    const r = await get();

    expect(r.body.mail.founderNotify.configured).toBe(false);
    expect(r.body.mail.signup.configured).toBe(false);
  });

  test("полный SMTP поднимает вход И уведомление, но не подписку", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    const r = await get();

    expect(r.body.mail.founderNotify.configured).toBe(true);
    expect(r.body.mail.signup.configured).toBe(true);
    expect(r.body.mail.waitlist.configured).toBe(false);
  });

  test("общего поля «почта настроена» нет — оно и было источником спора", async () => {
    process.env.RESEND_API_KEY = "re_x";
    const r = await get();

    // Проверяем СМЫСЛ, а не точный набор ключей: первая редакция требовала
    // ровно три поля и покраснела на добавлении счётчика суток — то есть
    // мешала работе вместо того, чтобы стеречь. Стеречь надо одно: чтобы не
    // завели общий ответ «почта настроена», который и был источником спора.
    for (const путь of ["signup", "waitlist", "founderNotify"]) {
      expect(r.body.mail[путь], `пропал путь ${путь}`).toBeDefined();
    }
    expect(r.body.mail.configured, "общий ответ вернулся — уберите его").toBeUndefined();
    expect(r.body.mail.ok, "общий ответ под другим именем").toBeUndefined();
  });
});

describe("расход писем за сутки виден снаружи", () => {
  test("ручка отдаёт счётчик и потолок", async () => {
    // Скрипт рассылки живёт в отдельном процессе и счётчик сервера сам по себе
    // видит нулём. Без этих двух чисел он мог бы пробить суточный потолок
    // провайдера: 301-е письмо не уходит, и узнать об этом неоткуда.
    const r = await get();

    // Потолок открыт: это свойство тарифа у провайдера. Расход — нет: по нему
    // видно, сколько на платформе движения, и посторонним это ни к чему.
    expect(r.body.mail.dailyCap, "нет потолка суток").toBeGreaterThan(0);

    // Значение латиницей: кириллица в HTTP-заголовке недопустима.
    process.env.ADMIN_TOKEN = "t0ken-test";
    const чужой = await get();
    expect(чужой.body.mail.sentToday, "расход виден без токена").toBeUndefined();

    const свой = await request(app()).get("/api/health/channels").set("x-admin-token", "t0ken-test");
    expect(typeof свой.body.mail.sentToday, "по токену расход не отдан").toBe("number");
    delete process.env.ADMIN_TOKEN;
  });
});

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { authRouter } from "../src/routes/auth";
import { canSendEmail } from "../src/lib/build/email";

/**
 * Сторож: ручка «может ли уйти письмо» согласна с тем, кто письма шлёт.
 *
 * ЗАЧЕМ. 29.08.2026 /api/auth/email/healthz считала почту настроенной при
 * ЛЮБОМ из двух имён — RESEND_API_KEY или RESEND_KEY. А все отправители
 * (lib/build/email.ts, routes/build/alerts.ts, applications.ts, vacancies.ts)
 * читают только первое. Задай кто-нибудь короткое имя — ручка отвечала бы
 * «почта настроена», и не ушло бы ни одно письмо.
 *
 * Ручка существует ровно чтобы ответить «может ли новый человек
 * зарегистрироваться». Проверка, которая МЯГЧЕ исполнителя, хуже
 * отсутствующей: она успокаивает.
 */
const КЛЮЧИ = ["RESEND_API_KEY", "RESEND_KEY", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const снимок: Record<string, string | undefined> = {};

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/auth", authRouter);
  return a;
}

beforeEach(() => {
  for (const k of КЛЮЧИ) {
    снимок[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of КЛЮЧИ) {
    if (снимок[k] === undefined) delete process.env[k];
    else process.env[k] = снимок[k];
  }
});

describe("состояние почты не мягче отправителя", () => {
  test("только RESEND_KEY — ручка обязана сказать «отправить нельзя»", async () => {
    // Тот самый случай: правдоподобная опечатка в имени переменной.
    process.env.RESEND_KEY = "re_короткое_имя";
    const r = await request(app()).get("/api/auth/email/healthz");
    expect(r.status).toBe(200);
    expect(r.body.canSend, "ручка обещает отправку, которой не будет").toBe(false);
    expect(canSendEmail()).toBe(false);
  });

  test("RESEND_API_KEY задан — обе стороны согласны, что отправить можно", async () => {
    process.env.RESEND_API_KEY = "re_настоящее_имя";
    const r = await request(app()).get("/api/auth/email/healthz");
    expect(r.body.canSend).toBe(true);
    expect(canSendEmail()).toBe(true);
  });

  test("ничего не задано — обе стороны согласны, что нельзя", async () => {
    const r = await request(app()).get("/api/auth/email/healthz");
    expect(r.body.canSend).toBe(false);
    expect(canSendEmail()).toBe(false);
  });

  test("значение ключа наружу не уходит", async () => {
    process.env.RESEND_API_KEY = "re_секрет_не_для_показа";
    const r = await request(app()).get("/api/auth/email/healthz");
    expect(JSON.stringify(r.body)).not.toContain("re_секрет_не_для_показа");
  });
});

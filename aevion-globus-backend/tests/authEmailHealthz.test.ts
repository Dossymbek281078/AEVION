import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Ручка отвечает на вопрос «может ли новый человек зарегистрироваться» без
 * пробной отправки письма и без похода в панель хостинга.
 *
 * Повод: 19.08.2026 выяснилось, что зарегистрироваться нельзя ни одним путём —
 * оба OAuth-провайдера не настроены, а подтверждение адреса создаёт токен и
 * возвращает `{ok:true}`, ничего не отправляя. Узнать снаружи, настроен ли
 * почтовый транспорт, было НЕЛЬЗЯ: ручки состояния не существовало, в отличие
 * от оплаты, где она есть и её спрашивает страница цен.
 *
 * Секреты не отдаются — только признак наличия.
 */

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};

const MAIL_VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY", "RESEND_KEY"];

describe("Состояние отправки писем", () => {
  beforeEach(() => { MAIL_VARS.forEach((v) => delete process.env[v]); });

  test("ничего не настроено — canSend false", async () => {
    const r = await request(app()).get("/email/healthz");
    expect(r.status).toBe(200);
    expect(r.body.canSend).toBe(false);
    expect(r.body.transports.smtp.configured).toBe(false);
    expect(r.body.transports.resend.configured).toBe(false);
  });

  test("SMTP задан целиком — canSend true", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    const r = await request(app()).get("/email/healthz");
    expect(r.body.transports.smtp.configured).toBe(true);
    expect(r.body.canSend).toBe(true);
  });

  test("SMTP задан НЕ целиком — считается ненастроенным", async () => {
    // Половина настроек хуже, чем ничего: письма не уйдут, а выглядит как «есть».
    process.env.SMTP_HOST = "smtp.example.com";
    const r = await request(app()).get("/email/healthz");
    expect(r.body.transports.smtp.configured).toBe(false);
    expect(r.body.canSend).toBe(false);
  });

  test("Resend задан — canSend true", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const r = await request(app()).get("/email/healthz");
    expect(r.body.transports.resend.configured).toBe(true);
    expect(r.body.canSend).toBe(true);
  });

  test("секреты наружу не отдаются", async () => {
    process.env.SMTP_HOST = "smtp.secret-host.example";
    process.env.SMTP_USER = "user@secret";
    process.env.SMTP_PASS = "p4ssw0rd";
    const r = await request(app()).get("/email/healthz");
    const body = JSON.stringify(r.body);
    expect(body).not.toContain("p4ssw0rd");
    expect(body).not.toContain("secret-host");
    expect(body).not.toContain("user@secret");
  });

  test("честно сообщает, что подтверждение адреса писем не шлёт", async () => {
    const r = await request(app()).get("/email/healthz");
    expect(r.body.emailVerifySendsMail).toBe(false);
  });
});

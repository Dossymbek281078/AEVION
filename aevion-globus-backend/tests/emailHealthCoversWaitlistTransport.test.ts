import { describe, expect, it, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import { authRouter } from "../src/routes/auth";

/**
 * Ручка состояния почты обязана называть ТОТ транспорт, которым уходит письмо
 * канала запуска.
 *
 * Замер 28.08.2026 на проде:
 *
 *   GET /api/auth/email/healthz -> {"transports":{"smtp":{...},"resend":{...}},
 *                                   "canSend":true}
 *
 * А письмо подписчику списка раннего доступа уходит через Brevo
 * (sendWaitlistConfirm -> sendBrevoEmail, ключ BREVO_API_KEY), и его в ответе
 * не было вовсе. То есть платформа отвечала «почта настроена» про транспорты,
 * которыми запускное письмо НЕ отправляется: имя поля шире того, что оно
 * измеряет.
 *
 * Цена: без ключа Brevo каждое подтверждение подписки молча не уходит. Отказ
 * честный (журнал + Sentry), но снаружи, за два дня до запуска, ответ ручки
 * говорил обратное.
 *
 * Регулярок нет намеренно: слэши теряются на границе вызова, и тогда файл
 * молча перестаёт разбираться («no tests» вместо красного).
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/auth", authRouter);
  return a;
}

const saved = { ...process.env };
beforeEach(() => {
  delete process.env.BREVO_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_KEY;
});
afterEach(() => { process.env = { ...saved }; });

describe("состояние почты покрывает транспорт канала запуска", () => {
  it("контроль прибора: ручка отвечает и перечисляет транспорты", async () => {
    const res = await request(app()).get("/api/auth/email/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("transports");
  });

  it("Brevo назван среди транспортов", async () => {
    const res = await request(app()).get("/api/auth/email/healthz");
    expect(
      res.body.transports,
      "письмо подписчику уходит через Brevo, а ручка о нём молчит",
    ).toHaveProperty("brevo");
  });

  it("без ключа Brevo ответ прямо говорит, что запускное письмо не уйдёт", async () => {
    const res = await request(app()).get("/api/auth/email/healthz");
    expect(res.body.transports.brevo.configured).toBe(false);
    expect(
      res.body.waitlistCanSend,
      "ключа нет, а ответ не сообщает, что канал запуска молчит",
    ).toBe(false);
  });

  it("с ключом Brevo — говорит, что уйдёт", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const res = await request(app()).get("/api/auth/email/healthz");
    expect(res.body.transports.brevo.configured).toBe(true);
    expect(res.body.waitlistCanSend).toBe(true);
  });

  it("контроль: canSend НЕ подменён — он про регистрацию, не про рассылку", async () => {
    // Если «согласовать» поля, сделав canSend зависимым от Brevo, сломается
    // ответ на исходный вопрос ручки: может ли новый человек подтвердить адрес.
    process.env.BREVO_API_KEY = "test-key";
    const res = await request(app()).get("/api/auth/email/healthz");
    expect(res.body.canSend, "canSend позеленел от чужого транспорта").toBe(false);
  });
});

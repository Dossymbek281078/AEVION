/**
 * Ручка состояния вебхука Gumroad обязана говорить, удостоверяется ли пинг —
 * а не только жив ли адрес.
 *
 * Замер на проде 28.08.2026: ответ содержал одно `signed: false`. Это ПОЛОВИНА
 * ответа, и вторая половина решает всё:
 *
 *   подпись не проверяется (нет GUMROAD_WEBHOOK_SECRET)
 *     + подтверждение продажи невозможно (нет GUMROAD_ACCESS_TOKEN)
 *     = любой POST на публично известный Ping-адрес выдаёт платный тариф
 *
 * Обработчик на вердикте "unverifiable" провижинит СОЗНАТЕЛЬНО: настоящий
 * покупатель не должен терять доступ из-за сбоя у Gumroad. Решение верное, но
 * пока снаружи не видно, в каком мы режиме, беззащитность неотличима от
 * защищённости.
 *
 * Проверяется ПОВЕДЕНИЕ ручки при разных переменных окружения, а не наличие
 * строки в исходнике.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

const KEYS = ["GUMROAD_WEBHOOK_SECRET", "GUMROAD_ACCESS_TOKEN", "GUMROAD_VERIFY_SALES"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function status() {
  const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
  const app = express();
  app.use("/api/gumroad", gumroadWebhookRouter);
  const res = await request(app).get("/api/gumroad/webhook");
  expect(res.status).toBe(200);
  return res.body as {
    signed: boolean;
    saleVerification: string;
    pingAuthenticated: boolean;
  };
}

describe("состояние вебхука Gumroad честно называет режим", () => {
  it("ни подписи, ни токена — пинг НЕ удостоверяется", async () => {
    const b = await status();
    expect(b.signed).toBe(false);
    expect(b.saleVerification).toBe("unavailable");
    // Главное поле: именно это состояние было на проде и выглядело нормально.
    expect(b.pingAuthenticated).toBe(false);
  });

  it("есть токен — пинг удостоверяется подтверждением продажи", async () => {
    process.env.GUMROAD_ACCESS_TOKEN = "test-token";
    const b = await status();
    expect(b.saleVerification).toBe("api");
    expect(b.pingAuthenticated).toBe(true);
  });

  it("есть секрет подписи — этого достаточно и без токена", async () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "test-secret";
    const b = await status();
    expect(b.signed).toBe(true);
    expect(b.pingAuthenticated).toBe(true);
  });

  it("аварийный выключатель проверки продаж виден в ответе", async () => {
    process.env.GUMROAD_ACCESS_TOKEN = "test-token";
    process.env.GUMROAD_VERIFY_SALES = "0";
    const b = await status();
    // Токен есть, но проверка выключена — значит защиты снова нет, и поле
    // обязано это показать, а не считать наличие токена достаточным.
    expect(b.saleVerification).toBe("disabled");
    expect(b.pingAuthenticated).toBe(false);
  });

  it("секретов в ответе нет", async () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "super-secret-value";
    process.env.GUMROAD_ACCESS_TOKEN = "super-secret-token";
    const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
    const app = express();
    app.use("/api/gumroad", gumroadWebhookRouter);
    const res = await request(app).get("/api/gumroad/webhook");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("super-secret-value");
    expect(body).not.toContain("super-secret-token");
  });
});

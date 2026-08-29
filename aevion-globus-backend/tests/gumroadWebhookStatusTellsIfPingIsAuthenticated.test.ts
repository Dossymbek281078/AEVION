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

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
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

/**
 * Роутер импортируется ОДИН раз, а не на каждый вызов.
 *
 * Было по импорту в каждой проверке — шесть на файл. Под нагрузкой (шесть
 * чужих сборок на машине) первый динамический import большого роутера не
 * уложился в 30 с, и набор дал красную на ровном месте: изолированно тот же
 * файл проходит за секунду. Это известный класс — «await import() роутера в
 * тесте даёт ложный таймаут».
 *
 * Кеширование безопасно и даже полезно: ручка читает process.env ПРИ ЗАПРОСЕ,
 * и то, что шесть проверок получают разные ответы от одного модуля, это
 * доказывает.
 */
let app: express.Express;

beforeAll(async () => {
  const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
  app = express();
  app.use("/api/gumroad", gumroadWebhookRouter);
});

async function status() {
  const res = await request(app).get("/api/gumroad/webhook");
  expect(res.status).toBe(200);
  return res.body as {
    signed: boolean;
    saleVerification: string;
    anyPingProvisions: boolean;
  };
}

describe("состояние вебхука Gumroad честно называет режим", () => {
  it("ни подписи, ни токена — пинг НЕ удостоверяется", async () => {
    const b = await status();
    expect(b.signed).toBe(false);
    expect(b.saleVerification).toBe("unavailable");
    // Главное поле: именно это состояние было на проде и выглядело нормально.
    expect(b.anyPingProvisions).toBe(true);
  });

  it("есть токен — пинг удостоверяется подтверждением продажи", async () => {
    process.env.GUMROAD_ACCESS_TOKEN = "test-token";
    const b = await status();
    expect(b.saleVerification).toBe("api");
    expect(b.anyPingProvisions).toBe(false);
  });

  it("есть секрет подписи — этого достаточно и без токена", async () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "test-secret";
    const b = await status();
    expect(b.signed).toBe(true);
    expect(b.anyPingProvisions).toBe(false);
  });

  it("аварийный выключатель проверки продаж виден в ответе", async () => {
    process.env.GUMROAD_ACCESS_TOKEN = "test-token";
    process.env.GUMROAD_VERIFY_SALES = "0";
    const b = await status();
    // Токен есть, но проверка выключена — значит защиты снова нет, и поле
    // обязано это показать, а не считать наличие токена достаточным.
    expect(b.saleVerification).toBe("disabled");
    expect(b.anyPingProvisions).toBe(true);
  });

it("пробел в переменной — это НЕ настроенный токен", async () => {
    // Boolean(" ") истинно, и без trim ручка отвечала бы «защищено», когда
    // защиты нет. Переменные, забытые пустыми, выглядят именно так.
    process.env.GUMROAD_ACCESS_TOKEN = "   ";
    process.env.GUMROAD_WEBHOOK_SECRET = "  ";
    const b = await status();
    expect(b.signed).toBe(false);
    expect(b.saleVerification).toBe("unavailable");
    expect(b.anyPingProvisions).toBe(true);
  });

  it("секретов в ответе нет", async () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "super-secret-value";
    process.env.GUMROAD_ACCESS_TOKEN = "super-secret-token";
    const res = await request(app).get("/api/gumroad/webhook");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("super-secret-value");
    expect(body).not.toContain("super-secret-token");
  });
});

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { checkoutRouter } from "../src/routes/checkout";

/**
 * Сторож: снаружи видно, какие тарифы Gumroad реально может продать.
 *
 * ЗАЧЕМ. 29.08.2026 выбор провайдера стал уходить на Gumroad, когда
 * LemonSqueezy не может ВЫДАТЬ купленное (нет секрета вебхука). Уходить есть
 * смысл только туда, где тариф действительно продаётся: у Gumroad для этого
 * нужна ссылка на товар, а поле `configured` отвечало лишь про токен доступа.
 *
 * Без этого поля вопрос «а Gumroad-то сможет продать?» нельзя было задать
 * снаружи вовсе — только чтением кода и переменных сервиса.
 */
const КЛЮЧИ = ["GUMROAD_ACCESS_TOKEN", "GUMROAD_DEFAULT_PERMALINK"];
const снимок: Record<string, string | undefined> = {};

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

beforeEach(() => {
  for (const k of КЛЮЧИ) снимок[k] = process.env[k];
});
afterEach(() => {
  for (const k of КЛЮЧИ) {
    if (снимок[k] === undefined) delete process.env[k];
    else process.env[k] = снимок[k];
  }
});

describe("healthz показывает, что Gumroad может продать", () => {
  test("без ссылок ни один тариф не продаётся, и это видно", async () => {
    delete process.env.GUMROAD_DEFAULT_PERMALINK;
    const r = await request(app()).get("/api/pricing/checkout/healthz");
    expect(r.status).toBe(200);
    const s = r.body.providers.gumroad.sellable;
    expect(s, "поле sellable у gumroad отсутствует").toBeTruthy();
    // Знаменатель называем вслух: пустой список читался бы как «всё хорошо».
    expect(s.configured.length + s.missing.length).toBeGreaterThan(4);
    // И проверяем СЛЕДСТВИЕ, а не только форму: без ссылок тарифы обязаны
    // попасть в «непродаваемые». Проверка суммы это пропускала — мутация
    // «объявить всё продаваемым» проходила мимо неё.
    expect(s.missing.length).toBeGreaterThan(4);
    expect(s.configured).toEqual([]);
  });

  test("общая ссылка делает продаваемыми все тарифы", async () => {
    process.env.GUMROAD_DEFAULT_PERMALINK = "aevion-default";
    const r = await request(app()).get("/api/pricing/checkout/healthz");
    const s = r.body.providers.gumroad.sellable;
    expect(s.missing).toEqual([]);
    expect(s.configured.length).toBeGreaterThan(4);
  });

  test("значения переменных наружу не уходят — только имена тарифов", async () => {
    process.env.GUMROAD_DEFAULT_PERMALINK = "секретная-ссылка-не-для-показа";
    const r = await request(app()).get("/api/pricing/checkout/healthz");
    expect(JSON.stringify(r.body)).not.toContain("секретная-ссылка-не-для-показа");
  });
});

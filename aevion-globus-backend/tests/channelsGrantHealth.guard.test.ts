import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { channelsHealthRouter } from "../src/routes/channelsHealth";

/**
 * «Платить можно» и «оплата даёт доступ» — разные вопросы.
 *
 * Замер 28.08.2026 на боевом проде: `/api/health/channels` отвечал
 * `canPay: true`, потому что у Lemon Squeezy заданы ключ и магазин. Но выдача
 * прав висит не на этом, а на переменной КОНКРЕТНОГО варианта товара:
 * вебхук сравнивает `attrs.variant_id` с `process.env[...VARIANT_X]`, и при
 * незаданной переменной сравнение не совпадает — обработчик доходит до
 * `return res.json({ ok: true, ignored: event })`.
 *
 * То есть заплативший $149 за DevHub Studio Pro получил бы успешный ответ и
 * НИ ОДНОГО права, магазин при этом деньги принял, а наша проверка каналов
 * продолжала бы отвечать «оплата настроена». Ровно тот класс, ради которого
 * ручка и заведена: она спрашивала «отвечает ли провайдер», а не «получилось
 * ли у человека».
 *
 * Проверяется ПОВЕДЕНИЕМ, на обоих исходах: разбор кода тут доказал бы только
 * наличие строк.
 */

const KEYS = ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID"];
const VARIANT = "LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO";
const saved: Record<string, string | undefined> = {};

// Обход кеша модулей не нужен и вреден: и `set()`, и `variantMappingStatus()`
// читают окружение В МОМЕНТ ВЫЗОВА, внутри обработчика. Первая версия дописывала
// к пути запрос со случайным числом — разбор на этом падал, и пять проверок
// краснели по причине, не имеющей отношения к предмету.
function app() {
  const a = express();
  a.use("/api/health", channelsHealthRouter);
  return a;
}

describe("оплата, превращающаяся в доступ", () => {
  beforeEach(() => {
    for (const k of [...KEYS, VARIANT]) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test("прибор работает: ручка отвечает и отдаёт оба поля", async () => {
    const r = await request(app()).get("/api/health/channels");
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("canPay");
    expect(r.body).toHaveProperty("canGrant");
  });

  test("провайдер настроен, но НИ ОДИН товар не сопоставлен → canGrant false", async () => {
    for (const k of KEYS) process.env[k] = "x";
    // Снимаем все переменные вариантов — это и есть «деньги берём, прав нет».
    const all = Object.keys(process.env).filter((k) => k.startsWith("LEMON_SQUEEZY_VARIANT_"));
    const back: Record<string, string | undefined> = {};
    for (const k of all) { back[k] = process.env[k]; delete process.env[k]; }
    try {
      const r = await request(app()).get("/api/health/channels");
      expect(r.body.canPay, "провайдер должен считаться настроенным").toBe(true);
      expect(r.body.canGrant, "оплата не даёт прав, а ручка молчит").toBe(false);
      expect(r.body.payments.lemonsqueezy.variants.mapped).toBe(0);
      expect(r.body.missing.join(" ")).toContain("LEMON_SQUEEZY_VARIANT_");
    } finally {
      for (const [k, v] of Object.entries(back)) if (v !== undefined) process.env[k] = v;
    }
  });

  test("сопоставлен хотя бы один товар → canGrant true", async () => {
    for (const k of KEYS) process.env[k] = "x";
    process.env[VARIANT] = "999999";
    const r = await request(app()).get("/api/health/channels");
    expect(r.body.canGrant).toBe(true);
    expect(r.body.payments.lemonsqueezy.variants.mapped).toBeGreaterThan(0);
    expect(r.body.payments.lemonsqueezy.variants.unmapped).not.toContain("app_devhub");
  });

  test("секретов не отдаём: значения вариантов наружу не уходят", async () => {
    for (const k of KEYS) process.env[k] = "x";
    process.env[VARIANT] = "SECRET-VARIANT-4242";
    const r = await request(app()).get("/api/health/channels");
    expect(JSON.stringify(r.body)).not.toContain("SECRET-VARIANT-4242");
    expect(JSON.stringify(r.body)).not.toContain("4242");
  });

  test("провайдер вовсе не настроен → canGrant не краснеет зря", async () => {
    // Вечно красная проверка перестаёт читаться: если магазина нет, вопрос
    // «даёт ли оплата доступ» не задан, и отвечать на него «нет» нечестно.
    for (const k of KEYS) delete process.env[k];
    const r = await request(app()).get("/api/health/channels");
    expect(r.body.canGrant).toBe(true);
  });
});

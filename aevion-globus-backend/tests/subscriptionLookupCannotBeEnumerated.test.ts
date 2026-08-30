/**
 * Публичный поиск подписки по адресу нельзя использовать для ПЕРЕБОРА.
 *
 * `/api/pricing/provisioning/history?email=…` намеренно открыт: страница
 * /pricing/provisioning показывает человеку его подписку без входа. Цена
 * решения — тем же запросом спрашивают про ЧУЖОЙ адрес и получают тариф,
 * сумму оплаты, промокод и список модулей. Замер на проде 28.08.2026:
 *
 *     GET /api/pricing/provisioning/history?email=<любой>
 *     -> 200 {"email":"def***@example.invalid","count":0,"items":[]}
 *
 * Убрать функцию — решение основателя. Что от этого не зависит: перебор
 * списка адресов должен упираться в предел. Здесь это и закрепляется.
 *
 * Проверяется ПОВЕДЕНИЕ (появляется 429), а не наличие строки с rateLimit в
 * исходнике: сторож, ищущий слово, зеленеет от переименования переменной.
 */

import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

let app: express.Express;

beforeAll(async () => {
  const { provisioningRouter } = await import("../src/routes/provisioning");
  app = express();
  // trust proxy как в index.ts (строка 139). Без него express игнорирует
  // X-Forwarded-For, все запросы теста выглядят пришедшими с одного адреса,
  // и проверка «предел считается по источнику» падает — но падает она на
  // МОЕЙ оснастке, а не на ограничителе. Первый прогон именно так и упал.
  app.set("trust proxy", 1);
  // Тот же путь монтирования, что в index.ts.
  app.use("/api/pricing/provisioning", provisioningRouter);
});

describe("поиск подписки по адресу не перебирается", () => {
  it("одиночный запрос проходит — функцию не сломали", async () => {
    // Отрицательный контроль: если бы ручка отвечала 429 всегда, тест ниже
    // был бы зелёным на полностью нерабочей функции.
    const res = await request(app)
      .get("/api/pricing/provisioning/history?email=single@example.invalid")
      .set("X-Forwarded-For", "203.0.113.10");
    expect(res.status).toBe(200);
  });

  it("перебор адресов упирается в предел", async () => {
    const ip = "203.0.113.77";
    let sawLimit = false;
    let servedBeforeLimit = 0;

    // 40 разных адресов подряд — ровно то, как выглядит проверка списка.
    for (let i = 0; i < 40; i++) {
      const res = await request(app)
        .get(`/api/pricing/provisioning/history?email=victim${i}@example.invalid`)
        .set("X-Forwarded-For", ip);
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
      servedBeforeLimit += 1;
    }

    expect(sawLimit).toBe(true);
    // Предел должен быть достижимым, но не мешать живому человеку: он
    // смотрит свою подписку раз-другой, а не десятками.
    expect(servedBeforeLimit).toBeGreaterThan(0);
    expect(servedBeforeLimit).toBeLessThan(40);
  });

  it("предел считается по адресу источника, а не на всех сразу", async () => {
    // Иначе один перебирающий заблокировал бы всех остальных покупателей —
    // отказ в обслуживании вместо защиты.
    const res = await request(app)
      .get("/api/pricing/provisioning/history?email=other@example.invalid")
      .set("X-Forwarded-For", "198.51.100.5");
    expect(res.status).toBe(200);
  });
});

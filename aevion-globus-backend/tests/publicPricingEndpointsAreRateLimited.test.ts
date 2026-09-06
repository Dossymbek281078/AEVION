import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: публичные ручки модуля цен ограничены по темпу.
 *
 * ЗАМЕР 02.09.2026: из 12 POST-ручек предел стоял у пяти. Без предела
 * оставались, в частности:
 *   • /promo/validate — оракул «код верен или нет», то есть перебор
 *     промокодов (их пять, имена короткие);
 *   • /lead и /newsletter — анонимная запись строки в ФАЙЛ на диске.
 *
 * Проверяется не наличие строки rateLimit, а СПОСОБНОСТЬ отказать.
 *
 * ⚠️ ПОРЯДОК ЗДЕСЬ — ЧАСТЬ ПРОВЕРКИ, а не случайность. Ограничители живут в
 * модуле, сброса у них нет, а подменить адрес нельзя: заголовку X-Real-IP
 * доверяют только из внутренней сети (и это правильно). Поэтому каждая ручка
 * исчерпывается РОВНО ОДИН раз, а «бакеты разные» проверяется внутри первого
 * потока, пока соседние ручки ещё не тронуты. Переставите тесты местами —
 * получите ложное «предела нет» на исправном коде.
 */
const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

const app = приложение();

const ТЕЛА = {
  "/promo/validate": { code: "NOPE", tier: "full", period: "monthly" },
  "/lead": { email: "l@example.test", message: "hi" },
  "/newsletter": { email: "n@example.test" },
} as const;

async function послать(путь: keyof typeof ТЕЛА) {
  return request(app).post(`/api/pricing${путь}`).send(ТЕЛА[путь]);
}

async function исчерпать(путь: keyof typeof ТЕЛА) {
  const первый = await послать(путь);
  // Контроль в том же тесте: «есть 429» удовлетворяется и кодом, который
  // отказывает ВСЕГДА, то есть сломанной ручкой.
  expect(первый.status, `[${путь}] первый же запрос отбит — это не предел, а поломка`).not.toBe(429);

  const коды: number[] = [первый.status];
  for (let i = 0; i < 60; i += 1) {
    const r = await послать(путь);
    коды.push(r.status);
    if (r.status === 429) break;
  }
  expect(коды, `[${путь}] 60 запросов подряд прошли без отказа — предела нет`).toContain(429);
}

describe("темп публичных ручек цен ограничен", () => {
  test("/promo/validate упирается в 429, и это НЕ задевает соседнюю ручку", async () => {
    await исчерпать("/promo/validate");

    // Общий бакет уже был находкой в этом репозитории: соседние ручки
    // начинают отбирать лимит друг у друга, и человек, отправивший заявку,
    // не может проверить промокод. Проверяем здесь, пока /lead не тронута.
    const сосед = await послать("/lead");
    expect(
      сосед.status,
      "исчерпали /promo/validate, а отказ получила /lead — значит бакет общий"
    ).not.toBe(429);
  });

  test("/lead упирается в 429", async () => {
    await исчерпать("/lead");
  });

  test("/newsletter упирается в 429", async () => {
    await исчерпать("/newsletter");
  });
});

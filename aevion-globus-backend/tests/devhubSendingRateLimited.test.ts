import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

// Отправляющие ручки DevHub обязаны иметь предел частоты — 19.08.2026.
//
// Что закрывается: аноним мог отправлять письма, SMS и WhatsApp с нашего аккаунта
// произвольным получателям без предела. Это возможность рассылать спам нашим
// именем, и от продуктового вопроса «DevHub — продукт или внутренний инструмент»
// она не зависит: посторонним нельзя ни при одном ответе.
//
// Проверяется ПОВЕДЕНИЕ, а не наличие строки в исходнике: сторож долга
// (paidEndpointsExposure) считает пометки у маршрутов и предел, объявленный
// списком через `devhubRouter.use`, не увидит вовсе. Поэтому здесь настоящие
// запросы до 429.

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: vi.fn(() => []), callProvider: vi.fn() }));

async function app() {
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  // Предел считается по адресу клиента, поэтому тестам нужен СВОЙ адрес каждому:
  // vitest делит процесс между файлами, состояние ограничителя в модуле общее, и
  // без этого чужие запросы съедают наш бакет. Ровно так и случилось: файл
  // проходил в одиночку и падал в полном прогоне — отрицательный контроль
  // сообщал, что предел задел читающую ручку, хотя её в списке нет.
  a.set("trust proxy", true);
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

let ipCounter = 0;
/** Свой адрес на каждый вызов: 10.0.x.y, не пересекается с чужими тестами. */
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

/** Первый код 429 на серии запросов — или null, если предела нет. */
async function firstThrottled(path: string, tries: number): Promise<number | null> {
  const a = await app();
  const ip = freshIp();
  for (let i = 0; i < tries; i++) {
    const r = await request(a).post(path).set("X-Forwarded-For", ip).send({});
    if (r.status === 429) return i + 1;
  }
  return null;
}

describe("отправляющие ручки не дают рассылать без предела", () => {
  // Предел 30 в минуту (GENERATION_RATE_LIMIT), поэтому 40 попыток заведомо
  // перешагивают его, а до 429 успевает пройти достаточно, чтобы отличить
  // «предел есть» от «ручка вообще всё отвергает».
  test("/media/sms упирается в предел", async () => {
    const at = await firstThrottled("/api/devhub/media/sms", 40);
    expect(at, "SMS можно отправлять анонимно и без предела").not.toBeNull();
    expect(at).toBeGreaterThan(1); // не «отвергает всё подряд»
  });

  test("/media/whatsapp упирается в предел", async () => {
    const at = await firstThrottled("/api/devhub/media/whatsapp", 40);
    expect(at, "WhatsApp можно отправлять анонимно и без предела").not.toBeNull();
  });

  test("/media/email упирается в предел", async () => {
    const at = await firstThrottled("/api/devhub/media/email", 40);
    expect(at, "письма можно отправлять анонимно и без предела").not.toBeNull();
  });

  test("читающая ручка предела отправки НЕ получила", async () => {
    // Отрицательный контроль: если бы предел стоял на всём роутере, обычные
    // чтения ломались бы у первого же активного пользователя страницы.
    const a = await app();
    const ip = freshIp();
    let throttled = 0;
    for (let i = 0; i < 40; i++) {
      const r = await request(a).get("/api/devhub/providers/health").set("X-Forwarded-For", ip);
      if (r.status === 429) throttled++;
    }
    expect(throttled, "предел задел читающие ручки — так нельзя").toBe(0);
  });
});

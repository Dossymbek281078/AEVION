import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Отзыв прав уведомляет подписчиков.
 *
 * `qright.object.revoked` — ЕДИНСТВЕННОЕ событие, которое шлёт модуль, и до
 * 28.08.2026 его не проверял ни один тест (совпадения по слову «revoke» в
 * наборе приходились на чужие модули).
 *
 * Почему это важнее, чем кажется. Значок и врезка отвечают на запрос, то есть
 * показывают правду тому, кто СПРОСИЛ. Подписчик спрашивать не обязан: он
 * встроил наш значок и живёт дальше. Уведомление — единственный способ сказать
 * ему «эти права больше не действуют», и уходит оно «выстрелил и забыл»: отказ
 * доставки не виден ни вызывающему, ни владельцу.
 *
 * Подмена доставки — ЗАПИСЫВАЮЩАЯ и годная, а не бросающая: бросающую проглотит
 * catch, и «не вызывали» осталось бы недоказанным.
 */

const h = vi.hoisted(() => ({
  sent: [] as Array<{ url: string; body: string }>,
  webhooks: [] as Array<{ id: string; url: string; secret: string }>,
}));

vi.mock("../src/lib/webhookDelivery", () => ({
  // Сигнатура позиционная: deliverWebhook(pool, cfg, opts). Первый заход я
  // прочитал первый аргумент и получил пустые поля — доставка при этом ЗВАЛАСЬ.
  // То есть «поле пустое» значило «читаю не тот аргумент», а не «не вызывали».
  deliverWebhook: async (_pool: unknown, _cfg: unknown, opts: any) => {
    h.sent.push({ url: String(opts?.url ?? ""), body: String(opts?.body ?? "") });
    return { ok: true, statusCode: 200, error: null };
  },
}));

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async (sql?: string) => {
      const s = String(sql ?? "");
      if (s.includes("QRightWebhook")) return { rows: h.webhooks, rowCount: h.webhooks.length };
      if (s.trimStart().toUpperCase().startsWith("UPDATE")) {
        return { rows: [{ id: "obj-1", revokedAt: new Date("2026-08-28T20:00:00Z") }], rowCount: 1 };
      }
      return {
        rows: [{ id: "obj-1", ownerUserId: "owner-1", ownerEmail: "o@example.com", revokedAt: null }],
        rowCount: 1,
      };
    },
  }),
}));

vi.mock("../src/lib/ensureQRightTable", () => ({ ensureQRightTable: async () => {} }));
vi.mock("../src/lib/authJwt", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, verifyBearerOptional: () => ({ sub: "owner-1" }) };
});

import { qrightRouter } from "../src/routes/qright";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qrightRouter);
  return a;
}

/** Уведомление уходит вне ответа. Ждём ПОЯВЛЕНИЯ записи, а не фиксированную
 *  паузу: пауза — это ставка на скорость машины. */
async function waitForSent(n: number, ticks = 50) {
  for (let i = 0; i < ticks && h.sent.length < n; i++) {
    await new Promise((r) => setImmediate(r));
  }
  return h.sent.length;
}

beforeEach(() => {
  h.sent = [];
  h.webhooks = [{ id: "wh-1", url: "https://partner.example/hook", secret: "s3cret" }];
});

describe("отзыв прав уведомляет подписчиков", () => {
  test("у владельца есть подписчик — уведомление уходит", async () => {
    const res = await request(app())
      .post("/x/revoke/obj-1")
      .send({ reason: "передал права", reasonCode: "withdrawn" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await waitForSent(1), "подписчик не узнал об отзыве").toBe(1);
    expect(h.sent[0].url).toBe("https://partner.example/hook");
  });

  test("в теле уведомления названо событие и объект", async () => {
    await request(app())
      .post("/x/revoke/obj-1")
      .send({ reason: "спор о правах", reasonCode: "dispute" });
    await waitForSent(1);

    const body = h.sent[0]?.body ?? "";
    expect(body.includes("qright.object.revoked"), "событие не названо").toBe(true);
    expect(body.includes("obj-1"), "объект не назван — подписчик не поймёт, что отозвано").toBe(true);
    expect(body.includes("dispute"), "причина не доехала до подписчика").toBe(true);
  });

  test("подписчиков нет — ничего не шлём и не падаем", async () => {
    // Пара к первой проверке: без неё была бы зелёной отправка ВСЕГДА и всем.
    h.webhooks = [];
    const res = await request(app())
      .post("/x/revoke/obj-1")
      .send({ reasonCode: "withdrawn" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    await waitForSent(1, 20);
    expect(h.sent.length, "уведомление ушло, хотя подписчиков нет").toBe(0);
  });
});

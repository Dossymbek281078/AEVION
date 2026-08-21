/**
 * Повторная подписка не шлёт второе письмо.
 *
 * Замер на живом проде 21.08.2026: две подписки одним адресом подряд дали
 * ДВА одинаковых письма за две секунды. При запуске люди нажимают кнопку
 * дважды — это обычное дело, а суточный потолок Brevo 300 писем.
 *
 * Различаем вставку и конфликт через `RETURNING (xmax = 0) AS inserted` —
 * штатный приём Postgres. Тест проверяет ОБА направления: новая подписка
 * письмо шлёт, повторная нет. Одного случая мало: проверка «письмо не
 * ушло» зеленела бы и на коде, который не шлёт никогда.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const query = vi.fn();
const sendConfirm = vi.fn(async () => true);

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query }) }));
vi.mock("../src/lib/constitutionBrevo", () => ({
  sendWaitlistConfirm: (...a: unknown[]) => sendConfirm(...(a as [])),
  sendWeeklyDigestEmail: vi.fn(async () => ({ sent: 0, errors: 0, degraded: 0 })),
}));

import { constitutionWaitlistRouter } from "../src/routes/constitutionWaitlist";

const app = express();
app.use(express.json());
app.use("/api/constitution/waitlist", constitutionWaitlistRouter);

const subscribe = (email: string) =>
  request(app).post("/api/constitution/waitlist/subscribe").send({ email, source: "cyberchess-probe" });

beforeEach(() => {
  query.mockReset();
  sendConfirm.mockReset();
  sendConfirm.mockResolvedValue(true);
});

describe("подписка не шлёт письмо дважды", () => {
  test("новая подписка -> письмо уходит", async () => {
    query.mockResolvedValue({ rows: [{ inserted: true }], rowCount: 1 });

    const r = await subscribe(`new-${Date.now()}@example.com`);

    expect(r.status).toBe(201);
    await new Promise((x) => setTimeout(x, 30));
    expect(sendConfirm, "первое письмо не ушло").toHaveBeenCalledTimes(1);
  });

  test("повторная подписка -> письма нет, но ответ прежний", async () => {
    query.mockResolvedValue({ rows: [{ inserted: false }], rowCount: 1 });

    const r = await subscribe(`dup-${Date.now()}@example.com`);

    // Человеку по-прежнему 201: он подписан, и устройство базы его не касается.
    expect(r.status).toBe(201);
    await new Promise((x) => setTimeout(x, 30));
    expect(sendConfirm, "второе письмо всё-таки ушло").not.toHaveBeenCalled();
  });
});

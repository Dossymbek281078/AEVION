import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: ручка здоровья почты отвечает не только «ключ ЗАДАН», но и «письма
 * УХОДЯТ» — иначе зелёное здоровье при мёртвом канале не отличить от рабочего.
 *
 * ПОВОД (замеры прода). 11.10.2026: ключ Brevo задан, прод отвергает его с 401
 * (контроль того же замера: Resend тот же запрос принял — значит дело в ключе,
 * а не в сети). 12.10.2026: `/api/auth/email/healthz` при этом отвечает
 * `brevo: {configured: true}`, `resend: {configured: true}`, `canSend: true`.
 * Поля честны по именам — они про НАСТРОЙКУ, — но вопрос «уходят ли письма»
 * ими не закрыт, а отказ отправки виден только в `console.warn` текущей
 * выкатки: `railway logs` отдаёт лишь её, и назавтра следа нет.
 *
 * ПОЧЕМУ ЭТО ДЕНЬГИ. Письмо «доступ открыт» — последний шаг выдачи
 * купленного: в нём человеку говорят, что делать после оплаты. Молчаливый
 * отказ здесь выглядит как успех для всех, кроме заплатившего.
 *
 * ЧТО ОХРАНЯЕТСЯ:
 *   1. с запуска счётчики пусты, и `последнийОтказ: null` значит «отказов не
 *      было С ЗАПУСКА», а не «всё хорошо» (контроль исходного состояния);
 *   2. отказ провайдера попадает в ручку с ТРАНСПОРТОМ и ПРИЧИНОЙ;
 *   3. удачная отправка увеличивает счёт отправленного;
 *   4. в ответе ручки НЕТ адреса получателя — ни в причине, ни где-либо ещё
 *      (ручка открыта, и адрес из текста ошибки провайдера вычищается).
 *
 * ГРАНИЦА: настоящий SMTP здесь не поднимается, транспорта нет вовсе — путь
 * проверяется через Resend с подменённым fetch. Что письмо дойдёт до ящика,
 * этим не проверяется и проверено быть не может.
 */

process.env.AUTH_JWT_SECRET = "test-secret-dlya-storozha-pochty-32-znaka-i-bolshe";
process.env.RESEND_API_KEY = "re_test_key_for_guard";
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { authRouter } = await import("../src/routes/auth");
const { send } = await import("../src/lib/build/email");

const АДРЕС = "pokupatel-probe@test.aev";

function приложение() {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
}

const здоровье = () => request(приложение()).get("/email/healthz");

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.AUTH_JWT_SECRET;
  vi.unstubAllGlobals();
});

describe("здоровье почты называет не только настройку, но и работу", () => {
  test("КОНТРОЛЬ исходного состояния: счёт пуст, отказа нет, и это НЕ «всё хорошо»", async () => {
    const r = await здоровье();
    expect(r.status).toBe(200);
    expect(r.body.отправка, "ручка не отдаёт состояние отправки вовсе").toBeTruthy();
    expect(r.body.отправка.отправлено).toBe(0);
    expect(r.body.отправка.неудач).toBe(0);
    expect(
      r.body.отправка.последнийОтказ,
      "пустое состояние обязано быть null, а не выдуманным успехом",
    ).toBe(null);
    // Настройка по-прежнему отвечает на свой вопрос — её смысл не подменён.
    expect(r.body.transports.resend.configured, "признак настройки потерян").toBe(true);
  });

  test("отказ провайдера виден в ручке: транспорт и причина", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const ушло = await send(АДРЕС, "Доступ открыт", "<p>тест</p>");
    expect(ушло, "подменённый провайдер отверг письмо, а send вернул успех").toBe(false);

    const r = await здоровье();
    expect(r.body.отправка.неудач, "отказ не посчитан").toBe(1);
    expect(r.body.отправка.последнийОтказ?.транспорт).toBe("resend");
    expect(
      String(r.body.отправка.последнийОтказ?.причина),
      "причина отказа не названа — по такому здоровью мёртвый ключ не найти",
    ).toContain("401");
    // Та самая разница: ключ ЗАДАН, а письма НЕ уходят — и теперь это видно.
    expect(r.body.transports.resend.configured).toBe(true);
  });

  test("в ответе ручки НЕТ адреса получателя", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error(`Invalid to field: ${АДРЕС} rejected`);
    });
    await send(АДРЕС, "Доступ открыт", "<p>тест</p>");

    const r = await здоровье();
    const целиком = JSON.stringify(r.body);
    expect(целиком, "адрес получателя утёк в открытую ручку здоровья").not.toContain(АДРЕС);
    expect(
      String(r.body.отправка.последнийОтказ?.причина),
      "адрес из текста провайдера не вычищен",
    ).toContain("<адрес>");
    expect(r.body.отправка.неудач, "второй отказ не посчитан").toBe(2);
  });

  test("удачная отправка увеличивает счёт отправленного", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ id: "m1" }) }));
    const ушло = await send(АДРЕС, "Доступ открыт", "<p>тест</p>");
    expect(ушло, "провайдер принял письмо, а send вернул отказ").toBe(true);

    const r = await здоровье();
    expect(r.body.отправка.отправлено, "удачная отправка не посчитана").toBe(1);
    expect(r.body.отправка.последний?.ok, "последний исход не отмечен удачным").toBe(true);
    expect(r.body.отправка.последний?.транспорт).toBe("resend");
    // Отказы НЕ обнуляются удачей: оба факта нужны.
    expect(r.body.отправка.неудач, "удача стёрла историю отказов").toBe(2);
  });
});

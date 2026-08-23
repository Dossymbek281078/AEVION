import { describe, test, expect, vi, beforeEach } from "vitest";

// Ручка отвечает 200 и когда письмо НЕ ушло.
//
// `POST /api/auth/email/verify/request` создаёт токен и пытается отправить
// письмо. Отправка может не удаться (почта не настроена, провайдер отказал) —
// и тогда ответ по-прежнему 200, а факт лежит в поле `emailSent`.
//
// Замер 21.08.2026: поле `emailSent` не читалось НИГДЕ во фронтенде. Обёртка
// `requestEmailVerification` была объявлена как `Promise<void>` и выбрасывала
// тело целиком, поэтому оба вызывающих показывали «письмо отправлено»
// независимо от факта. Человек ждал письма, которого нет.

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => "http://test" + p }));

const { requestEmailVerification, BuildApiError } = await import("../api");

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

describe("requestEmailVerification — правда о факте отправки", () => {
  beforeEach(() => fetchMock.mockReset());

  test("письмо ушло -> emailSent true", async () => {
    fetchMock.mockReturnValue(reply(200, { ok: true, email: "a@b.c", emailSent: true }));
    const r = await requestEmailVerification();
    expect(r.emailSent).toBe(true);
    expect(r.email).toBe("a@b.c");
  });

  test("⭐ 200, но письмо НЕ ушло -> emailSent false", async () => {
    // Главное утверждение: успешный код ответа не выдаётся за отправку.
    fetchMock.mockReturnValue(reply(200, { ok: true, email: "a@b.c", emailSent: false }));
    const r = await requestEmailVerification();
    expect(r.emailSent).toBe(false);
  });

  test("уже подтверждён -> отдельный признак, а не «отправлено»", async () => {
    fetchMock.mockReturnValue(reply(200, { ok: true, alreadyVerified: true }));
    const r = await requestEmailVerification();
    expect(r.alreadyVerified).toBe(true);
  });

  test("поля нет вовсе (старый сервер) -> считаем отправленным", async () => {
    // Отсутствие поля — не то же самое, что `false`. Старый бэкенд его не
    // присылал, и превращать это в «не отправлено» значило бы пугать людей
    // на ровном месте.
    fetchMock.mockReturnValue(reply(200, { ok: true }));
    expect((await requestEmailVerification()).emailSent).toBe(true);
  });

  test("ошибка HTTP по-прежнему бросает, а не молчит", async () => {
    fetchMock.mockReturnValue(reply(429, { error: "too_many_requests" }));
    await expect(requestEmailVerification()).rejects.toBeInstanceOf(BuildApiError);
  });
});

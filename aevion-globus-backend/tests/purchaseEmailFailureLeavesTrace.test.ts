import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Сторож: письмо после ПОКУПКИ не пропадает молча.
 *
 * ЗАЧЕМ. У отправщика три пути отказа, и раньше молчал ровно один — самый
 * вероятный. Исключение звало capture, «2xx без message id» тоже, а отказ по
 * коду ответа (4xx/5xx от Resend: неподтверждённый домен, неверный ключ,
 * превышен темп) просто возвращался вызывающему. Вызывающие — четыре вебхука
 * оплаты — результат отправки НЕ читают. То есть человек платил, доступ
 * получал, письма не было, и узнать об этом было неоткуда.
 *
 * Операция при этом не должна падать: покупка уже состоялась, и письмо не
 * повод её отменять. Поэтому проверяется не отказ, а СЛЕД — и то, что в следе
 * есть ЧТО и КОМУ не ушло.
 */
const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => mockCapture,
}));

// Ключ читается на уровне модуля, поэтому задаём его ДО импорта.
process.env.RESEND_API_KEY = "тест-ключ-не-настоящий";
const { sendEmail } = await import("../src/routes/provisioning");

const исходныйFetch = globalThis.fetch;
let предупреждения: string[] = [];
let spyWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockCapture.mockClear();
  предупреждения = [];
  spyWarn = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
    предупреждения.push(a.map(String).join(" "));
  });
});

afterEach(() => {
  spyWarn.mockRestore();
  globalThis.fetch = исходныйFetch;
});

describe("отказ отправки письма о покупке оставляет след", () => {
  test("отказ по коду ответа виден и называет получателя", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: "Domain is not verified" }),
    })) as never;

    const r = await sendEmail({
      to: "buyer@example.com",
      subject: "Доступ открыт",
      html: "<p>ok</p>",
      text: "ok",
    });

    // Контроль прибора: подменённый fetch действительно вызывался, иначе
    // «след есть» могло бы означать, что мы проверяем не тот путь.
    expect(globalThis.fetch, "запрос к отправщику не уходил").toHaveBeenCalled();

    expect(r.ok, "отказ выдан за успех").toBe(false);
    expect(r.error, "причина отказа потеряна").toContain("Domain is not verified");

    const след = предупреждения.join(" | ");
    expect(след, "отказ прошёл молча — в журнале ничего").toContain("buyer@example.com");
    expect(mockCapture, "отказ не доехал до Sentry").toHaveBeenCalled();
  });

  test("успешная отправка следа об ошибке не оставляет", async () => {
    // Без этого «след есть» было бы зелёным и у отправщика, который жалуется
    // всегда.
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_1" }),
    })) as never;

    const r = await sendEmail({
      to: "buyer@example.com",
      subject: "Доступ открыт",
      html: "<p>ok</p>",
      text: "ok",
    });

    expect(r.ok).toBe(true);
    expect(предупреждения.join(" | ")).not.toContain("не отправлено");
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

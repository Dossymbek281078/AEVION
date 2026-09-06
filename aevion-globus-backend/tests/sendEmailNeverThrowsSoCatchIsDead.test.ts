import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Почему этот файл существует: обработчик отказа, который не может сработать.
 *
 * В `routes/pricing.ts` все пять отправок писем написаны так:
 *
 *     sendEmail({ ... }).catch((e) => console.error("... email failed", e));
 *
 * Выглядит как полноценная обработка отказа. На деле `sendEmail` НЕ БРОСАЕТ
 * ни при каком исходе: отказ поставщика, обрыв сети и даже собственное
 * исключение она возвращает объектом `{ok: false}`. Значит `.catch` мёртв —
 * он не выполнится ни разу, а место вызова промолчит о неотправленном письме.
 *
 * Это ровно тот класс, который дороже падения: операция отвечает успехом,
 * человек не получает письма, и в журнале на месте отказа нет строки от того,
 * кто письмо заказывал.
 *
 * Тест закрепляет ФАКТ, из которого следует мёртвость: функция всегда
 * РАЗРЕШАЕТСЯ, и признак `ok` — единственное место, где живёт правда об
 * отправке. Сломается это свойство (кто-то начнёт бросать) — тест покраснеет,
 * и правило «проверяй ok» надо будет пересмотреть вместе с ним.
 */

const KEY = "re_test_secret_value_do_not_leak_000";

async function загрузитьСКлючом() {
  process.env.RESEND_API_KEY = KEY;
  vi.resetModules(); // модуль читает env на верхнем уровне
  const mod = await import("../src/routes/provisioning");
  return mod.sendEmail;
}

const письмо = {
  to: "buyer@example.com",
  subject: "AEVION — доступ",
  html: "<p>ok</p>",
  text: "ok",
};

const исходныйFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  globalThis.fetch = исходныйFetch;
  vi.restoreAllMocks();
});

describe("sendEmail сообщает об отказе значением, а не исключением", () => {
  test("отказ поставщика: разрешается с ok:false, а НЕ бросает", async () => {
    const sendEmail = await загрузитьСКлючом();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: "domain is not verified" }),
    })) as unknown as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Именно так его зовут места вызова: без await, с .catch.
    // Если бы функция бросала, это выражение отвергло бы промис.
    const r = await sendEmail(письмо);

    expect(r.ok).toBe(false);
    expect(r.error).toContain("domain is not verified");
  });

  test("обрыв сети: тоже значение, а не исключение", async () => {
    const sendEmail = await загрузитьСКлючом();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const r = await sendEmail(письмо);

    expect(r.ok).toBe(false);
    expect(r.error).toContain("ECONNREFUSED");
  });

  test("прямая проверка мёртвости: .catch НЕ вызывается при отказе", async () => {
    const sendEmail = await загрузитьСКлючом();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "provider down" }),
    })) as unknown as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const пойманоCatch = vi.fn();
    await sendEmail(письмо).catch(пойманоCatch);

    // Ноль вызовов — и это ГЛАВНОЕ утверждение файла: обработчик,
    // написанный ради отказа, при отказе не срабатывает.
    expect(пойманоCatch).not.toHaveBeenCalled();
  });

  test("контроль: удачную отправку прибор тоже видит", async () => {
    const sendEmail = await загрузитьСКлючом();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_123" }),
    })) as unknown as typeof fetch;

    const r = await sendEmail(письмо);

    expect(r.ok).toBe(true);
    expect(r.id).toBe("msg_123");
  });
});

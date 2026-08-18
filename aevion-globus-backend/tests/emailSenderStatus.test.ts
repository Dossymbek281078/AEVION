import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * Письмо после покупки — последнее звено, где тишина неотличима от работы.
 *
 * Без `RESEND_API_KEY` функция отправки возвращает `{ok: true, mode: "stub"}` и
 * пишет строку в лог. Провижининг при этом «успешен», журнал подписок
 * пополняется, ответ 200 — а покупатель не получает от нас ничего: ни что он
 * купил, ни как этим пользоваться. Снаружи отличить это от исправной отправки
 * было нельзя ничем.
 *
 * Поэтому состояние выведено в `/api/health` — тем же приёмом, что и хранилище
 * событий. Тест держит два условия: признак отражает РЕАЛЬНОЕ наличие ключа, и
 * сам ключ наружу не попадает.
 */

const KEY = "re_test_secret_value_do_not_leak_000";

async function statusWithKey(key: string | undefined) {
  // Модуль читает env на верхнем уровне. Статический импорт поднимается выше
  // присваивания, поэтому только динамический импорт со сбросом кэша модулей
  // измеряет то состояние, которое мы задали.
  if (key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = key;
  vi.resetModules(); // модуль читает env на верхнем уровне — нужен свежий экземпляр
  const mod = await import("../src/routes/provisioning");
  return (mod as { emailSenderStatus: () => { configured: boolean; from: string; mode: string } }).emailSenderStatus();
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.FROM_EMAIL;
});

describe("состояние отправки писем видно снаружи", () => {
  test("без ключа честно сообщает, что письма не уходят", async () => {
    const s = await statusWithKey(undefined);

    expect(s.configured).toBe(false);
    expect(s.mode).toBe("stub");
  });

  test("с ключом сообщает, что отправка настоящая", async () => {
    const s = await statusWithKey(KEY);

    expect(s.configured).toBe(true);
    expect(s.mode).toBe("real");
  });

  test("сам ключ наружу НЕ отдаётся", async () => {
    const s = await statusWithKey(KEY);

    const dump = JSON.stringify(s);
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain("re_test");
  });

  test("адрес отправителя отдаётся — по нему видно, с какого домена придёт письмо", async () => {
    process.env.FROM_EMAIL = "AEVION <hello@aevion.io>";
    const s = await statusWithKey(KEY);

    expect(s.from).toContain("@");
  });
});

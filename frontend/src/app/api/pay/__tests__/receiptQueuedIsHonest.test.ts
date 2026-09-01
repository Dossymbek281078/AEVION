import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "../[id]/route";
import { store } from "../../payments/v1/_lib";

/**
 * Сторож: `email_queued` в ответе об оплате говорит правду.
 *
 * ЗАЧЕМ. 29.08.2026 в обработчике стояло `void sendReceiptEmail(...)` и следом
 * БЕЗУСЛОВНОЕ `emailQueued = true`. Результат отправки выбрасывался, а клиенту
 * уходило `email_queued: true` даже когда письмо не отправлялось вовсе: без
 * RESEND_API_KEY функция честно возвращает { ok: false, skipped: true }, и
 * этот ответ никто не читал.
 *
 * То есть отказ выглядел успехом ровно там, где человек только что заплатил:
 * чека нет, а ответ говорит, что чек поставлен в очередь.
 *
 * Проверяем ТОЛЬКО случай без ключа. Случай с ключом означал бы настоящий
 * вызов Resend из теста — письма из проверок не шлём.
 */
const снимок: Record<string, string | undefined> = {};

beforeEach(() => {
  снимок.RESEND_API_KEY = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
});
afterEach(() => {
  if (снимок.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = снимок.RESEND_API_KEY;
});

function ссылка(id: string) {
  store.links.set(id, {
    id,
    title: "Тестовая позиция",
    amount: 19,
    currency: "USD",
    status: "active",
  } as never);
}

describe("ответ об оплате не обещает чек, которого не будет", () => {
  it("без RESEND_API_KEY поле email_queued равно false", async () => {
    const id = "test-receipt-honest";
    ссылка(id);
    const req = new Request("https://aevion.app/api/pay/" + id, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "card", payer_email: "buyer@example.com" }),
    });
    const res = await POST(req as never, { params: Promise.resolve({ id }) });
    const тело = await res.json();
    expect(тело.status).toBe("paid");
    expect(
      тело.email_queued,
      "ответ обещает чек, хотя отправка пропущена — отказ выглядит успехом",
    ).toBe(false);
  });
});

import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: повтор с тем же Idempotency-Key возвращает ВОЗВРАТ, а не эхо запроса.
 *
 * ЗАЧЕМ. checkIdempotency кэширует ту строку, которую ему передали, и отдаёт её
 * при повторе как тело ответа. Чекаут передаёт ОТВЕТ (JSON.stringify(checkout)),
 * а возвраты передавали ТЕЛО ЗАПРОСА. То есть на повтор продавец получал 200 со
 * своим же {"link_id":"..."} вместо объекта возврата.
 *
 * Цена не косметическая. Продавец проверяет refund.status === "succeeded",
 * получает undefined, считает попытку неудавшейся и повторяет с НОВЫМ ключом —
 * а новый ключ проходит мимо защиты от повтора. При частичном возврате остаток
 * это позволяет: вернули 50 из 100, повтор вернёт ещё 50. Продавец хотел
 * вернуть 50, покупатель получил 100.
 */
const link = {
  id: "lnk_1",
  amount: 100,
  currency: "USD",
  status: "paid",
  created: 1_000,
};

vi.mock("../_persist", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return {
    ...m,
    kvListChecked: vi.fn(async () => ({ ok: true, value: [] })),
    kvList: vi.fn(async () => []),
    kvPush: vi.fn(async () => undefined),
  };
});

vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  const store = (m as { store: { links: Map<string, unknown> } }).store;
  store.links.set(link.id, link);
  return { ...m, store, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

function запрос() {
  return new Request("https://aevion.app/api/payments/v1/refunds", {
    method: "POST",
    headers: { "idempotency-key": "idem_test_1", "content-type": "application/json" },
    body: JSON.stringify({ link_id: link.id, amount: 50 }),
  }) as never;
}

describe("повтор возврата отдаёт возврат, а не запрос клиента", () => {
  it("второй ответ с тем же ключом содержит объект возврата", async () => {
    const { POST } = await import("../refunds/route");

    const первый = await (await POST(запрос())).json();
    expect(первый.status, "первый возврат не оформился").toBe("succeeded");

    const повтор = await POST(запрос());
    const второй = await повтор.json();

    // Тот же ответ, что и в первый раз, а не эхо запроса.
    expect(
      второй.status,
      `на повтор пришло ${JSON.stringify(второй)}`
    ).toBe("succeeded");
    expect(второй.id).toBe(первый.id);
    expect(второй.amount).toBe(50);

    // И повтор обязан НАЗЫВАТЬ СЕБЯ повтором. Без этого заголовка ответ
    // неотличим от новой выдачи: продавец видит 200 и объект возврата и не
    // может сказать, ушли ли деньги ещё раз. Заголовок ставили четверо
    // обработчиков из пяти, и не ставил именно денежный возврат.
    expect(повтор.headers.get("idempotent-replayed")).toBe("true");
  });
});

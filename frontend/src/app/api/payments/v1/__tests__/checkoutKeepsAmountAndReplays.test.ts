import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: сессия оплаты не трогает сумму и честно повторяется.
 *
 * ЗАЧЕМ. Ручка чекаута — четвёртая из шести, которые не вызывал ни один тест.
 * Проверяются два свойства, оба денежные: сумма доходит до сессии ровно
 * такой, какой её прислали (на неизменности единиц держится вся починка цены),
 * и повтор с тем же ключом возвращает ТУ ЖЕ сессию, а не вторую.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

function запрос(ключ?: string) {
  return new Request("https://aevion.app/api/payments/v1/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ключ ? { "idempotency-key": ключ } : {}),
    },
    body: JSON.stringify({ amount: 9900, currency: "USD", title: "Проверка чекаута" }),
  }) as never;
}

describe("сессия оплаты честна к сумме и к повтору", () => {
  it("сумма доходит неизменной", async () => {
    const { POST } = await import("../checkout/route");
    const res = await POST(запрос());
    const сессия = await res.json();
    expect(res.status, `ответ ${res.status}: ${JSON.stringify(сессия)}`).toBe(201);
    expect(сессия.amount, "сумму по дороге изменили").toBe(9900);
    expect(сессия.currency).toBe("USD");
  });

  it("повтор с тем же ключом даёт ту же сессию и называет себя повтором", async () => {
    const { POST } = await import("../checkout/route");
    const первая = await (await POST(запрос("idem_checkout_1"))).json();
    expect(первая.id, "сессия не создана").toBeTruthy();

    const повтор = await POST(запрос("idem_checkout_1"));
    const вторая = await повтор.json();

    expect(вторая.id, `на повтор пришло ${JSON.stringify(вторая)}`).toBe(первая.id);
    expect(вторая.amount).toBe(9900);
    expect(повтор.headers.get("idempotent-replayed")).toBe("true");
  });
});

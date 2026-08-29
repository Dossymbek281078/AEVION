import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: не прочитали прошлые возвраты — возврат НЕ выдаём.
 *
 * ЗАЧЕМ. В обработчике стояло обычное kvList, а из его результата считается
 * refundedSoFar и remaining. При недоступном хранилище чтение молча отдаёт
 * пустой список: прошлых возвратов «нет», remaining = вся сумма, защита
 * «уже возвращено полностью» не срабатывает — и деньги уходят ВТОРОЙ РАЗ,
 * а ответ выглядит обычным.
 *
 * Направление отказа выбрано по цене: отказ в возврате восстановим (продавец
 * повторит), двойной возврат — нет. НЕ ЗНАЕМ значит НЕ ДЕЛАЕМ.
 */
vi.mock("../_persist", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return {
    ...m,
    // Хранилище не читается — ровно тот случай.
    kvListChecked: vi.fn(async () => ({ ok: false })),
    kvList: vi.fn(async () => []),
    kvPush: vi.fn(async () => undefined),
  };
});

vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return {
    ...m,
    // Пропускаем ворота доступа: проверяем поведение при нечитаемом
    // хранилище, а не авторизацию.
    gateRequest: () => ({ ok: true, rateHeaders: {} }),
  };
});

describe("возврат не выдаётся, если прошлые возвраты не прочитаны", () => {
  it("отвечает отказом, а не новым возвратом", async () => {
    const { store } = await import("../_lib");
    const { POST } = await import("../refunds/route");
    const id = "link_refund_guard";
    (store as { links: Map<string, unknown> }).links.set(id, {
      id,
      title: "Тестовая позиция",
      amount: 100,
      currency: "USD",
      status: "paid",
    });
    const req = new Request("https://aevion.app/api/payments/v1/refunds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ link_id: id, amount: 100, reason: "test" }),
    });
    const res = await POST(req as never);
    expect(res.status, "возврат выдан при нечитаемом хранилище").toBe(503);
    const тело = await res.json();
    expect(JSON.stringify(тело)).toContain("retry");
  });
});

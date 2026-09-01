import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: обрезка журнала возвратов не должна открывать путь ВТОРОЙ выдаче.
 *
 * ЗАЧЕМ. refundedSoFar считается из ОДНОГО ОБЩЕГО списка "refunds.v1", а
 * kvPush обрезает его до 500 записей, выбрасывая самые старые (unshift +
 * list.length = cap). Значит после 500 возвратов по всей платформе возврат
 * старой ссылки исчезает из списка, refundedSoFar становится 0, remaining
 * снова равен полной сумме — и полностью возвращённую ссылку можно вернуть
 * ещё раз. Пропажа записи выглядит как «возвратов не было».
 *
 * Это тот же класс, что и недоступное хранилище рядом: чтение, результат
 * которого идёт в вычисление ПРЕДЕЛА, а потеря данных делает предел БОЛЬШЕ.
 * Направление отказа то же и по той же цене: отказ в возврате обратим,
 * вторая выдача денег — нет.
 */
const CAP = 500;

// Список ПОЛОН и состоит из возвратов по ЧУЖИМ ссылкам, все они новее нашей.
// Именно так выглядит журнал, из которого нашу запись уже вытеснили.
const полный = Array.from({ length: CAP }, (_, i) => ({
  id: `re_${i}`,
  link_id: `lnk_other_${i}`,
  amount: 1,
  currency: "USD",
  reason: "",
  status: "succeeded" as const,
  created: 5_000 + i,
}));

vi.mock("../_persist", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return {
    ...m,
    kvListChecked: vi.fn(async () => ({ ok: true, value: полный })),
    kvList: vi.fn(async () => полный),
    kvPush: vi.fn(async () => undefined),
  };
});

vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  const store = (m as { store: { links: Map<string, unknown> } }).store;
  // Ссылка СТАРШЕ самой старой уцелевшей записи: её возврат мог быть вытеснен.
  store.links.set("lnk_old", {
    id: "lnk_old",
    amount: 100,
    currency: "USD",
    status: "paid",
    created: 1_000,
  });
  return {
    ...m,
    store,
    gateRequest: () => ({ ok: true, rateHeaders: {} }),
  };
});

describe("обрезанный журнал не открывает вторую выдачу денег", () => {
  it("ссылка старше уцелевшего окна не возвращается вслепую", async () => {
    const { POST } = await import("../refunds/route");
    const res = await POST(
      new Request("https://aevion.app/api/payments/v1/refunds", {
        method: "POST",
        body: JSON.stringify({ link_id: "lnk_old" }),
      }) as never
    );
    const тело = await res.json();

    // Деньги выдавать нельзя: мы НЕ ЗНАЕМ, возвращали уже или нет.
    expect(res.status, `касса ответила ${res.status}: ${JSON.stringify(тело)}`)
      .not.toBe(200);
    expect(JSON.stringify(тело)).not.toContain('"status":"succeeded"');
    // Наша неуверенность — не ошибка клиента: с типом invalid_request_error
    // интегратор уходит отлаживать безупречный запрос, а с «please retry»
    // это ещё и противоречие. Тип обязан называть НАШУ сторону.
    expect((тело as { error?: { type?: string } })?.error?.type).toBe("api_error");
  });
});

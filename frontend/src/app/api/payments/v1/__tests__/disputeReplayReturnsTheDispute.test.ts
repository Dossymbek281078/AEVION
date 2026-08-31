import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: повтор спора с тем же Idempotency-Key возвращает СПОР.
 *
 * ЗАЧЕМ. Утром нашёлся класс: обработчик передавал в защиту от повтора тело
 * ЗАПРОСА, и на повтор вызывающий получал своё же {"link_id":...} вместо
 * объекта. У возвратов это было закрыто сразу и проверено делом, а у споров —
 * найдено сторожем уровня исходника и починено ПО ОБРАЗЦУ, без единого
 * вызова обработчика.
 *
 * Замер того же дня: из девяти ручек платежей шесть не вызывает ни один тест,
 * и споры среди них. Значит моя же правка держалась на сходстве кода, а не на
 * поведении. Здесь она проверена делом.
 */
const link = {
  id: "lnk_dispute",
  amount: 5000,
  currency: "USD",
  title: "Спор",
  description: "",
  settlement: "bank" as const,
  expires_in_days: null,
  status: "paid" as const,
  created: 1,
  url: "https://aevion.app/pay/lnk_dispute",
  paid_at: 2,
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
  return new Request("https://aevion.app/api/payments/v1/disputes", {
    method: "POST",
    headers: { "idempotency-key": "idem_dispute_1", "content-type": "application/json" },
    body: JSON.stringify({ link_id: link.id, amount: 5000, reason: "fraudulent" }),
  }) as never;
}

describe("повтор спора отдаёт спор, а не запрос клиента", () => {
  it("второй ответ с тем же ключом — тот же объект, и он назван повтором", async () => {
    const { POST } = await import("../disputes/route");

    const первый = await (await POST(запрос())).json();
    // Контроль прибора: спор вообще создался, иначе проверять нечего.
    expect(первый.id, `спор не создан: ${JSON.stringify(первый)}`).toBeTruthy();

    const повтор = await POST(запрос());
    const второй = await повтор.json();

    expect(второй.id, `на повтор пришло ${JSON.stringify(второй)}`).toBe(первый.id);
    expect(второй.link_id).toBe(link.id);
    expect(повтор.headers.get("idempotent-replayed")).toBe("true");
  });
});

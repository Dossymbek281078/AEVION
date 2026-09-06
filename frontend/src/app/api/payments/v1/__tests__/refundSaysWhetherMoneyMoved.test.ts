import { describe, it, expect, vi } from "vitest";

/**
 * Ответ о возврате называет режим — иначе он неотличим от настоящего возврата.
 *
 * ЗАЧЕМ. Возврат создаётся со статусом `succeeded`, а обращения к настоящей
 * кассе в этом дереве нет вовсе: деньги не двигаются. Страницы о
 * демонстрационном режиме говорят честно — публичная касса пишет «Demo: any
 * 16-digit number works», страница способов оплаты упоминает режим 33 раза,
 * каталог держит оговорку про отсутствие банковской лицензии. Молчал именно
 * ОТВЕТ, а читает его машина: чужая интеграция, наш дашборд, скрипт сверки.
 *
 * Продавец проверяет `refund.status === "succeeded"` и по этому полю решает,
 * ушли ли деньги. Без соседнего поля о режиме такой ответ говорит неправду
 * молча и правдоподобно.
 */

const link = {
  id: "lnk_mode_1",
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
  return m;
});

// Ключ у каждой проверки СВОЙ: с общим ключом вторая получала бы
// идемпотентный повтор первой, то есть опиралась бы на её данные, а не на
// собственный ответ. Обе суммы по 50 умещаются в ссылку на 100.
function запрос(ключ: string) {
  return new Request("https://aevion.app/api/payments/v1/refunds", {
    method: "POST",
    headers: {
      // Форма ключа проверяется отдельным сторожем (keyShapeIsActuallyChecked);
      // здесь нужен просто валидный по форме, чтобы дойти до тела ответа.
      Authorization: "Bearer sk_test_abcdefgh12345678",
      "idempotency-key": ключ,
      "content-type": "application/json",
    },
    body: JSON.stringify({ link_id: link.id, amount: 50, reason: "проверка режима" }),
  });
}

describe("ответ о возврате называет, двигались ли настоящие деньги", () => {
  it("контроль: возврат вообще оформляется", async () => {
    // Иначе «поле режима на месте» могло бы означать «ответа нет».
    const { POST } = await import("../refunds/route");
    const ключ = "idem_mode_control";
    const тело = await (await POST(запрос(ключ))).json();
    expect(тело.status, `ответ: ${JSON.stringify(тело)}`).toBe("succeeded");
  });

  it("рядом со статусом стоит режим", async () => {
    const { POST } = await import("../refunds/route");
    const ключ = "idem_mode_main";
    const тело = await (await POST(запрос(ключ))).json();
    expect(
      тело.mode,
      "ответ утверждает succeeded и молчит о том, что настоящих денег это API " +
        "не двигает — по такому ответу продавец решит, что вернул покупателю деньги",
    ).toBe("demo");
  });
});

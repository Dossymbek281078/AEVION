import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: ссылка хранит сумму РОВНО такой, какой её выставил продавец.
 *
 * ЗАЧЕМ. Вся утренняя починка цены держится на одном условии: API нигде не
 * переводит единицы. Продавец шлёт 9900 минорных единиц, и до самого экрана
 * должно дойти 9900 — деление на сто делает только показ. Если однажды
 * кто-то «поможет» и поделит на входе, экран покажет 99 копеек, а сторожа
 * показа останутся зелёными: они проверяют форматирование, а не хранение.
 *
 * Ручка создания ссылок до сегодня не вызывалась ни одним тестом — это одна
 * из шести таких из девяти.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

function создать(тело: Record<string, unknown>) {
  return new Request("https://aevion.app/api/payments/v1/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(тело),
  }) as never;
}

describe("создание ссылки не трогает сумму", () => {
  it("9900 минорных единиц сохраняются как 9900", async () => {
    const { POST } = await import("../links/route");
    const res = await POST(создать({ amount: 9900, currency: "USD", title: "Проверка" }));
    const ссылка = await res.json();

    expect(res.status, `касса ответила ${res.status}: ${JSON.stringify(ссылка)}`).toBe(201);
    expect(ссылка.amount, "сумму по дороге изменили").toBe(9900);
    expect(ссылка.currency).toBe("USD");
    // Адрес ведёт на нашу страницу оплаты — по ней покупатель и увидит цену.
    expect(String(ссылка.url)).toContain(`/pay/${ссылка.id}`);
  });

  it("нулевая и отрицательная сумма не принимаются", async () => {
    const { POST } = await import("../links/route");
    for (const плохая of [0, -1, -9900]) {
      const res = await POST(создать({ amount: плохая, currency: "USD", title: "x" }));
      expect(res.status, `сумма ${плохая} принята`).toBe(400);
    }
  });

  it("неизвестная валюта не принимается", async () => {
    const { POST } = await import("../links/route");
    const res = await POST(создать({ amount: 100, currency: "XXX", title: "x" }));
    expect(res.status).toBe(400);
    const тело = await res.json();
    expect(JSON.stringify(тело)).toContain("currency");
  });
});

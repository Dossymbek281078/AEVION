import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: в чеке покупателя стоит та цена, которую выставил продавец.
 *
 * ЗАЧЕМ. Отдельно проверены и показатель валюты, и то, что поверхности не
 * форматируют сумму сами. Но это проверки ФОРМЫ. Здесь проверяется СЛЕДСТВИЕ
 * на живом пути: письмо-чек уходит с той подписью, которую увидит человек.
 * До 31.08 там стояло $9900.00 при выставленных $99.00 — ошибка в сто раз,
 * и увидеть её можно было только пройдя путь целиком.
 *
 * 9900 — ровно то число, которое приводит примером наша же спецификация.
 */
const отправлено: { amount_label?: string }[] = [];

vi.mock("../_email", () => ({
  sendReceiptEmail: vi.fn(async (arg: { amount_label?: string }) => {
    отправлено.push(arg);
    return { ok: true };
  }),
}));

describe("чек называет выставленную цену", () => {
  it("ссылка на 9900 минорных единиц даёт в чеке $99.00", async () => {
    const { store } = await import("../_lib");
    store.links.set("lnk_receipt", {
      id: "lnk_receipt",
      amount: 9900,
      currency: "USD",
      title: "Проверка чека",
      description: "",
      settlement: "bank",
      expires_in_days: null,
      status: "active",
      created: 1,
      url: "https://aevion.app/pay/lnk_receipt",
      paid_at: null,
    });

    const { POST } = await import("../../../pay/[id]/route");
    await POST(
      new Request("https://aevion.app/api/pay/lnk_receipt", {
        method: "POST",
        body: JSON.stringify({ method: "card", payer_email: "buyer@example.com" }),
      }) as never,
      { params: Promise.resolve({ id: "lnk_receipt" }) } as never
    );

    // Контроль прибора: письмо вообще собиралось, иначе проверять нечего.
    expect(отправлено.length, "чек не отправлялся — проверять нечего").toBe(1);
    expect(отправлено[0].amount_label, "в чеке не выставленная цена").toBe("$99.00");
    expect(отправлено[0].amount_label).not.toContain("9,900");
  });
});

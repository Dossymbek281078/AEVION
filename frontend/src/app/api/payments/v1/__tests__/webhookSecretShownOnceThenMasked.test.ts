import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: подписывающий секрет отдаётся полностью ОДИН раз, дальше маскируется.
 *
 * ЗАЧЕМ. Так обещает опубликованный контракт: «Returned in full only on
 * creation; GET list shows masked prefix». Обещание проверялось чтением кода,
 * а ручка вебхуков — одна из шести, которые не вызывал ни один тест. Цена
 * ошибки здесь прямая: этим секретом подписываются доставки, и если он начнёт
 * появляться в списке целиком, подделать нашу подпись сможет любой, кто этот
 * список прочитает.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

describe("секрет вебхука виден один раз", () => {
  it("при создании приходит целиком, в списке — только префикс", async () => {
    const { POST, GET } = await import("../webhooks/route");

    const создан = await (
      await POST(
        new Request("https://aevion.app/api/payments/v1/webhooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: "https://merchant.example/hook",
            events: ["payment.refunded"],
          }),
        }) as never
      )
    ).json();

    // Контроль прибора: вебхук вообще создался.
    expect(создан.id, `вебхук не создан: ${JSON.stringify(создан)}`).toBeTruthy();
    const секрет = String(создан.secret ?? "");
    expect(секрет.length, "секрет при создании не отдан целиком").toBeGreaterThan(20);
    expect(секрет, "секрет при создании уже замаскирован").not.toContain("…");

    const список = await (
      await GET(new Request("https://aevion.app/api/payments/v1/webhooks") as never)
    ).json();
    const наш = (список.data as { id: string; secret: string }[]).find(
      (w) => w.id === создан.id
    );
    expect(наш, "созданный вебхук не виден в списке").toBeTruthy();
    expect(наш!.secret, "в списке секрет не замаскирован").not.toBe(секрет);
    expect(наш!.secret).toContain("…");
    expect(
      JSON.stringify(список),
      "полный секрет утёк в список"
    ).not.toContain(секрет);
  });
});

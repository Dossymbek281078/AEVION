import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: журнал платежей не отдаёт наружу адрес и браузер вызывающего.
 *
 * ЗАЧЕМ. Записи отдавались ЦЕЛИКОМ, а в них есть ip и ua. Журнал читает любой,
 * у кого есть ключ, а разделения по клиентам в этом API нет вовсе — значит
 * адрес и браузер одного покупателя видел другой. Поля нужны внутри, для
 * разбора инцидентов, но снаружи им не место.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

vi.mock("../_audit", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return {
    ...m,
    readAudit: vi.fn(async () => ({
      ok: true,
      entries: [
        {
          id: "aud_1",
          at: 1,
          action: "refund.issued",
          target_id: "rfd_1",
          actor_prefix: "sk_test_1234…",
          ip: "203.0.113.7",
          ua: "Mozilla/5.0 (проверочный)",
          meta: { amount: 100 },
        },
      ],
    })),
  };
});

describe("журнал платежей не отдаёт персональные данные", () => {
  it("в ответе нет ни адреса, ни браузера, но есть суть события", async () => {
    const { GET } = await import("../audit/route");
    const res = await GET(
      new Request("https://aevion.app/api/payments/v1/audit") as never
    );
    const тело = await res.json();
    const строкой = JSON.stringify(тело);

    // Контроль прибора: запись вообще доехала, иначе пустой ответ прошёл бы
    // проверку и сторож был бы декоративным.
    expect(строкой, "запись не доехала — проверять нечего").toContain("refund.issued");

    expect(строкой, "адрес вызывающего ушёл наружу").not.toContain("203.0.113.7");
    expect(строкой, "браузер вызывающего ушёл наружу").not.toContain("Mozilla");
    expect(тело.data?.[0]?.ip, "поле ip осталось в ответе").toBeUndefined();
    expect(тело.data?.[0]?.ua, "поле ua осталось в ответе").toBeUndefined();
  });
});

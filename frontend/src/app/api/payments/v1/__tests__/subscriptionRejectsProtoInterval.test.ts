import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: служебное слово вместо периода не проходит в расчёт.
 *
 * ЗАЧЕМ. Конец периода считается как now + INTERVAL_DAYS[interval] * 86400,
 * то есть значение из запроса используется КЛЮЧОМ ПОИСКА по объекту. Это наш
 * известный класс: обычный объект знает про "constructor" и "__proto__", и
 * такой ключ вернёт не число, а функцию из прототипа — период станет NaN.
 *
 * Сегодня это закрыто списком допустимых значений ДО поиска. Проверено было
 * рассуждением; здесь проверяется вызовом, потому что порядок двух проверок
 * может поменяться при любой правке, и рассуждение об этом не узнает.
 *
 * Ручка подписок — пятая из шести, которые не вызывал ни один тест.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

function запрос(interval: string) {
  return new Request("https://aevion.app/api/payments/v1/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amount: 9900,
      currency: "USD",
      interval,
      customer: "buyer@example.com",
      plan_name: "Проверочный план",
      title: "Проверка периода",
    }),
  }) as never;
}

describe("период подписки не берёт что попало", () => {
  it("служебные слова отбиваются, а не превращаются в NaN", async () => {
    const { POST } = await import("../subscriptions/route");
    for (const мусор of ["constructor", "__proto__", "toString", "valueOf", "нет-такого"]) {
      const res = await POST(запрос(мусор));
      const тело = await res.json();
      expect(res.status, `период ${мусор} принят`).toBe(400);
      expect(JSON.stringify(тело), `ответ на ${мусор} несёт NaN`).not.toContain("NaN");
    }
  });

  it("контроль прибора: допустимый период принимается", async () => {
    // Без этого «все отбиты» было бы зелёным и на ручке, которая отбивает ВСЁ.
    const { POST } = await import("../subscriptions/route");
    const res = await POST(запрос("monthly"));
    const тело = await res.json();
    expect(res.status, `допустимый период отбит: ${JSON.stringify(тело)}`).toBe(201);
    expect(Number.isFinite(тело.current_period_end), "конец периода не число").toBe(true);
  });
});

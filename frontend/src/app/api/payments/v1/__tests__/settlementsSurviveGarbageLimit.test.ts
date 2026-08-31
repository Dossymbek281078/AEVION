import { describe, it, expect, vi } from "vitest";

/**
 * Сторож: мусор в ?limit не превращает журнал выплат в «у вас ничего нет».
 *
 * ЗАЧЕМ. Помощник разбора числа проверен отдельно, но это проверка ФУНКЦИИ.
 * Здесь то же самое проверяется через настоящий маршрут: раньше
 * `Number("zzz")` давал NaN, `slice(0, NaN)` — пустой список, и рядом
 * has_more становился false. Ответ выглядел честной пустотой, а для денежного
 * журнала это хуже отказа.
 *
 * Ручка выплат — шестая и последняя из тех, что не вызывал ни один тест.
 */
vi.mock("../_lib", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, gateRequest: () => ({ ok: true, rateHeaders: {} }) };
});

async function список(query: string) {
  const { GET } = await import("../settlements/route");
  const res = await GET(
    new Request(`https://aevion.app/api/payments/v1/settlements${query}`) as never
  );
  return res.json();
}

describe("журнал выплат не пустеет от мусора в запросе", () => {
  it("без параметров выплаты видны — иначе проверять нечего", async () => {
    const тело = await список("");
    expect(Array.isArray(тело.data), "ответ без списка").toBe(true);
    expect(тело.data.length, "начальных выплат нет — сторож проверял бы пустоту")
      .toBeGreaterThan(0);
  });

  it("?limit=zzz даёт те же выплаты, а не пустоту", async () => {
    const обычный = await список("");
    const мусорный = await список("?limit=zzz");
    expect(
      мусорный.data.length,
      "мусор в пределе превратил журнал в «ничего нет»"
    ).toBe(обычный.data.length);
    expect(мусорный.has_more).toBe(false);
  });

  it("выплаты из начального набора помечены образцом", async () => {
    const тело = await список("");
    const безПометки = (тело.data as { id: string; sample?: boolean }[]).filter(
      (s) => s.sample !== true
    );
    expect(безПометки.map((s) => s.id), "выплата выдаёт себя за настоящую").toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST as refund } from "../api/payments/v1/refunds/route";
import { store } from "../api/payments/v1/_lib";
import { kvList, kvSet } from "../api/payments/v1/_persist";

/**
 * Возврат считался так: прочитать все прошлые возвраты по ссылке → сложить →
 * сравнить с суммой ссылки → дописать свой. Это чтение-изменение-запись, а не
 * атомарная операция: два одновременных запроса читают ОДИН И ТОТ ЖЕ список,
 * оба видят полный остаток, оба проходят проверку — и ссылка на $100
 * возвращается дважды. Второй `kvPush` вдобавок может затереть запись первого.
 *
 * Тот же класс уже чинился в QContract (атомарный `UPDATE … WHERE`) и
 * QMaskCard. Здесь SQL нет, поэтому операции по одной ссылке сериализуются
 * замком.
 *
 * Тест бьёт двумя ПАРАЛЛЕЛЬНЫМИ запросами — именно так дефект и выглядел
 * вживую; последовательные запросы его не показывают.
 */

const LINK_ID = "pl_race";
const REFUNDS_KEY = "refunds.v1";

function req(amount?: number): NextRequest {
  return new Request("https://aevion.app/api/payments/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: "Bearer sk_test_abcdefgh1234",
      "content-type": "application/json",
    },
    body: JSON.stringify({ link_id: LINK_ID, amount }),
  }) as unknown as NextRequest;
}

describe("возврат средств: два одновременных запроса не возвращают дважды", () => {
  beforeEach(async () => {
    await kvSet(REFUNDS_KEY, []);
    store.links.set(LINK_ID, {
      id: LINK_ID,
      amount: 100,
      currency: "USD",
      title: "Race link",
      description: "",
      settlement: "bank",
      expires_in_days: null,
      status: "paid",
      created: Math.floor(Date.now() / 1000),
      url: `https://aevion.app/pay/${LINK_ID}`,
      paid_at: Math.floor(Date.now() / 1000),
    } as never);
  });

  it("сумма всех возвратов не превышает сумму ссылки", async () => {
    const [a, b] = await Promise.all([refund(req(100)), refund(req(100))]);

    // числовой компаратор: .sort() по умолчанию сравнивает строки
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses[0]).toBe(200); // один прошёл
    expect(statuses[1]).toBe(409); // второй честно отбит

    const all = await kvList<{ link_id: string; amount: number }>(REFUNDS_KEY);
    const total = all
      .filter((r) => r.link_id === LINK_ID)
      .reduce((acc, r) => acc + r.amount, 0);
    expect(total).toBe(100);
  });

  it("две половины проходят обе и в сумме дают ровно сумму ссылки", async () => {
    const [a, b] = await Promise.all([refund(req(50)), refund(req(50))]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const all = await kvList<{ link_id: string; amount: number }>(REFUNDS_KEY);
    const total = all
      .filter((r) => r.link_id === LINK_ID)
      .reduce((acc, r) => acc + r.amount, 0);
    expect(total).toBe(100);
  });

  it("запись первого возврата не теряется", async () => {
    await Promise.all([refund(req(30)), refund(req(30))]);
    const all = await kvList<{ link_id: string }>(REFUNDS_KEY);
    expect(all.filter((r) => r.link_id === LINK_ID).length).toBe(2);
  });
});

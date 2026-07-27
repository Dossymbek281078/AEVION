import { beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST as createLink } from "../api/payments/v1/links/route";
import { POST as refund } from "../api/payments/v1/refunds/route";
import { beginIdempotency, store } from "../api/payments/v1/_lib";
import { kvSet } from "../api/payments/v1/_persist";

/**
 * `Idempotency-Key` существует ровно для одного: сеть моргнула, клиент повторил
 * запрос — операция должна выполниться ОДИН раз. Прежняя реализация давала три
 * разных неверных исхода, и все тихо:
 *
 * 1. запись в хранилище делалась в самом конце, поэтому два ОДНОВРЕМЕННЫХ
 *    запроса с одним ключом оба не находили её и оба выполняли операцию;
 * 2. возврат и спор кэшировали ТЕЛО ЗАПРОСА (`checkIdempotency(req, raw)`), и
 *    повтор получал обратно собственное тело с кодом 200 — вместо объекта
 *    возврата приходило `{"link_id":"pl_x","amount":50}`;
 * 3. один ключ с РАЗНЫМИ телами молча отдавал старый ответ: повторив ключ с
 *    суммой 500 вместо 5, клиент считал, что вернул пятьсот.
 */

function req(url: string, body: unknown, key?: string): NextRequest {
  const headers: Record<string, string> = {
    Authorization: "Bearer sk_test_abcdefgh1234",
    "content-type": "application/json",
  };
  if (key) headers["Idempotency-Key"] = key;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const LINKS = "https://aevion.app/api/payments/v1/links";
const REFUNDS = "https://aevion.app/api/payments/v1/refunds";

describe("Idempotency-Key: операция выполняется один раз", () => {
  beforeEach(async () => {
    store.idempotency.clear();
    await kvSet("refunds.v1", []);
  });

  it("повтор с тем же ключом не создаёт второй объект", async () => {
    const payload = { amount: 10, currency: "USD", title: "Один раз" };
    const before = store.links.size;

    const first = await createLink(req(LINKS, payload, "key-repeat"));
    const second = await createLink(req(LINKS, payload, "key-repeat"));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(store.links.size).toBe(before + 1);

    // повтор отдаёт ТОТ ЖЕ объект, а не новый
    expect((await second.json()).id).toBe((await first.json()).id);
  });

  it("два ОДНОВРЕМЕННЫХ запроса с одним ключом создают один объект", async () => {
    const payload = { amount: 10, currency: "USD", title: "Гонка" };
    const before = store.links.size;

    const [a, b] = await Promise.all([
      createLink(req(LINKS, payload, "key-race")),
      createLink(req(LINKS, payload, "key-race")),
    ]);

    // .sort() без компаратора сортирует как СТРОКИ: "200" < "201" < "409".
    // Нужен числовой компаратор, иначе тест проверяет не то, что написано.
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toContain(201); // ровно один выполнил операцию
    // второй — либо повтор готового ответа (200), либо «ещё в работе» (409);
    // что именно, зависит от того, успел ли первый дойти до commit
    expect([200, 409]).toContain(statuses.find((c) => c !== 201));
    expect(store.links.size).toBe(before + 1); // главное: объект ОДИН
  });

  it("тот же ключ с ДРУГИМ телом — отказ, а не старый ответ", async () => {
    await createLink(req(LINKS, { amount: 5, currency: "USD", title: "Пять" }, "key-diff"));
    const res = await createLink(
      req(LINKS, { amount: 500, currency: "USD", title: "Пятьсот" }, "key-diff"),
    );
    expect(res.status).toBe(409);
  });

  it("повтор возврата отдаёт объект возврата, а не эхо запроса", async () => {
    const linkId = "pl_idem_refund";
    store.links.set(linkId, {
      id: linkId,
      amount: 100,
      currency: "USD",
      title: "Refund idem",
      description: "",
      settlement: "bank",
      expires_in_days: null,
      status: "paid",
      created: Math.floor(Date.now() / 1000),
      url: `https://aevion.app/pay/${linkId}`,
      paid_at: Math.floor(Date.now() / 1000),
    } as never);

    const payload = { link_id: linkId, amount: 40 };
    const first = await refund(req(REFUNDS, payload, "key-refund"));
    const second = await refund(req(REFUNDS, payload, "key-refund"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const replay = await second.json();
    // так выглядел дефект: возвращалось тело ЗАПРОСА
    expect(replay).not.toEqual(payload);
    expect(replay.id).toMatch(/^rfd/);
    expect(replay.status).toBe("succeeded");
  });

  it("без заголовка ничего не кэшируется — два запроса, два объекта", async () => {
    const payload = { amount: 7, currency: "USD", title: "Без ключа" };
    const before = store.links.size;
    await createLink(req(LINKS, payload));
    await createLink(req(LINKS, payload));
    expect(store.links.size).toBe(before + 2);
  });

  /**
   * Отдельная проверка именно РЕЗЕРВА ключа. Через маршрут её не поставить:
   * в создании ссылки между началом и `commit` нет ни одного `await`, поэтому
   * первый запрос успевает завершиться раньше, чем второй начнётся, — и тест
   * через маршрут остаётся зелёным, даже если резерв убрать. Проверяю
   * напрямую, чтобы не выдавать за доказанное то, что не доказано.
   */
  it("ключ занят до завершения работы: второй вызов получает отказ", () => {
    const mk = () =>
      new Request(LINKS, {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_abcdefgh1234",
          "Idempotency-Key": "key-inflight",
        },
      }) as unknown as NextRequest;

    const first = beginIdempotency(mk(), '{"amount":1}');
    expect(first.status).toBe("fresh");

    // работа ещё не завершена — commit не вызван
    const second = beginIdempotency(mk(), '{"amount":1}');
    expect(second.status).toBe("conflict");

    if (first.status === "fresh") first.commit('{"id":"pl_1"}');
    const third = beginIdempotency(mk(), '{"amount":1}');
    expect(third.status).toBe("replay");
  });
});

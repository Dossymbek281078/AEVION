import { beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "../api/pay/[id]/route";
import { store } from "../api/payments/v1/_lib";

/**
 * `/api/pay/[id]` — единственная ручка финтеха БЕЗ ключа: по ней платит
 * покупатель. Она принимала `payer_email` любой строкой и отдавала его в
 * `sendReceiptEmail()`, а тот при заданном `RESEND_API_KEY` реально шлёт письмо
 * от `receipts@aevion.app`. То есть публичная ручка рассылала письма по любому
 * адресу. `method` тоже был произвольной строкой и попадал в ТЕЛО письма.
 *
 * Проверяем через настоящий обработчик маршрута, а не через выделенную функцию.
 */

const LINK_ID = "pl_test_capture";

function seedLink() {
  store.links.set(LINK_ID, {
    id: LINK_ID,
    amount: 4900,
    currency: "USD",
    title: "Test link",
    description: "",
    settlement: "bank",
    expires_in_days: null,
    status: "active",
    created: Math.floor(Date.now() / 1000),
    url: `https://aevion.app/pay/${LINK_ID}`,
    paid_at: null,
  } as never);
}

function capture(body: unknown): NextRequest {
  return new Request(`https://aevion.app/api/pay/${LINK_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: LINK_ID }) };

describe("оплата по ссылке: адрес чека и способ оплаты проверяются", () => {
  beforeEach(() => {
    seedLink();
  });

  it("мусор вместо адреса — 400, ссылка не помечается оплаченной", async () => {
    const res = await POST(capture({ payer_email: "не адрес" }), ctx);
    expect(res.status).toBe(400);
    expect(store.links.get(LINK_ID)?.status).toBe("active");
  });

  it("адрес без домена верхнего уровня отбивается", async () => {
    const res = await POST(capture({ payer_email: "a@localhost" }), ctx);
    expect(res.status).toBe(400);
  });

  it("нормальный адрес проходит и чек ставится в очередь", async () => {
    const res = await POST(capture({ payer_email: "buyer@example.com" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).email_queued).toBe(true);
    expect(store.links.get(LINK_ID)?.status).toBe("paid");
  });

  it("без адреса оплата проходит, письма нет", async () => {
    const res = await POST(capture({}), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).email_queued).toBe(false);
  });

  it("произвольный способ оплаты не утекает в письмо и в ответ", async () => {
    const res = await POST(
      capture({ method: "<b>СРОЧНО перейдите по ссылке</b>", payer_email: "buyer@example.com" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).method).toBe("card");
  });

  it("известный способ оплаты сохраняется как есть", async () => {
    const res = await POST(capture({ method: "apple-pay" }), ctx);
    expect((await res.json()).method).toBe("apple-pay");
  });
});

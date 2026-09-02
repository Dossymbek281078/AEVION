import { describe, test, expect, vi, afterEach } from "vitest";

/**
 * Сторож: незнакомая ссылка заказа PayPal не выдаёт платный тариф молча.
 *
 * ЗАМЕР 02.09.2026. У соседней кассы (paybox) провал в lite логируется и
 * уходит в Sentry — это закреплено сторожем payboxUnknownReferenceIsLoud.
 * У paypal тот же провал шёл БЕЗ ЕДИНОГО СЛЕДА.
 *
 * Поведение сторож не меняет: выдать lite правильнее, чем не выдать ничего
 * заплатившему. Но покупатель мог оплатить ДРУГОЙ тариф — и тогда это наша
 * ошибка, о которой надо знать.
 *
 * Проверяются обе стороны: незнакомая ссылка шумит, известные — молчат.
 * Без второй половины сторож проходил бы и на коде, который шумит всегда.
 */
const { тревоги } = vi.hoisted(() => ({ тревоги: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (e: unknown) => {
    тревоги.push(e instanceof Error ? e.message : String(e));
  },
}));

const { tierForReference } = await import("../src/routes/paypalWebhook");

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  warn.mockClear();
  тревоги.length = 0;
});

describe("незнакомая ссылка PayPal слышна", () => {
  test("незнакомая ссылка предупреждает и всё равно даёт lite", () => {
    expect(tierForReference("совершенно-другой-формат-42")).toBe("lite");
    expect(warn, "провал в платный тариф прошёл без предупреждения").toHaveBeenCalledTimes(1);
    expect(
      тревоги.join(" "),
      "провал в платный тариф не ушёл в Sentry: покупатель мог оплатить другой тариф, и узнать об этом было бы неоткуда"
    ).toContain("совершенно-другой-формат-42");
  });

  test("известные ссылки НЕ шумят", () => {
    expect(tierForReference("tier_lite_monthly")).toBe("lite");
    expect(tierForReference("tier_medium_monthly")).toBe("medium");
    expect(tierForReference("tier_full_annual")).toBe("full");
    expect(tierForReference("tier_pro_monthly")).toBe("pro");
    expect(tierForReference("tier_enterprise_annual")).toBe("enterprise");
    expect(
      [warn.mock.calls.length, тревоги.length],
      "известные ссылки поднимают тревогу — это машина ложных тревог на каждой покупке"
    ).toEqual([0, 0]);
  });
});

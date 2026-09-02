/**
 * Отказы у касс считаются — и считаются ПАРОЙ с успехами.
 *
 * Событие `checkout_cancel` с кассой в мете мы пишем с 01.09, а читать его было
 * некому: ни сводки, ни панели. Данные собирались и умирали в журнале — мы
 * платили за сбор и не получали ответа на вопрос «у какой кассы люди
 * отваливаются», хотя починки у разных касс разные.
 *
 * Пара, а не отказы отдельно: у кассы с большим потоком отказов будет больше
 * просто потому, что через неё идут все.
 */
import { describe, it, expect } from "vitest";
import { summarizeCheckoutReturns } from "../src/routes/events";

type Событие = { type: string; meta?: Record<string, unknown> };
const с = (type: string, meta?: Record<string, unknown>) =>
  ({ type, meta }) as unknown as Parameters<typeof summarizeCheckoutReturns>[0][number];

describe("возвраты из касс", () => {
  it("разводит успехи и отказы по кассам", () => {
    const r = summarizeCheckoutReturns([
      с("checkout_success", { provider: "paybox" }),
      с("checkout_cancel", { provider: "paybox" }),
      с("checkout_cancel", { provider: "paybox" }),
      с("checkout_success", { provider: "paypal" }),
    ] as Событие[] as never);

    expect(r.byProvider.paybox).toEqual({ успехов: 1, отказов: 2 });
    expect(r.byProvider.paypal).toEqual({ успехов: 1, отказов: 0 });
    expect(r.успехов).toBe(2);
    expect(r.отказов).toBe(2);
  });

  it("заглушка не считается ни успехом, ни отказом", () => {
    // Иначе прогон смоука выглядел бы как спрос: у нас это уже случалось —
    // брони собственной проверки публиковались как заказы.
    const r = summarizeCheckoutReturns([
      с("checkout_success", { provider: "paybox", stub: true }),
      с("checkout_cancel", { provider: "paybox", stub: true }),
    ] as Событие[] as never);

    expect(r.успехов, "заглушка засчитана покупкой").toBe(0);
    expect(r.отказов, "заглушка засчитана отказом").toBe(0);
    expect(Object.keys(r.byProvider), "заглушка завела кассу").toHaveLength(0);
  });

  it("неизвестная касса идёт в свою корзину, а не приписывается чужой", () => {
    const r = summarizeCheckoutReturns([
      с("checkout_cancel", {}),
      с("checkout_cancel", { provider: "   " }),
      с("checkout_success", { provider: "paybox" }),
    ] as Событие[] as never);

    expect(r.byProvider.unknown, "неизвестные потерялись").toEqual({ успехов: 0, отказов: 2 });
    expect(r.byProvider.paybox.отказов, "чужие отказы приписаны кассе").toBe(0);
  });

  it("посторонние события не влияют", () => {
    const r = summarizeCheckoutReturns([
      с("page_view", { provider: "paybox" }),
      с("checkout_start", { provider: "paybox" }),
      с("lead_submit", { provider: "paybox" }),
    ] as Событие[] as never);

    expect(r.успехов + r.отказов, "в пару попали чужие события").toBe(0);
  });
});

/**
 * Покупки по каналам — число, по которому решают, куда тратить деньги.
 *
 * Общий `byChannel` считает ВСЕ события подряд: просмотры, нажатия, заходы в
 * кассу. Канал с большим трафиком и нулём продаж выглядит в нём лучше канала с
 * одной покупкой. Выглядит при этом ровно как «результат по каналам».
 */
import { describe, it, expect } from "vitest";
import { summarizePurchases } from "../src/routes/events";

const покупка = (meta: Record<string, unknown>, value?: number) => ({
  type: "checkout_success" as const,
  value,
  meta,
});

describe("покупки по каналам", () => {
  it("считает покупки и выручку по каналу", () => {
    const r = summarizePurchases([
      покупка({ channel: "tiktok" }, 49),
      покупка({ channel: "tiktok" }, 19),
      покупка({ channel: "youtube" }, 59),
    ]);
    expect(r.byChannel).toEqual({ tiktok: 2, youtube: 1 });
    expect(r.revenueByChannel).toEqual({ tiktok: 68, youtube: 59 });
    expect(r.total).toBe(3);
  });

  it("бесплатное и заглушка не считаются покупкой", () => {
    // Иначе канал, приводящий любителей бесплатного, выглядит приносящим деньги.
    const r = summarizePurchases([
      покупка({ channel: "tiktok" }, 0),
      покупка({ channel: "tiktok", stub: true }, 49),
    ]);
    expect(r.total).toBe(0);
    expect(r.byChannel).toEqual({});
  });

  it("покупка без суммы считается, но выручку не завышает", () => {
    // У возврата PayBox в адрес уходит ref, а не сумма.
    const r = summarizePurchases([покупка({ channel: "tiktok" }), покупка({ channel: "tiktok" }, 49)]);
    expect(r.byChannel.tiktok).toBe(2);
    expect(r.revenueByChannel.tiktok).toBe(49);
    expect(r.сКоторыхИзвестнаСумма).toBe(1);
  });

  it("знаменатель едет рядом — иначе частичная выручка читается как полная", () => {
    const r = summarizePurchases([покупка({ channel: "tiktok" })]);
    expect(r.total).toBe(1);
    expect(r.сКоторыхИзвестнаСумма).toBe(0);
  });

  it("покупка без канала не пропадает, а идёт в «прямые»", () => {
    const r = summarizePurchases([покупка({}, 49)]);
    expect(r.byChannel).toEqual({ direct: 1 });
  });

  it("заходы в кассу покупкой не считаются", () => {
    const r = summarizePurchases([
      { type: "checkout_start", value: 49, meta: { channel: "tiktok" } } as never,
    ]);
    expect(r.total).toBe(0);
  });
});

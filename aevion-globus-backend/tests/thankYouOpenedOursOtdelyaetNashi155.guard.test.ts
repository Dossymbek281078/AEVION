import { describe, it, expect } from "vitest";
import { разрезВоронки } from "../src/routes/events";

/*
 * 🔴 155 (18.10.2026, задание оркестратора). Шаг «спасибо» (`checkout_success` — браузер открыл страницу возврата
 * из кассы) за 14 дней показывал 3 и не отделял НАШИ заходы от живых: у checkoutStart и paid половина «Ours» была,
 * у thankYouOpened — нет. При paid 0 это единственный шаг, по которому можно подумать «кто-то дошёл до конца», и
 * он обязан говорить, сколько из этого — мы.
 *
 * «Наши» — тот же набор сессий, что и у checkoutStartOurs/paidOurs: второй аргумент разрезВоронки (на проде его
 * собирает читатель журнала по метке probe-* и флагу probe).
 */
const событие = (type: string, meta?: Record<string, string | number | boolean | null>, path?: string, sid?: string) => ({ type, meta, path, sid });

describe("155: thankYouOpenedOurs отделяет наши открытия страницы «спасибо»", () => {
  it("🔴 итог и канал: 3 открытия, из них 1 нашей сессией → thankYouOpened 3, thankYouOpenedOurs 1", () => {
    const r = разрезВоронки([
      событие("page_view", { channel: "youtube" }, "/pricing", "s-live-1"),
      событие("page_view", { channel: "youtube" }, "/pricing", "s-live-2"),
      событие("page_view", { channel: "direct" }, "/pricing?c=probe-okno", "s-nash"),
      событие("checkout_success", { channel: "youtube", app: "multichat" }, "/pricing/success", "s-live-1"),
      событие("checkout_success", { channel: "youtube", app: "multichat" }, "/pricing/success", "s-live-2"),
      событие("checkout_success", { channel: "youtube", app: "multichat" }, "/pricing/success?c=probe-okno", "s-nash"),
    ], new Set(["s-nash"]));
    expect(r.total.thankYouOpened).toBe(3);
    expect(r.total.thankYouOpenedOurs).toBe(1);
    expect(r.byChannel["youtube"].thankYouOpened).toBe(3);
    expect(r.byChannel["youtube"].thankYouOpenedOurs).toBe(1);
  });

  it("КОНТРОЛЬ: без наших сессий — Ours 0 при тех же открытиях; без открытий — обе половины 0", () => {
    const живые = разрезВоронки([
      событие("page_view", { channel: "youtube" }, "/pricing", "s-1"),
      событие("checkout_success", { channel: "youtube" }, "/pricing/success", "s-1"),
    ], new Set());
    expect(живые.total.thankYouOpened).toBe(1);
    expect(живые.total.thankYouOpenedOurs).toBe(0);
    const пусто = разрезВоронки([событие("page_view", { channel: "youtube" }, "/pricing", "s-1")]);
    expect(пусто.total.thankYouOpened).toBe(0);
    expect(пусто.total.thankYouOpenedOurs).toBe(0);
  });

  it("Ours никогда не больше всего — на смешанном наборе", () => {
    const r = разрезВоронки([
      событие("page_view", { channel: "direct" }, "/?c=probe-a", "s-a"),
      событие("page_view", { channel: "direct" }, "/?c=probe-b", "s-b"),
      событие("checkout_success", { channel: "direct" }, "/pricing/success", "s-a"),
      событие("checkout_success", { channel: "direct" }, "/pricing/success", "s-b"),
      событие("checkout_success", { channel: "direct" }, "/pricing/success", "s-c"),
    ], new Set(["s-a", "s-b"]));
    expect(r.total.thankYouOpenedOurs).toBe(2);
    expect(r.total.thankYouOpenedOurs).toBeLessThanOrEqual(r.total.thankYouOpened);
  });
});

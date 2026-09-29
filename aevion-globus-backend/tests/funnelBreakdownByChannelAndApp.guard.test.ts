import { describe, it, expect } from "vitest";
import { разрезВоронки } from "../src/routes/events";

/**
 * РАЗРЕЗ ВОРОНКИ ПО КАНАЛУ И ПРИЛОЖЕНИЮ.
 *
 * Повод 29.09.2026. Сводка /funnel отдавала четыре числа и разбивку по дням —
 * и дважды за день это стоило разбора: окно роликов не могло сказать, привели
 * ли 144 просмотра хоть один визит, а окно кассы выясняло перепиской, чьи пять
 * начал оплаты (оказалось — пробы окна цен). Метка канала в событиях есть,
 * наружу не выходила.
 *
 * Проверяется ТА ЖЕ функция, что работает на проде, а не её копия в тесте:
 * копия расходится с оригиналом молча.
 */

const событие = (
  type: string,
  meta?: Record<string, string | number | boolean | null>,
  path?: string,
) => ({ type, meta, path });

describe("разрез воронки", () => {
  it("считает шаги по каналам", () => {
    const r = разрезВоронки([
      событие("page_view", { channel: "youtube" }, "/"),
      событие("page_view", { channel: "youtube" }, "/pricing"),
      событие("page_view", { channel: "product-hunt" }, "/pricing"),
      событие("checkout_start", { channel: "youtube", app: "multichat" }),
      событие("checkout_success", { channel: "youtube", app: "multichat" }),
    ]);
    expect(r.byChannel["youtube"]).toEqual({ visits: 2, pricing: 1, checkoutStart: 1, paid: 1 });
    expect(r.byChannel["product-hunt"]).toEqual({ visits: 1, pricing: 1, checkoutStart: 0, paid: 0 });
  });

  it("«без метки» и «метка неизвестна» — РАЗНЫЕ ответы", () => {
    // Их слияние прячет целые площадки: ровно так Product Hunt весь день
    // выглядел прямыми заходами.
    const r = разрезВоронки([
      событие("page_view", {}, "/"),
      событие("page_view", { channel: "unknown" }, "/"),
    ]);
    expect(r.byChannel["direct"].visits).toBe(1);
    expect(r.byChannel["unknown"].visits).toBe(1);
  });

  it("покупка плана не пропадает: считается под ключом plan", () => {
    const r = разрезВоронки([
      событие("checkout_start", { channel: "direct" }),
      событие("checkout_success", { channel: "direct", app: "qskyway" }),
    ]);
    expect(r.byApp["plan"]).toEqual({ checkoutStart: 1, paid: 0 });
    expect(r.byApp["qskyway"]).toEqual({ checkoutStart: 0, paid: 1 });
  });

  it("сумма по каналам сходится с суммой по приложениям", () => {
    const события = [
      событие("checkout_start", { channel: "yt", app: "multichat" }),
      событие("checkout_start", { channel: "ph", app: "devhub" }),
      событие("checkout_success", { channel: "ph", app: "devhub" }),
    ];
    const r = разрезВоронки(события);
    const поКаналам = Object.values(r.byChannel).reduce((a, b) => a + b.checkoutStart, 0);
    const поПриложениям = Object.values(r.byApp).reduce((a, b) => a + b.checkoutStart, 0);
    expect(поКаналам, "разрезы разошлись — одно и то же событие посчитано по-разному").toBe(поПриложениям);
  });

  it("КОНТРОЛЬ: имя канала из адреса не открывает наследство", () => {
    // Ключ приходит из адреса, который открыл посторонний. У обычного объекта
    // byChannel["constructor"] вернул бы функцию, число ушло бы в наследство, и
    // в отчёте его просто не стало бы, а сумма выглядела бы целой.
    const r = разрезВоронки([
      событие("page_view", { channel: "constructor" }, "/"),
      событие("page_view", { channel: "__proto__" }, "/"),
    ]);
    expect(r.byChannel["constructor"].visits).toBe(1);
    expect(r.byChannel["__proto__"].visits).toBe(1);
    expect(Object.keys(r.byChannel).sort()).toEqual(["__proto__", "constructor"]);
  });

  it("КОНТРОЛЬ: пустой вход даёт пустой разрез, а не выдуманные ключи", () => {
    const r = разрезВоронки([]);
    expect(Object.keys(r.byChannel)).toEqual([]);
    expect(Object.keys(r.byApp)).toEqual([]);
  });
});

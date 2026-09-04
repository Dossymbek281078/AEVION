/**
 * Служебное имя канала или кассы не выкидывает строку из сводки.
 *
 * Накопители сводок — обычные объекты с ключом ИЗ СОБЫТИЯ, то есть в конечном
 * счёте из адреса, который открыл посторонний. У обычного объекта
 * `byX["constructor"]` возвращает функцию, а `byX["__proto__"]` — прототип:
 * строка не заводится, число уходит в наследство, и в отчёте её просто НЕТ.
 * Сумма при этом выглядит целой — то есть потеря невидима.
 *
 * Соседнее окно замерило ровно это 04.09 на отчёте о выручке: подали три
 * канала, в ответе остался один. Здесь та же форма, и сюда она пришла из МОЕЙ
 * же правки: `byProvider` я завёл сегодня, а ключ у него — касса из адреса
 * возврата.
 *
 * Отдельно про `__proto__`: там дело не только в пропаже. Присваивание уходит
 * в прототип, и число наследует КАЖДЫЙ объект процесса.
 */
import { describe, it, expect } from "vitest";
import { summarizeCheckoutReturns, summarizePurchases } from "../src/routes/events";

const СЛУЖЕБНЫЕ = ["constructor", "__proto__", "toString", "hasOwnProperty"];

type Событие = { type: string; value?: number; meta?: Record<string, unknown> };
const ев = (o: Событие) => o as unknown as Parameters<typeof summarizeCheckoutReturns>[0][number];

describe("сводки при служебных именах", () => {
  it.each(СЛУЖЕБНЫЕ)("касса «%s» остаётся в разбивке возвратов", (имя) => {
    const r = summarizeCheckoutReturns([
      ев({ type: "checkout_success", meta: { provider: имя } }),
      ев({ type: "checkout_cancel", meta: { provider: имя } }),
    ]);
    expect(Object.keys(r.byProvider), `касса ${имя} исчезла из отчёта`).toContain(имя);
    expect(r.byProvider[имя], `строка ${имя} не число, а наследство`).toEqual({
      успехов: 1,
      отказов: 1,
    });
    // Итоги обязаны сойтись с разбивкой: иначе пропажа не видна по сумме.
    expect(r.успехов + r.отказов, "итог разошёлся с разбивкой").toBe(2);
  });

  it.each(СЛУЖЕБНЫЕ)("канал «%s» остаётся в разбивке покупок", (имя) => {
    const p = summarizePurchases([
      ев({ type: "checkout_success", value: 49, meta: { channel: имя } }) as never,
    ] as never);
    expect(Object.keys(p.byChannel), `канал ${имя} исчез из отчёта`).toContain(имя);
    expect(p.byChannel[имя], `счёт по каналу ${имя} потерян`).toBe(1);
  });

  it("обычные имена по-прежнему считаются", () => {
    // Контроль: без него «всё сохраняется» могло бы держаться на пустом объекте.
    const r = summarizeCheckoutReturns([
      ев({ type: "checkout_success", meta: { provider: "paybox" } }),
      ев({ type: "checkout_cancel", meta: { provider: "paybox" } }),
      ев({ type: "checkout_cancel", meta: { provider: "paypal" } }),
    ]);
    expect(r.byProvider.paybox).toEqual({ успехов: 1, отказов: 1 });
    expect(r.byProvider.paypal).toEqual({ успехов: 0, отказов: 1 });
  });

  it("прототип не загрязняется", () => {
    /*
     * Самое тихое последствие: `byX["__proto__"].успехов += 1` пишет в прототип,
     * и поле появляется у КАЖДОГО объекта процесса. Проверяем на постороннем.
     */
    summarizeCheckoutReturns([ев({ type: "checkout_success", meta: { provider: "__proto__" } })]);
    const посторонний: Record<string, unknown> = {};
    expect(посторонний.успехов, "прототип загрязнён — поле протекло наружу").toBeUndefined();
  });
});

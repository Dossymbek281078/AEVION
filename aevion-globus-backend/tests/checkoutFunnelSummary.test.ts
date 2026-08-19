import { describe, test, expect } from "vitest";
import { summarizeCheckoutStarts } from "../src/routes/events";

// Разбивка начал оплаты — 2026-08-10.
//
// До этого дня `checkout_start` слался ровно из одного места (таблица тарифов
// на /pricing), а сводка отдавала только `bySource` по ВСЕМ событиям, где
// покупки тонули среди page_view. Дашборд показывал заниженное число как факт.
//
// Теперь событие шлёт каждая точка входа в оплату, а сводка отдаёт два среза
// именно по ним. Проверяется настоящая экспортированная функция, а не её
// копия в тесте: копия расходится с оригиналом молча.

describe("summarizeCheckoutStarts", () => {
  test("считает только checkout_start, прочие события игнорирует", () => {
    const { bySource } = summarizeCheckoutStarts([
      { type: "page_view", source: "shop" },
      { type: "cta_click", source: "shop" },
      { type: "checkout_start", source: "shop" },
      { type: "checkout_start", source: "shop" },
      { type: "checkout_start", source: "apps/qventure" },
    ]);
    expect(bySource).toEqual({ shop: 2, "apps/qventure": 1 });
  });

  test("канал берётся из meta.channel, без метки — direct", () => {
    const { byChannel } = summarizeCheckoutStarts([
      { type: "checkout_start", source: "go", meta: { channel: "tg" } },
      { type: "checkout_start", source: "go", meta: { channel: "tg" } },
      { type: "checkout_start", source: "shop", meta: { channel: "ig" } },
      { type: "checkout_start", source: "shop" },
      { type: "checkout_start", source: "shop", meta: {} },
    ]);
    expect(byChannel).toEqual({ tg: 2, ig: 1, direct: 2 });
  });

  test("пустые и нестроковые значения не создают отдельных корзин", () => {
    // Пустая метка `?c=` и мусор из meta не должны выглядеть как отдельный
    // канал: иначе дашборд покажет три «канала» там, где источник один.
    const { bySource, byChannel } = summarizeCheckoutStarts([
      { type: "checkout_start", source: "   ", meta: { channel: "   " } },
      { type: "checkout_start", meta: { channel: 42 } },
      { type: "checkout_start", source: "shop", meta: { channel: null } },
    ]);
    expect(bySource).toEqual({ unknown: 2, shop: 1 });
    expect(byChannel).toEqual({ direct: 3 });
  });

  test("пустой вход даёт пустые разбивки, а не падение", () => {
    expect(summarizeCheckoutStarts([])).toEqual({ bySource: {}, byChannel: {} });
  });
});

import { describe, test, expect } from "vitest";
import { anchorBadge } from "./anchorBadge";

describe("пометка якоря на карточке реестра", () => {
  test("поля НЕТ — не рисуем ничего, а не «без якоря»", () => {
    // До выкатки бэкенда поле отсутствует у ВСЕХ записей. Написать в этот
    // момент «no Bitcoin anchor» на всей витрине = оболгать свой продукт.
    expect(anchorBadge(undefined)).toBeNull();
    expect(anchorBadge(null)).toBeNull();
    expect(anchorBadge({})).toBeNull();
    expect(anchorBadge({ status: "" })).toBeNull();
  });

  test("подтверждено — называем номер блока", () => {
    const b = anchorBadge({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 })!;
    expect(b.tone).toBe("confirmed");
    expect(b.label).toContain("912345");
  });

  test("подтверждено без высоты — не выдумываем номер", () => {
    const b = anchorBadge({ status: "bitcoin-confirmed", bitcoinBlockHeight: null })!;
    expect(b.tone).toBe("confirmed");
    expect(b.label).not.toMatch(/[0-9]/);
  });

  test("«ещё готовится» и «не будет никогда» — РАЗНЫЕ пометки", () => {
    const pending = anchorBadge({ status: "pending" })!;
    const never = anchorBadge({ status: "not_stamped" })!;
    expect(pending.label).not.toBe(never.label);
    expect(pending.tone).not.toBe(never.tone);
    // И объяснения тоже разные: одно обещает будущее, другое его отрицает.
    expect(never.title).toMatch(/не появится/);
    expect(pending.title).not.toMatch(/не появится/);
  });

  test("не якорённый не выглядит поломкой", () => {
    const b = anchorBadge({ status: "not_stamped" })!;
    expect(b.tone).toBe("none");
    expect(b.tone).not.toBe("failed");
    // Остальные слои доказательства названы — иначе запись читается как пустая.
    expect(b.title).toMatch(/остальные слои/i);
  });

  test("незнакомое состояние показывается как есть, а не прячется", () => {
    const b = anchorBadge({ status: "какое-то-новое" })!;
    expect(b).not.toBeNull();
    expect(b.label).toBe("какое-то-новое");
  });

  test("все пять тонов имеют цвет", async () => {
    const { ANCHOR_TONE_COLORS } = await import("./anchorBadge");
    for (const t of ["confirmed", "pending", "none", "failed", "unknown"] as const) {
      expect(ANCHOR_TONE_COLORS[t], `нет цвета для тона ${t}`).toBeDefined();
    }
  });
});

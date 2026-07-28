import { describe, it, expect } from "vitest";
import { COMPARISONS } from "../competitors";

/**
 * Страж честности сравнений.
 *
 * Таблица «мы против аналогов» опасна тем, что незаметно превращается в
 * рекламу: каждый следующий редактор дописывает строку о своей сильной стороне
 * и не дописывает о чужой. Через месяц получается документ, где мы лучше по
 * всем пунктам, — и читатель перестаёт верить всему остальному на сайте.
 *
 * Поэтому правило «у каждого модуля названо, в чём аналог лучше» проверяется
 * тестом, а не держится на добросовестности.
 */

describe("сравнения с аналогами остаются честными", () => {
  it("у каждого модуля названо, в чём аналог сильнее", () => {
    const oneSided = COMPARISONS.filter((c) => c.weaker.length === 0).map((c) => c.id);
    expect(
      oneSided,
      "Сравнение без слабых сторон — реклама, а не сравнение:\n" + oneSided.join(", "),
    ).toEqual([]);
  });

  it("слабых сторон не меньше двух — одна отписка не считается разбором", () => {
    const thin = COMPARISONS.filter((c) => c.weaker.length < 2).map((c) => c.id);
    expect(thin, "Слишком мало слабых сторон: " + thin.join(", ")).toEqual([]);
  });

  it("у каждого модуля есть с кем сравнивать", () => {
    for (const c of COMPARISONS) {
      expect(c.rivals.length, `${c.id}: не указан ни один аналог`).toBeGreaterThan(0);
    }
  });

  it("сильные стороны не пусты — иначе непонятно, зачем модуль", () => {
    for (const c of COMPARISONS) {
      expect(c.stronger.length, `${c.id}: не названо ни одной сильной стороны`).toBeGreaterThan(0);
    }
  });

  it("идентификаторы уникальны", () => {
    const ids = COMPARISONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("нет сравнительных цифр без замера", () => {
    // «на 40% быстрее» и «в 3 раза дешевле» требуют прогона, который можно
    // показать. Если основание не "measured", числовых сравнений быть не должно —
    // иначе цифра из чужого маркетинга выдаётся за наш факт.
    const numericClaim = /\b(в \d+([.,]\d+)?\s*раз|на \d+\s*%|\d+\s*% (быстрее|дешевле|точнее))/i;
    const offenders: string[] = [];
    for (const c of COMPARISONS) {
      if (c.basis === "measured") continue;
      for (const line of [...c.stronger, ...c.weaker]) {
        if (numericClaim.test(line)) offenders.push(`${c.id}: ${line}`);
      }
    }
    expect(offenders, "Числовое сравнение без замера:\n" + offenders.join("\n")).toEqual([]);
  });

  it("стадия совпадает со словарём реестра", () => {
    for (const c of COMPARISONS) {
      expect(["live", "mvp"], `${c.id}: неизвестная стадия ${c.stage}`).toContain(c.stage);
    }
  });
});

import { describe, it, expect } from "vitest";
import { COMPARISONS, UNANALYSED, REVIEW_AFTER_DAYS, reviewAfter } from "./competitors";

describe("reviewAfter", () => {
  it("прибавляет ровно REVIEW_AFTER_DAYS дней", () => {
    expect(reviewAfter("2026-07-28")).toBe("2026-10-26");
  });

  it("переваливает через конец месяца и года", () => {
    expect(reviewAfter("2026-12-31", 1)).toBe("2027-01-01");
    expect(reviewAfter("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("знает про високосный год", () => {
    expect(reviewAfter("2028-02-28", 1)).toBe("2028-02-29");
    expect(reviewAfter("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("не зависит от часов: два вызова подряд дают одно и то же", () => {
    expect(reviewAfter("2026-07-28")).toBe(reviewAfter("2026-07-28"));
  });

  it("на мусорной дате возвращает вход, а не Invalid Date", () => {
    expect(reviewAfter("не дата")).toBe("не дата");
    expect(reviewAfter("")).toBe("");
  });
});

describe("правила таблицы, без которых она превращается в рекламу", () => {
  it("у каждого модуля есть хотя бы одна строка «где сильнее они»", () => {
    const noWeakness = COMPARISONS.filter((c) => c.weLose.length === 0).map((c) => c.moduleId);
    expect(noWeakness).toEqual([]);
  });

  it("у каждого модуля есть хотя бы один конкурент и одна наша сильная сторона", () => {
    const broken = COMPARISONS.filter((c) => c.rivals.length === 0 || c.weWin.length === 0);
    expect(broken.map((c) => c.moduleId)).toEqual([]);
  });

  it("у каждого утверждения есть непустое доказательство", () => {
    const empty = COMPARISONS.flatMap((c) =>
      [...c.weWin, ...c.weLose]
        .filter((claim) => claim.evidence.trim().length === 0)
        .map((claim) => `${c.moduleId}: ${claim.text}`),
    );
    expect(empty).toEqual([]);
  });

  it("даты срезов в формате YYYY-MM-DD и разбираются", () => {
    const bad = COMPARISONS.filter(
      (c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.surveyedAt) || reviewAfter(c.surveyedAt) === c.surveyedAt,
    );
    expect(bad.map((c) => c.moduleId)).toEqual([]);
  });

  it("идентификаторы модулей уникальны — иначе карточка потеряется по key", () => {
    const ids = COMPARISONS.map((c) => c.moduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("сила конкурента описана, а не оставлена пустой строкой", () => {
    const lazy = COMPARISONS.flatMap((c) =>
      c.rivals.filter((r) => r.strength.trim().length < 10).map((r) => `${c.moduleId}: ${r.name}`),
    );
    expect(lazy).toEqual([]);
  });

  it("модуль не может быть одновременно разобран и в очереди", () => {
    const analysed = new Set(COMPARISONS.map((c) => c.module));
    const both = UNANALYSED.filter((u) => analysed.has(u.module));
    expect(both).toEqual([]);
  });

  it("окно пересмотра осмысленное, а не ноль", () => {
    expect(REVIEW_AFTER_DAYS).toBeGreaterThan(0);
  });
});

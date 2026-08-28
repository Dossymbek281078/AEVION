import { describe, expect, test, vi, afterEach } from "vitest";
import { pickDailyIdx } from "../dailyPick";

/**
 * Запасной выбор задачи дня. Главное его свойство — ОДИНАКОВЫЙ ответ у всех в
 * один и тот же день: иначе двое решают разные задачи и сравнивают
 * несравнимое, а таблица результатов становится враньём.
 */
afterEach(() => vi.useRealTimers());
const vDen = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };

describe("выбор задачи дня без сервера", () => {
  test("в один и тот же день выдаёт один и тот же номер", () => {
    vDen("2026-08-28T03:00:00Z");
    const utrom = pickDailyIdx(500000);
    vDen("2026-08-28T21:45:00Z");
    expect(pickDailyIdx(500000)).toBe(utrom);
  });

  test("в разные дни номера разные", () => {
    vDen("2026-08-28T12:00:00Z");
    const segodnya = pickDailyIdx(500000);
    vDen("2026-08-29T12:00:00Z");
    expect(pickDailyIdx(500000)).not.toBe(segodnya);
  });

  test("номер всегда внутри банка задач", () => {
    for (const den of ["2026-08-28", "2026-09-15", "2027-01-01", "2030-06-30"]) {
      vDen(den + "T10:00:00Z");
      const i = pickDailyIdx(1000);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(1000);
    }
  });

  test("пустой банк не роняет и не даёт отрицательный номер", () => {
    vDen("2026-08-28T10:00:00Z");
    expect(pickDailyIdx(0)).toBe(0);
  });

  test("за две недели ни один день не повторяет соседний", () => {
    const bylo: number[] = [];
    for (let d = 1; d <= 14; d++) {
      vDen(`2026-09-${String(d).padStart(2, "0")}T10:00:00Z`);
      bylo.push(pickDailyIdx(500000));
    }
    for (let i = 1; i < bylo.length; i++) expect(bylo[i]).not.toBe(bylo[i - 1]);
  });
});

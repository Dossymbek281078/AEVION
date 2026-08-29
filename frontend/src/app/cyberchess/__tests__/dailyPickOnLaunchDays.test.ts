import { describe, it, expect, vi, afterEach } from "vitest";
import { pickDailyIdx } from "../dailyPick";

/**
 * Запасной выбор задачи дня на РЕАЛЬНЫЕ даты запуска. Вопрос не «меняется ли
 * вообще» (это проверяет dailyPick.test), а «сменится ли она 30 августа и в
 * первую неделю»: если человек вернётся на второй день и увидит ту же задачу,
 * возвращаться на третий незачем.
 *
 * Функция берётся ИЗ МОДУЛЯ, а не воспроизводится здесь: повторить формулу в
 * тесте — значит проверить собственную копию.
 */
const DNI = [
  "2026-08-29", "2026-08-30", "2026-08-31",
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
];

afterEach(() => vi.useRealTimers());

function vybor(den: string, vsego = 365): number {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${den}T12:00:00Z`));
  return pickDailyIdx(vsego);
}

describe("задача дня в дни запуска", () => {
  it("каждый день недели запуска даёт свою задачу", () => {
    const vse = DNI.map((d) => vybor(d));
    expect(new Set(vse).size).toBe(DNI.length);
  });

  it("два дня подряд не повторяются — иначе возвращаться незачем", () => {
    const vse = DNI.map((d) => vybor(d));
    const povtory = vse.filter((v, i) => i > 0 && v === vse[i - 1]);
    expect(povtory).toEqual([]);
  });

  it("выбор укладывается в размер набора", () => {
    for (const d of DNI) {
      const i = vybor(d, 12);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(12);
    }
  });
});

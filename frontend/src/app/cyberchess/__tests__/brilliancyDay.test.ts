import { describe, it, expect } from "vitest";
import { localDayNumber, todayKeyLocal, pickIdx } from "../brilliancy";

/* Задача дня выбиралась по номеру суток UTC, а дата состояния писалась по местному
   календарю. Для UTC+6 эти две величины переключаются с разницей в шесть часов:
   с полуночи до 6 утра дата уже новая, а номер суток ещё вчерашний — значит новое
   состояние заводилось под ВЧЕРАШНЮЮ задачу, и её повторное решение поднимало серию.

   Поэтому тест проверяет не формулу, а СВЯЗКУ: строка даты и номер суток обязаны
   меняться в один и тот же момент. Это свойство и было нарушено. */

const utcDayNumber = (d: Date) => Math.floor(d.getTime() / 86_400_000);

describe("сутки задачи дня", () => {
  it("номер суток меняется ровно тогда же, когда строка даты", () => {
    // час за часом двое суток подряд: каждый переход даты обязан совпасть с переходом номера
    const start = new Date(2026, 6, 27, 0, 0, 0); // 27 июля, местное время
    let prevKey = todayKeyLocal(start);
    let prevDay = localDayNumber(start);
    for (let h = 1; h <= 48; h++) {
      const d = new Date(start.getTime() + h * 3_600_000);
      const key = todayKeyLocal(d);
      const day = localDayNumber(d);
      expect(key !== prevKey).toBe(day !== prevDay);
      prevKey = key;
      prevDay = day;
    }
  });

  it("в пределах одних местных суток номер не меняется", () => {
    const a = new Date(2026, 6, 27, 0, 30, 0);
    const b = new Date(2026, 6, 27, 23, 30, 0);
    expect(localDayNumber(a)).toBe(localDayNumber(b));
    expect(pickIdx(50, localDayNumber(a))).toBe(pickIdx(50, localDayNumber(b)));
  });

  it("на следующие сутки номер растёт ровно на единицу", () => {
    const a = new Date(2026, 6, 27, 12, 0, 0);
    const b = new Date(2026, 6, 28, 12, 0, 0);
    expect(localDayNumber(b) - localDayNumber(a)).toBe(1);
  });

  it("соседние сутки почти всегда дают разную задачу", () => {
    const base = localDayNumber(new Date(2026, 6, 27, 12, 0, 0));
    const idxs = Array.from({ length: 30 }, (_, k) => pickIdx(50, base + k));
    expect(new Set(idxs).size).toBeGreaterThan(20);
  });

  it("пустой набор не роняет выбор", () => {
    expect(pickIdx(0)).toBe(0);
  });

  it("прежняя UTC-формула расходилась с местной датой — так и выглядела ошибка", () => {
    // в положительном смещении утренние часы дают разные ответы у двух формул
    const morning = new Date(2026, 6, 27, 1, 0, 0);
    const offset = morning.getTimezoneOffset(); // минуты; для UTC+6 это -360
    if (offset < 0) {
      expect(localDayNumber(morning)).not.toBe(utcDayNumber(morning));
    } else {
      // на машине в UTC или западнее окно расхождения приходится на вечер
      expect(localDayNumber(morning)).toBe(utcDayNumber(morning));
    }
  });
});

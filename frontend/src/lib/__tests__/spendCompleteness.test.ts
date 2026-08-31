import { describe, it, expect } from "vitest";
import { spendCompleteness } from "../spendCompleteness";

// Три исхода, и средний — тот, ради которого всё это вынесено из страницы.
// «Поля нет» тихо превращается в «всё хорошо» одной невнимательной правкой:
// достаточно заменить `== null` на проверку на ложность.

describe("полнота сводки расходов различает три исхода", () => {
  it("поля нет — НЕ ЗНАЕМ, а не «полно»", () => {
    expect(spendCompleteness(undefined).kind).toBe("unknown");
    expect(spendCompleteness(null).kind).toBe("unknown");
  });

  it("ноль — полно", () => {
    expect(spendCompleteness(0).kind).toBe("complete");
  });

  it("больше нуля — неполно, и число потерь названо", () => {
    const c = spendCompleteness(7);
    expect(c.kind).toBe("incomplete");
    // Число обязано доехать: «неполно» без величины не даёт решить, тревога
    // это или единичный сбой.
    expect(c).toMatchObject({ lost: 7 });
  });

  it("ноль и отсутствие поля НЕ совпадают", () => {
    // Ключевое утверждение файла. Обе проверки выше по отдельности пережили
    // бы схлопывание двух исходов в один; эта — нет.
    expect(spendCompleteness(0).kind).not.toBe(spendCompleteness(undefined).kind);
  });

  it("мусор вместо числа не выдаётся за неполноту", () => {
    // NaN приходит от Number(...) на нечисловом ответе. Это «не знаю» по
    // происхождению, но тревогой быть не должно: считаем полным и молчим.
    expect(spendCompleteness(Number.NaN).kind).toBe("complete");
  });
});

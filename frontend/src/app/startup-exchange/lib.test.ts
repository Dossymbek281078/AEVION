import { describe, it, expect } from "vitest";
import { humanError, usd, dealHeadline } from "./lib";

/**
 * Первые тесты фронта биржи. Взяты не наугад: обе функции уже давали дефекты,
 * которые видел человек, а не тест.
 *   - `humanError`: в красной строке под формой стояло буквально «rate_limited»;
 *   - `usd`: карточка писала «$30K», а заголовок «$30.0K» — у layout была своя
 *     копия форматирования.
 */
describe("humanError", () => {
  it("код превращается в предложение, а не показывается человеку", () => {
    expect(humanError("rate_limited", 429)).toMatch(/Подождите минуту/);
    expect(humanError("daily_publish_limit", 429)).toMatch(/завтра/);
    // 503 говорит «заявки на месте» — это разница между «подожду» и «всё пропало».
    expect(humanError("database_unavailable", 503)).toMatch(/заявки на месте/);
  });

  it("незнакомый машинный код не утекает на экран", () => {
    const out = humanError("some_new_backend_code", 400);
    expect(out).not.toContain("some_new_backend_code");
    expect(out).toBe("Ошибка 400. Попробуйте ещё раз.");
  });

  it("человеческий текст от сервера проходит как есть", () => {
    expect(humanError("Похоже, это не email — основатель не сможет ответить", 400))
      .toBe("Похоже, это не email — основатель не сможет ответить");
  });

  it("без кода — понятная заглушка со статусом", () => {
    expect(humanError(undefined, 500)).toBe("Ошибка 500. Попробуйте ещё раз.");
  });
});

describe("usd", () => {
  it("не тянет нулевой хвост: $30K, а не $30.0K", () => {
    expect(usd(30_000)).toBe("$30K");
    expect(usd(150_000)).toBe("$150K");
    expect(usd(2_000_000)).toBe("$2M");
  });

  it("дробные значения сохраняют один знак", () => {
    expect(usd(16_700)).toBe("$16.7K");
    expect(usd(2_500_000)).toBe("$2.5M");
  });

  it("мелкие суммы остаются числом, а не нулём", () => {
    expect(usd(900)).toBe("$900");
    expect(usd(0)).toBe("$0");
  });

  it("нет числа — прочерк, а не «$undefined» и не «$NaN»", () => {
    expect(usd(null)).toBe("—");
    expect(usd(undefined)).toBe("—");
    expect(usd(Number.NaN)).toBe("—");
    expect(usd(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("dealHeadline", () => {
  it("условия читаются одной строкой", () => {
    expect(dealHeadline({ intent: "raise", askUsd: 50_000, equityOfferedPct: 10 })).toBe("$50K за 10%");
    expect(dealHeadline({ intent: "sell_stake", stakeForSalePct: 25, stakePriceUsd: 120_000 }))
      .toBe("25% за $120K");
  });

  it("неполные условия не превращаются в «$— за undefined%»", () => {
    expect(dealHeadline({ intent: "raise" })).toBe("Привлекает инвестиции");
    expect(dealHeadline({ intent: "sell_stake" })).toBe("Продаёт долю");
    expect(dealHeadline(null)).toBe("Условия сделки не указаны");
  });
});

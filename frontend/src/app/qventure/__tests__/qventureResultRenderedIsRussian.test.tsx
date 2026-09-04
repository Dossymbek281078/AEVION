import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { LensCard, StrategyPanel, FactorBreakdown } from "../_result";
import { sobratVidimyj, angliyskieStroki, TERMINY_OBSHIE } from "@/test-utils/renderedText";

/**
 * Разбор, который покупатель ПОЛУЧАЕТ за деньги, — на русском.
 *
 * Это не витрина и не форма: это сам товар. Модуль стоит $39/мес, и человек
 * читает эти карточки, решая, вкладывать или нет. Английская подпись здесь
 * стоит дороже, чем где-либо ещё в модуле.
 *
 * ПОЧЕМУ ЧАСТЯМИ, А НЕ ЦЕЛИКОМ. Полный ResultView требует фикстуры на десятки
 * полей, и она сама стала бы источником ошибок — половина времени ушла бы на
 * поддержание выдумки в актуальном виде. Части покрывают то, что человек
 * действительно читает: линзы совета, стратегию входа, разбор по факторам.
 *
 * ГРАНИЦА ПЕРВАЯ: правило ловит строку, в которой НЕТ кириллицы вовсе.
 * Английское слово ВНУТРИ русской фразы («уверенность: medium») не находится,
 * и это по замыслу: термины вроде ARR и LTV/CAC законно стоят в русском
 * тексте, а правило построже дало бы поток ложных находок. Проверено
 * мутацией 04.09.2026 — она НЕ ловится, и это ожидаемо, а не дефект.
 *
 * ГРАНИЦА ВТОРАЯ: заголовки и обвязка ResultView сюда не входят, их держит
 * исходниковый сторож qventureSpeaksOneLanguage.
 */

const TERMINY = [...TERMINY_OBSHIE, "QVenture", "ARR", "LTV", "CAC", "TAM", "SOM",
  "MRR", "IRR", "MoM", "WoW", "YoY", "MOIC", "IC"];

const LINZA = {
  lens: "economist",
  role: "Экономист",
  headline: "Единичная экономика сходится на горизонте года",
  points: ["Выручка растёт", "Отток снижается"],
  risks: ["Зависимость от одного канала"],
};

const STRATEGIYA = {
  verdict: "watch" as const,
  conviction: "medium" as const,
  ticketUsd: { min: 100000, target: 250000, max: 500000 },
  valuationBandUsd: { low: 4000000, base: 6000000, high: 9000000 },
  ownershipTargetPct: 4.2,
  tranches: [{ label: "Первый транш", pct: 60, trigger: "подписан пилот" }],
  // horizonYears обязателен по типу, но ТИПЫ ЗДЕСЬ НЕ ПРОВЕРЯЮТСЯ:
  // tsconfig исключает *.test.tsx из проверки. Без поля экран печатал
  // «undefinedyr horizon», и я почти подал это как дефект продукта.
  // Пропуск в фикстуре здесь ничем не ловится, кроме глаз.
  returns: { baseMoic: 3.1, lossProbability: 0.35, expectedMoic: 2.2, targetIrrPct: 28, horizonYears: 5 },
  portfolioNote: "Держать как наблюдение до следующего раунда.",
  reasoning: ["Рынок растёт", "Команда проверена"],
};

const FAKTORY = [
  { key: "traction", label: "Показатели роста", weight: 0.28, score: 62,
    rationale: "Выручка есть, удержание не подтверждено", basis: "company-evidence" as const },
  { key: "market", label: "Рынок", weight: 0.2, score: 71,
    rationale: "Оценка по средним для отрасли", basis: "sector-prior" as const },
];

function proverit(el: React.ReactElement, chto: string) {
  const { container } = render(el);
  const v = sobratVidimyj(container);
  // Контроль охвата: пустая отрисовка прошла бы любую проверку.
  expect(v.vsyo.length, chto + ": ничего не отрисовалось").toBeGreaterThan(3);
  expect(
    angliyskieStroki(v, TERMINY),
    chto + ": английский текст в том, что покупатель получил за деньги",
  ).toEqual([]);
}

describe("разбор QVenture на русском (по отрисовке)", () => {
  test("карточка линзы совета", () => {
    proverit(<LensCard lens={LINZA} />, "линза");
  });

  test("стратегия входа", () => {
    proverit(<StrategyPanel s={STRATEGIYA} />, "стратегия");
  });

  test("разбор по факторам", () => {
    proverit(<FactorBreakdown factors={FAKTORY} />, "факторы");
  });

  test("КОНТРОЛЬ: английский в данных БЫЛ БЫ найден", () => {
    // Без этого зелёный цвет означал бы «правило ничего не ищет».
    const { container } = render(
      <LensCard lens={{ ...LINZA, headline: "Unit economics look solid" }} />,
    );
    expect(angliyskieStroki(sobratVidimyj(container), TERMINY)).toContain(
      "Unit economics look solid",
    );
  });
});

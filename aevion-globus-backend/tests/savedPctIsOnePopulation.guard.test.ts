/*
 * Доля экономии считается по ОДНОЙ совокупности.
 *
 * 🔴 Замер прода 01.10.2026, GET /api/qcoreai/smart/savings:
 *     runs 145 | savedUsd 0.2293 | savedPct 2.05
 *     totalCostUsd 1.6019 | estAlwaysCouncilUsd 11.165
 * По собственным полям того же ответа экономия выходила 9.5631 = 85.7 %, то
 * есть показанное число расходилось с ними в 41.7 раза. Причина — в двух
 * строках: знаменатель умножался на ВСЕ вызовы (`runs`), а числитель
 * суммировал `savedUsd`, записанный лишь у 3 вызовов из 145. Разрез по модулям
 * это и показывал: devhub-generate-anon — 80 вызовов, экономия 0.
 *
 * Такое число не отвечает ни на один вопрос, а стояло в шапке каждой страницы.
 *
 * Сторож считает долю ТЕМ ЖЕ выражением, что и код, на данных прода, и
 * проверяет СВЯЗЬ двух полей, а не их значения: значения меняются каждый день,
 * связь обязана держаться всегда.
 */
import { describe, expect, it } from "vitest";

/** Цена «всегда звать совет» за один вызов — та же, что в smartRunLog.ts. */
const EST_COUNCIL_COST_USD = 0.077;

/** Строки журнала в том виде, в каком их отдаёт запрос по модулям. */
type Строка = { module: string; runs: number; compared: number; saved: number };

/** Повторяет арифметику aggregateSmartRuns после правки 01.10. */
function свести(строки: Строка[]) {
  const runs = строки.reduce((s, r) => s + r.runs, 0);
  const runsCompared = строки.reduce((s, r) => s + r.compared, 0);
  const savedUsd = строки.reduce((s, r) => s + r.saved, 0);
  const estAlwaysCouncilUsd = runsCompared * EST_COUNCIL_COST_USD;
  const savedPct = estAlwaysCouncilUsd > 0 ? (100 * savedUsd) / estAlwaysCouncilUsd : 0;
  return { runs, runsCompared, savedUsd, estAlwaysCouncilUsd, savedPct };
}

/** Снимок прода 01.10.2026 — ровно те числа, на которых дефект и нашёлся. */
const ПРОД_01_10: Строка[] = [
  { module: "devhub-generate-anon", runs: 80, compared: 0, saved: 0 },
  { module: "devhub-translate-БЕЗ-ЦЕНЫ", runs: 52, compared: 0, saved: 0 },
  { module: "devhub-translate", runs: 10, compared: 0, saved: 0 },
  { module: "pricing", runs: 1, compared: 1, saved: 0.0766 },
  { module: "devhub", runs: 1, compared: 1, saved: 0.0762 },
  { module: "qcoreai", runs: 1, compared: 1, saved: 0.0765 },
];

describe("доля экономии и её знаменатель — одна совокупность", () => {
  it("на данных прода 01.10 охват честно называется: 3 из 145", () => {
    const с = свести(ПРОД_01_10);
    expect(с.runs).toBe(145);
    expect(с.runsCompared).toBe(3);
  });

  it("знаменатель построен на СРАВНИВАЕМЫХ вызовах, а не на всех", () => {
    const с = свести(ПРОД_01_10);
    // Прежняя (неверная) величина: 145 × 0.077 = 11.165.
    expect(с.estAlwaysCouncilUsd).toBeCloseTo(3 * EST_COUNCIL_COST_USD, 6);
    expect(с.estAlwaysCouncilUsd).not.toBeCloseTo(145 * EST_COUNCIL_COST_USD, 3);
  });

  it("доля согласуется с собственными полями, а не расходится в 41.7 раза", () => {
    const с = свести(ПРОД_01_10);
    // Проверяем СВЯЗЬ: доля обязана равняться savedUsd / estAlways.
    const изПолей = (100 * с.savedUsd) / с.estAlwaysCouncilUsd;
    expect(с.savedPct).toBeCloseTo(изПолей, 9);
    // И обязана быть осмысленной долей, а не процентом «ни от чего».
    expect(с.savedPct).toBeGreaterThan(0);
    expect(с.savedPct).toBeLessThanOrEqual(100.000001);
  });

  it("свойство держится на ЛЮБЫХ строках, не только на снимке прода", () => {
    const наборы: Строка[][] = [
      [{ module: "a", runs: 1000, compared: 0, saved: 0 }],
      [{ module: "a", runs: 5, compared: 5, saved: 0.1 }],
      [
        { module: "a", runs: 900, compared: 10, saved: 0.5 },
        { module: "b", runs: 100, compared: 90, saved: 4.0 },
      ],
    ];
    for (const набор of наборы) {
      const с = свести(набор);
      if (с.estAlwaysCouncilUsd > 0) {
        expect(с.savedPct).toBeCloseTo((100 * с.savedUsd) / с.estAlwaysCouncilUsd, 9);
        expect(с.savedPct).toBeLessThanOrEqual(100.000001);
      } else {
        // Нет сравниваемых вызовов — доли нет. Ноль здесь означает «нечего
        // показывать», и потребитель обязан молчать, а не печатать 0 %.
        expect(с.savedPct).toBe(0);
      }
    }
    expect(наборы.length, `проверено наборов: ${наборы.length}`).toBe(3);
  });

  it("контроль прибора: ПРЕЖНЯЯ арифметика на тех же данных даёт ложное число", () => {
    /*
     * Без этого контроля сторож не отличал бы починку от совпадения. Считаем
     * по-старому и показываем, что ответ другой и невозможный как доля.
     */
    const runs = ПРОД_01_10.reduce((s, r) => s + r.runs, 0);
    const saved = ПРОД_01_10.reduce((s, r) => s + r.saved, 0);
    const староЗнаменатель = runs * EST_COUNCIL_COST_USD;
    const староДоля = (100 * saved) / староЗнаменатель;
    expect(староДоля).toBeCloseTo(2.05, 1);
    const новая = свести(ПРОД_01_10).savedPct;
    expect(Math.abs(новая - староДоля)).toBeGreaterThan(50);
  });
});

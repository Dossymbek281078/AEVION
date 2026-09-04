import { describe, test, expect } from "vitest";
import { buildQuote, TIERS } from "../src/data/pricing";

/**
 * Сторож: у Lite один выбранный модуль ВХОДИТ в цену, а не тарифицируется сверху.
 *
 * ЗАМЕР 04.09.2026: мутация «убрать бесплатный слот модуля» НЕ ЛОВИЛАСЬ ничем.
 * Правило стоит девять долларов на каждой такой покупке — в ту или другую
 * сторону, и обе стороны плохи:
 *   • слот пропал → покупателю показывают $28 вместо $19, часть уходит;
 *   • слот раздали всем → мы отдаём модуль бесплатно там, где он платный.
 *
 * Поэтому проверка ДВУСТОРОННЯЯ: и что слот есть у Lite, и что его нет у
 * тарифа, которому он не полагается.
 *
 * Числа берутся ИЗ КАТАЛОГА, а не вписаны сюда: тогда сторож переживёт смену
 * цен и продолжит охранять ПРАВИЛО, а не конкретную сумму.
 */
const lite = TIERS.find((t) => t.id === "lite")!;
const слотов = lite.limits.modules ?? 0;

/** Первый платный модуль, который НЕ входит в Lite по умолчанию. */
function платныйМодульВнеТарифа(): string {
  const кандидаты = ["qsign", "qright", "aevion-ip-bureau", "qcoreai", "healthai"];
  for (const id of кандидаты) {
    const q1 = buildQuote({ tierId: "lite", period: "monthly", seats: 1, modules: [] });
    const q2 = buildQuote({ tierId: "lite", period: "monthly", seats: 1, modules: [id] });
    // Годится тот, чьё добавление хоть на что-то влияет при исчерпанных слотах.
    const q3 = buildQuote({
      tierId: "medium",
      period: "monthly",
      seats: 1,
      modules: [id],
    });
    const q4 = buildQuote({ tierId: "medium", period: "monthly", seats: 1, modules: [] });
    if (q1.total === q2.total && q3.total > q4.total) return id;
  }
  return "";
}

describe("бесплатный слот модуля у Lite", () => {
  test("КОНТРОЛЬ: у Lite слот действительно объявлен в каталоге", () => {
    // Если каталог изменят и слот исчезнет, сторож обязан краснеть, а не
    // молча проверять несуществующее правило.
    expect(слотов, "у Lite больше нет включённых модулей — правило изменилось").toBeGreaterThan(0);
  });

  test("первый выбранный модуль НЕ прибавляет к цене Lite", () => {
    const id = платныйМодульВнеТарифа();
    expect(id, "не нашёл платного модуля вне тарифа — проверять нечего").not.toBe("");

    const без = buildQuote({ tierId: "lite", period: "monthly", seats: 1, modules: [] });
    const с = buildQuote({ tierId: "lite", period: "monthly", seats: 1, modules: [id] });
    expect(
      с.total,
      `Lite с модулем ${id} стоит ${с.total} вместо ${без.total}: включённый слот пропал, покупателю показывают лишнее`
    ).toBe(без.total);
  });

  test("модуль СВЕРХ слота уже прибавляет к цене", () => {
    // Вторая половина: без неё «слот работает» удовлетворялось бы кодом,
    // который раздаёт модули бесплатно без счёта.
    const id = платныйМодульВнеТарифа();
    const второй = ["qright", "aevion-ip-bureau", "qcoreai", "healthai"].find((m) => m !== id)!;
    const один = buildQuote({ tierId: "lite", period: "monthly", seats: 1, modules: [id] });
    const два = buildQuote({
      tierId: "lite",
      period: "monthly",
      seats: 1,
      modules: [id, второй],
    });
    expect(
      два.total,
      `${слотов} слот(ов) у Lite, а второй модуль ничего не прибавил: мы отдаём платное бесплатно`
    ).toBeGreaterThan(один.total);
  });
});

// Витрина «Success stories» не показывает наши прогоны как настоящие наймы.
//
// Замер на проде 20.09.2026, в день запуска: GET /api/build/stats/hires?limit=20
// вернул 20 записей из 20 наших:
//   vacancyTitle "smoke welder 1785059381597"
//   projectTitle "smoke project 1785059381597"
//   recruiterName / workerName "deleted user", projectCity "astana"
// То есть страница историй успеха состояла целиком из выдуманных наймов —
// это не шум на витрине, а ложное свидетельство перед посетителем.
import { describe, test, expect } from "vitest";
import { isProbeHire } from "../page";

describe("истории успеха: проба отличается от настоящего найма", () => {
  test("записи с прода опознаются как пробы (значения настоящие, не выдуманные)", () => {
    expect(
      isProbeHire({
        vacancyTitle: "smoke welder 1785059381597",
        projectTitle: "smoke project 1785059381597",
        recruiterName: "deleted user",
        workerName: "deleted user",
      }),
    ).toBe(true);
    expect(isProbeHire({ vacancyTitle: "Probe foreman", projectTitle: null })).toBe(true);
    expect(isProbeHire({ vacancyTitle: null, projectTitle: "test project 17" })).toBe(true);
  });

  test("КОНТРОЛЬ: настоящий наём НЕ считается пробой", () => {
    expect(
      isProbeHire({
        vacancyTitle: "Сварщик 5 разряда",
        projectTitle: "ЖК «Астана Тауэрс»",
        recruiterName: "Айгуль Сериковна",
        workerName: "Ерлан Абдуллаев",
      }),
    ).toBe(false);
    // Слово внутри обычного текста не делает запись пробой.
    expect(isProbeHire({ vacancyTitle: "Smokehouse chef", projectTitle: "Ресторан" })).toBe(false);
    expect(isProbeHire({})).toBe(false);
  });
});

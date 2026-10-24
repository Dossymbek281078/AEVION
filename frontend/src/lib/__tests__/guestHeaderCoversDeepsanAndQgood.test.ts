import { describe, test, expect } from "vitest";
import { isDevhubApiUrl } from "../devhubGuest";

// 23.10.2026: deepsan (доска задач) и qgood (дневник настроения) делят
// посетителей по тому же заголовку гостя, что DevHub. Без него бэкенд видит
// «anonymous» и ничего не отдаёт — доска и дневник были бы пусты у всех.
describe("заголовок гостя уходит туда, где он нужен, и только туда", () => {
  test("deepsan и qgood — да", () => {
    expect(isDevhubApiUrl("https://api.aevion.app/api/deepsan/tasks?limit=100")).toBe(true);
    expect(isDevhubApiUrl("/api/qgood/mood?limit=7")).toBe(true);
    expect(isDevhubApiUrl("/api/qgood/mood/trends")).toBe(true);
    // 24.10.2026: и биомаркеры qlife — вес гостя видел следующий гость
    expect(isDevhubApiUrl("/api/qlife/biomarkers?limit=30")).toBe(true);
  });
  test("DevHub — по-прежнему да", () => {
    expect(isDevhubApiUrl("/api/devhub/projects")).toBe(true);
  });
  test("чужие ручки — нет (личность гостя не рассылается всем)", () => {
    expect(isDevhubApiUrl("/api/pricing/events")).toBe(false);
    expect(isDevhubApiUrl("/api/qgoodish/x")).toBe(false);
    expect(isDevhubApiUrl("https://example.com/")).toBe(false);
  });
});

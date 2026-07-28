import { describe, it, expect } from "vitest";
import { buildPuzzleQuery } from "../puzzleQuery";

/* Клиент фильтрует загруженную выборку (до 20 000 из банка на 500 000). Узкий
   фильтр её опустошает, и интерфейс говорил «Нет задач по фильтру» — утверждая
   отсутствие, которого не проверял. Этот запрос идёт в банк за настоящим ответом,
   поэтому важно, чтобы он не терял и не искажал условия. */

const q = (s: string) => Object.fromEntries(new URLSearchParams(s));

describe("запрос к банку задач", () => {
  it("всегда просит перемешать — иначе каждый раз придут те же задачи", () => {
    expect(q(buildPuzzleQuery({})).shuffle).toBe("1");
  });

  it("фильтры попадают в запрос", () => {
    const r = q(buildPuzzleQuery({ theme: "вилка", phase: "endgame", rating: [1600, 1900] }));
    expect(r.theme).toBe("вилка");
    expect(r.phase).toBe("endgame");
    expect(r.minRating).toBe("1600");
    expect(r.maxRating).toBe("1900");
  });

  it("«all» и пустая строка означают «не выбрано» и в запрос не идут", () => {
    const r = q(buildPuzzleQuery({ theme: "all", phase: "" }));
    expect(r.theme).toBeUndefined();
    expect(r.phase).toBeUndefined();
  });

  it("полный диапазон рейтинга не засоряет запрос", () => {
    const r = q(buildPuzzleQuery({ rating: [0, 4000] }));
    expect(r.minRating).toBeUndefined();
    expect(r.maxRating).toBeUndefined();
  });

  it("перепутанные границы меняются местами, а не уходят пустым ответом", () => {
    // иначе сервер вернёт пустой список и мы снова скажем «задач нет», не проверив
    const r = q(buildPuzzleQuery({ rating: [2200, 1400] }));
    expect(r.minRating).toBe("1400");
    expect(r.maxRating).toBe("2200");
  });

  it("нечисловые границы отбрасываются целиком", () => {
    const r = q(buildPuzzleQuery({ rating: [NaN, 1800] as [number, number] }));
    expect(r.minRating).toBeUndefined();
    expect(r.maxRating).toBeUndefined();
  });

  it("предел не превышает того, что примет сервер", () => {
    expect(Number(q(buildPuzzleQuery({ limit: 999_999 })).limit)).toBe(25_000);
  });

  it("бессмысленный предел заменяется разумным", () => {
    for (const bad of [0, -5, NaN]) {
      expect(Number(q(buildPuzzleQuery({ limit: bad })).limit)).toBeGreaterThan(0);
    }
  });

  it("дробный предел не уходит на сервер дробью", () => {
    expect(q(buildPuzzleQuery({ limit: 120.7 })).limit).toBe("120");
  });
});

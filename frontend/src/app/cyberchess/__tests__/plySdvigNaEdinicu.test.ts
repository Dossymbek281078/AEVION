import { describe, it, expect } from "vitest";
import { tochnostSohranennoy, hodIgroka, hodIgrokaPoPly, postGameSummary } from "../postGameSummary";
import { calibrateFromGames, type SavedGameForCPI } from "../ratingCalibration";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * В модуле ДВЕ нумерации полуходов, и они отличаются на единицу:
 *
 *   живой разбор — массив, элемент i описывает ход hist[i] → белые ЧЁТНЫЕ i
 *   сохранённая запись — поле ply = move = i + 1        → белые НЕЧЁТНЫЕ ply
 *
 * Пока обе читались одной функцией, каждый читатель сохранённых партий брал
 * ходы СОПЕРНИКА вместо своих. Ничего не падало: число на экране выглядело
 * правдоподобным, просто относилось к другому человеку.
 */

describe("нумерация в записи начинается с единицы", () => {
  it("живой разбор нумерует ходы с i + 1 — это и есть источник сдвига", () => {
    const src = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
    expect(src.length).toBeGreaterThan(100000);
    // Обе фазы разбора пишут именно так; если это изменят, тест обязан упасть,
    // потому что тогда изменится и правильная сторона чётности.
    expect(src).toContain("results.push({move:i+1,");
    expect(src).toContain("results2[i]={move:i+1,");
    // И запись в историю кладёт этот же move в поле ply.
    expect(src).toContain("ply: a.move");
  });

  it("две функции дают ПРОТИВОПОЛОЖНЫЙ ответ на одно число", () => {
    expect(hodIgroka(0, "w")).toBe(true);
    expect(hodIgrokaPoPly(0, "w")).toBe(false);
    expect(hodIgrokaPoPly(1, "w")).toBe(true);
    expect(hodIgrokaPoPly(2, "b")).toBe(true);
  });
});

describe("сохранённая партия читается за того же игрока, что и живая", () => {
  // Белые зевают каждым ходом, чёрные играют блестяще.
  const kach = Array.from({ length: 80 }, (_, i) => (i % 2 === 0 ? "blunder" : "brilliant"));

  it("карточка и запись сходятся на одном числе", () => {
    const hist = kach.map(() => "e4");
    const naZhivuyu = postGameSummary(
      hist,
      kach.map((quality, move) => ({ move, quality, cp: 0, mate: 0, cpLoss: 0 })),
      "w",
    ).tochnost;

    // В записи тот же разбор лежит с ply, начинающимся с единицы.
    const zapis = kach.map((quality, i) => ({ ply: i + 1, quality }));
    expect(tochnostSohranennoy(zapis, "w")).toBe(naZhivuyu);
    // Белые зевали КАЖДЫМ ходом — точность обязана быть нулевой.
    expect(tochnostSohranennoy(zapis, "w")).toBe(0);
    // И зеркально: чёрные играли блестяще.
    expect(tochnostSohranennoy(zapis, "b")).toBe(100);
  });

  it("оценка силы не приписывает человеку игру соперника", () => {
    const igra = {
      moves: kach.map(() => "e4"),
      result: "AI wins",
      rating: 1500,
      tc: "5+0",
      playerColor: "w",
      analysis: kach.map((quality, i) => ({ ply: i + 1, quality: quality as never, cpLoss: 0 })),
    } as unknown as SavedGameForCPI;
    const belye = calibrateFromGames([igra, igra, igra]).accuracyPct;
    const chernye = calibrateFromGames([{ ...igra, playerColor: "b" as const }, igra, igra]).accuracyPct;
    // Белые зевали всегда → пол расчёта 20. Контроль: за чёрных то же самое
    // должно дать заметно больше, иначе «низко» получается не от отбора ходов.
    expect(belye).toBeLessThanOrEqual(20);
    expect(chernye).toBeGreaterThan(belye);
  });
});

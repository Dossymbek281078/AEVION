import { describe, it, expect } from "vitest";
import { classifyDrop, TOCHNYE_HODY, NETOCHNOST } from "../moveQuality";
import { calibrateFromGames, type SavedGameForCPI } from "../ratingCalibration";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Ярлык качества хода — строка, которая ходит между четырьмя файлами и
 * localStorage. Типы её не стерегут, и 31.08.2026 нашлось, что словарей в
 * модуле было ТРИ: движок отдаёт "inacc", калибровка сравнивала с
 * "inaccuracy" и "best", а тип сохранённой партии объявлял ещё и "ok".
 *
 * Дефект был тихим и обратным по знаку: brilliant и great не попадали ни в
 * один счётчик, то есть чем лучше играл человек, тем ниже выходила оценка
 * его силы. Проявился он только сейчас — до 30.08 поле analysis не
 * сохранялось вовсе, и весь этот код не выполнялся ни разу.
 */

const YARLYKI = ["brilliant", "great", "good", "inacc", "mistake", "blunder"] as const;

describe("словарь ярлыков один на модуль", () => {
  it("classifyDrop не отдаёт ничего, кроме известных ярлыков", () => {
    // Контроль прибора: перебор обязан покрыть ВСЕ шесть, иначе проверка
    // ниже зелена просто потому, что не дошла до редких веток.
    const vydano = new Set<string>();
    for (let drop = -400; drop <= 900; drop += 5) {
      for (const prev of [-800, -300, -100, 0, 200, 600]) {
        vydano.add(classifyDrop(drop, prev, prev - drop));
      }
    }
    expect([...vydano].sort()).toEqual([...YARLYKI].sort());
  });

  it("«точные» — это brilliant, great и good", () => {
    expect([...TOCHNYE_HODY].sort()).toEqual(["brilliant", "good", "great"]);
    expect(NETOCHNOST).toBe("inacc");
  });

  it("ни один файл модуля не сравнивает с ярлыком, которого нет", () => {
    const chuzhie = ["inaccuracy", "ok", "best", "inaccurate", "excellent"];
    const fajly = ["ratingCalibration.ts", "postGameSummary.ts", "moveQuality.ts", "PostGameCard.tsx"];
    const najdeno: string[] = [];
    for (const imya of fajly) {
      const src = readFileSync(join(process.cwd(), "src/app/cyberchess", imya), "utf8");
      expect(src.length).toBeGreaterThan(200); // контроль: файл прочитан
      for (const ch of chuzhie) {
        // Сравнение с литералом, а не упоминание слова в комментарии.
        if (src.includes(`=== "${ch}"`) || src.includes(`==="${ch}"`)) najdeno.push(`${imya}: ${ch}`);
      }
    }
    expect(najdeno).toEqual([]);
  });
});

describe("оценка силы не наказывает за блестящую игру", () => {
  const partiya = (kach: string): SavedGameForCPI => ({
    moves: Array.from({ length: 40 }, () => "e4"),
    result: "You win",
    rating: 1500,
    tc: "5+0",
    playerColor: "w",
    analysis: Array.from({ length: 40 }, (_, i) => ({ ply: i + 1, quality: kach as never, cpLoss: 0 })),
  } as SavedGameForCPI);

  it("партия из блестящих ходов не хуже партии из хороших", () => {
    const bl = calibrateFromGames([partiya("brilliant"), partiya("brilliant"), partiya("brilliant")]);
    const go = calibrateFromGames([partiya("good"), partiya("good"), partiya("good")]);
    // Раньше brilliant не попадал ни в один счётчик: accuracyPct падал в 0,
    // и лучший игрок получал оценку ниже среднего.
    expect(bl.accuracyPct).toBeGreaterThanOrEqual(go.accuracyPct * 0.99);
    expect(bl.accuracyPct).toBeGreaterThan(50);
  });

  it("ходы соперника не идут в счёт человека", () => {
    // Человек зевает КАЖДЫМ своим ходом, движок каждым своим играет хорошо.
    // Если считать все полуходы подряд, точность выходит ~50% вместо 0%.
    const smeshannaya: SavedGameForCPI = {
      moves: Array.from({ length: 80 }, () => "e4"),
      result: "AI wins",
      rating: 1500,
      tc: "5+0",
      playerColor: "w",
      // ply в записи считается С ЕДИНИЦЫ: белые играют НЕЧЁТНЫЕ ply.
      analysis: Array.from({ length: 80 }, (_, i) => ({
        ply: i + 1,
        quality: (i % 2 === 0 ? "blunder" : "good") as never,
        cpLoss: i % 2 === 0 ? 400 : 0,
      })),
    } as SavedGameForCPI;
    const m = calibrateFromGames([smeshannaya, smeshannaya, smeshannaya]);
    // Все ходы ЧЕЛОВЕКА — зевки, значит точных среди них нет вовсе.
    // 20 — намеренный пол расчёта: оценка силы не падает в ноль.
    expect(m.accuracyPct).toBeLessThanOrEqual(20);
    // Контроль прибора: обратный случай той же формы обязан дать высокую
    // точность — иначе «меньше 10» получается просто оттого, что расчёт
    // по разбору не запускается.
    const zerkalo = { ...smeshannaya, playerColor: "b" as const };
    expect(calibrateFromGames([zerkalo, zerkalo, zerkalo]).accuracyPct).toBeGreaterThan(90);
  });

  it("партия из зевков заметно хуже партии из точных ходов", () => {
    const pl = calibrateFromGames([partiya("blunder"), partiya("blunder"), partiya("blunder")]);
    const go = calibrateFromGames([partiya("good"), partiya("good"), partiya("good")]);
    expect(pl.accuracyPct).toBeLessThan(go.accuracyPct);
  });
});

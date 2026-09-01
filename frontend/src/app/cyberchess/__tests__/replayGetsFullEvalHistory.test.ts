import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * График оценок для зрителя строится из analysis[], а тот считается уже
 * ПОСЛЕ конца партии. Эффект публикации на него не пересобирался — значит
 * зрителю уходила пустая история оценок, и реплей открывался без графика.
 *
 * Ставить в зависимости сам analysis нельзя: он растёт на каждый посчитанный
 * ход, и публикация превратилась бы в шквал запросов. Поэтому зависимость —
 * признак «разбор досчитан до конца», меняющийся ровно один раз.
 */
const KOD = bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("реплей получает полный график оценок", () => {
  it("признак готовности разбора существует и сравнивает с длиной партии", () => {
    expect(KOD).toMatch(/const analysisReady\s*=\s*hist\.length>0&&analysis\.length>=hist\.length/);
  });

  it("публикация пересобирается по этому признаку", () => {
    const i = KOD.indexOf("spectatorPublish||setup");
    expect(i, "эффект публикации не найден").toBeGreaterThan(-1);
    const konec = KOD.indexOf("]);", i);
    expect(KOD.slice(i, konec), "признак не в зависимостях").toContain("analysisReady");
  });

  it("сам analysis в зависимости НЕ попал — иначе шквал запросов", () => {
    const i = KOD.indexOf("spectatorPublish||setup");
    const konec = KOD.indexOf("]);", i);
    const zavisimosti = KOD.slice(KOD.lastIndexOf("},[", konec), konec);
    expect(zavisimosti).not.toMatch(/,analysis[,\]]/);
  });

  it("объявление стоит выше использования", () => {
    const obyavlenie = KOD.indexOf("const analysisReady");
    const ispolzovanie = KOD.indexOf("spectatorPublish||setup");
    expect(obyavlenie).toBeGreaterThan(-1);
    expect(obyavlenie).toBeLessThan(ispolzovanie);
  });
});

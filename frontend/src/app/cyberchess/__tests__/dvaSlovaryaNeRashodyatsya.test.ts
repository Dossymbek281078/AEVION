import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Тему задачи переводят ДВА словаря: один для задачи дня (её темы приходят с
 * бэкенда словами — «Fork», «Pin»), другой для банка в приложении (там
 * идентификаторы — «fork», «backRankMate»).
 *
 * Разные ключи, но одни ПОНЯТИЯ. Сегодня, 01.09.2026, они совпадают: пять
 * общих понятий, расхождений ноль. Но два указателя на одно расходятся молча —
 * этот класс я ловил накануне, и здесь он ждёт своего часа.
 *
 * Сторож не требует объединить словари: у них разные словари ключей, и слияние
 * было бы правкой без дефекта. Он требует одного — чтобы ОДНО ПОНЯТИЕ
 * называлось на экране одинаково, откуда бы задача ни пришла.
 */

const KATALOG = join(process.cwd(), "src/app/cyberchess");

function slovar(put: string): Map<string, string> {
  const s = readFileSync(join(KATALOG, put), "utf8");
  const m = new Map<string, string>();
  for (const x of s.matchAll(/^\s+["']?([A-Za-z][A-Za-z0-9 ]*)["']?:\s*["']([^"']+)["']/gm)) m.set(x[1], x[2]);
  return m;
}

const klyuch = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

describe("два словаря тем не расходятся", () => {
  const dnya = slovar("daily/themes.ts");
  const banka = slovar("puzzleLabels.ts");

  it("оба словаря прочитаны", () => {
    // Контроль прибора: пустая карта дала бы зелёный «расхождений нет».
    expect(dnya.size).toBeGreaterThan(15);
    expect(banka.size).toBeGreaterThan(30);
  });

  it("общие понятия названы одинаково", () => {
    const poKlyuchu = new Map([...banka].map(([k, v]) => [klyuch(k), { k, v }]));
    const obshchie: string[] = [];
    const raznye: string[] = [];
    for (const [k, v] of dnya) {
      const b = poKlyuchu.get(klyuch(k));
      if (!b) continue;
      obshchie.push(k);
      if (b.v !== v) raznye.push(`${k} → «${v}» против ${b.k} → «${b.v}»`);
    }
    // Без этой строки проверка была бы зелёной и при НУЛЕ общих понятий,
    // то есть не значила бы ничего.
    expect(obshchie.length).toBeGreaterThanOrEqual(3);
    expect(raznye).toEqual([]);
  });
});

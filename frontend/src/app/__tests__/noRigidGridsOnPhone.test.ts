import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Сторож против возврата двух конкретных дефектов вёрстки, найденных 23.08.2026:
 * страница уезжала вбок на телефоне (документ 432 и 408 при экране 375).
 *
 * Проверка НАМЕРЕННО узкая — по двум известным местам, а не «нет ли жёстких
 * сеток вообще». Широкий сканер по исходнику здесь давал бы ложные срабатывания:
 * жёсткая колонка законна там, где блок и не должен помещаться в телефон
 * (например, таблица внутри контейнера с прокруткой).
 */
const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("жёсткие колонки не вернулись", () => {
  test("калькулятор на странице цен складывается на телефоне", () => {
    const src = read("pricing/page.tsx");
    // Контроль: файл прочитан и это та самая страница.
    expect(src).toContain("calc.title");
    expect(src, 'вернулась сетка "1fr 1fr": на телефоне первая колонка распирается по содержимому и выталкивает вторую за экран')
      .not.toContain('gridTemplateColumns: "1fr 1fr",');
  });

  test("задача дня не держит жёсткую боковую колонку 360px", () => {
    const src = read("cyberchess/daily/page.tsx");
    expect(src).toContain("Right: leaderboard");
    expect(src, "вернулась колонка 360px: вместе с отступом она не помещается в экран телефона")
      .not.toContain("gridTemplateColumns: 'minmax(0, 1fr) 360px'");
    // И положительная сторона: перенос на месте, иначе колонки снова встанут в ряд.
    expect(src, "перенос колонок пропал").toContain("flexWrap: 'wrap'");
  });
});

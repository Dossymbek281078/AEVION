import { describe, test, expect } from "vitest";

import { CITY } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";
import type { CityData } from "../src/routes/qskyway.city";

/**
 * Подстановка высоты по типу застройки обещает две вещи, и обе — про
 * безопасность, а не про красоту цифр:
 *
 *   1) она НИКОГДА не опускает высоту ниже прежней. Занижение здесь дороже
 *      завышения: завышение стоит крюка, занижение означает коридор ниже крыши;
 *   2) каждое подставленное здание помечено в данных, то есть число, попавшее
 *      в поле высоты, можно отличить от измеренного.
 *
 * Проверяется по КОММИТНУТЫМ твинам, а не по синтетике: обещание даёт сборщик
 * (`scripts/fetch-city-twin.mjs`), а живут с ним эти файлы, и разойтись они
 * могут молча — при следующей пересборке с изменённым правилом.
 */
const CITIES: Record<string, CityData> = { astana: CITY, nyc: CITY_NYC, tokyo: CITY_TOKYO };

describe("подстановка высоты по типу — безопасность", () => {
  for (const [id, city] of Object.entries(CITIES)) {
    test(`[${id}] подстановка не опускает высоту и указывает на существующее здание`, () => {
      const subs = city.dataQuality.substituted ?? [];
      for (const s of subs) {
        const b = city.buildings[s.i];
        // Индекс должен указывать на здание: пересборка меняет нумерацию, и
        // список, переживший её без обновления, указывал бы в пустоту.
        expect(b, `${id}: подстановка ссылается на здание ${s.i}, которого нет`).toBeTruthy();
        // Главное утверждение: итоговая высота НЕ НИЖЕ прежней.
        expect(b.h, `${id}: здание ${s.i} опущено с ${s.from} до ${b.h} м`).toBeGreaterThanOrEqual(s.from);
        // Выборка, по которой взят процентиль, должна быть названа: без неё
        // число выглядит замером этого дома.
        expect(s.n, `${id}: у подстановки здания ${s.i} не указан размер выборки`).toBeGreaterThan(0);
        expect(s.type.length).toBeGreaterThan(0);
      }
    });

    test(`[${id}] класс высоты у подставленных зданий остаётся «угадано»`, () => {
      // hs: 0 обмерено, 1 выведено из этажности, 2 угадано. Подстановка НЕ
      // повышает класс: страховка по высоте (+16 м у `guessed`) должна
      // остаться, иначе мы бы подняли доверие к числу, которое сами и придумали.
      for (const s of city.dataQuality.substituted ?? []) {
        expect(city.buildings[s.i].hs, `${id}: здание ${s.i} сменило класс высоты`).toBe(2);
      }
    });
  }

  test("хотя бы один город реально несёт подстановки — иначе проверка выше пуста", () => {
    // Без этого все тесты выше зелены на пустых списках, и «проверено» значит
    // «нечего было проверять».
    const total = Object.values(CITIES).reduce((n, c) => n + (c.dataQuality.substituted?.length ?? 0), 0);
    expect(total).toBeGreaterThan(0);
  });
});

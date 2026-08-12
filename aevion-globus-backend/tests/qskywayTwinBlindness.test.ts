import { describe, test, expect } from "vitest";

import { CITY } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";
import type { CityData } from "../src/routes/qskyway.city";

/**
 * Сколько высот в твине ВЫДУМАНО — величина, которую легко ухудшить молча.
 *
 * Твин пересобирается скриптом из Overpass, и ответ Overpass меняется от
 * прогона к прогону: он умеет отдать HTTP 200 с УРЕЗАННЫМ списком элементов,
 * сообщив об этом только в `remark` (так в июле в твин Нью-Йорка не попал
 * вокзал Пенн). Урезанный ответ означает больше зданий без тегов, то есть
 * больше слепых 12-метровых высот — и никакого признака беды в самих данных.
 *
 * Поэтому доля угаданных высот здесь прибита. Тест не запрещает пересборку:
 * он требует, чтобы ухудшение профиля данных ЗАМЕТИЛИ и обновили числа руками,
 * а не узнали о нём через полгода. Замер 12.08.2026 —
 * `npm run audit:guessed-heights <город>` печатает эти же цифры.
 */

const PROFILE: Record<string, { twin: CityData; total: number; measured: number; guessed: number }> = {
  // Астана: городского обмера нет вовсе, тег несущий — тут слепота дороже всего
  astana: { twin: CITY, total: 475, measured: 0, guessed: 237 },
  // Нью-Йорк и Токио: высоты перекрыты городским обмером
  nyc: { twin: CITY_NYC, total: 2976, measured: 2879, guessed: 28 },
  tokyo: { twin: CITY_TOKYO, total: 3781, measured: 3504, guessed: 116 },
};

describe("профиль слепых высот в твинах", () => {
  for (const [city, p] of Object.entries(PROFILE)) {
    test(`[${city}] доля угаданных высот не выросла молча`, () => {
      const dq = p.twin.dataQuality;
      expect(dq.total).toBe(p.total);
      expect(dq.measured).toBe(p.measured);
      // Главное утверждение: слепых высот не стало БОЛЬШЕ. Меньше — можно и
      // нужно, тогда число здесь обновляется вместе с твином.
      expect(dq.guessed).toBeLessThanOrEqual(p.guessed);
    });
  }

  test("[astana] обмера нет ни у одного здания — это свойство города, а не сбой сборки", () => {
    // Если однажды у Астаны появится городской обмер, тест упадёт, и это
    // правильный повод пересмотреть и класс высот, и текст на странице.
    expect(CITY.dataQuality.measured).toBe(0);
    expect(CITY.dataQuality.measuredPct).toBe(0);
  });
});

import { describe, it, expect } from "vitest";

/**
 * Карточки предпросмотра ОТРИСОВЫВАЮТСЯ, а не только компилируются.
 *
 * `tsc` проверяет типы и молчит про раскладку, а у next/og она своя и строгая:
 * блок с несколькими детьми обязан объявить `display: flex`, иначе движок
 * бросает при отрисовке. Тогда адрес картинки отвечает ошибкой, и ссылка уходит
 * в мессенджер БЕЗ превью — то есть хуже, чем со старой картинкой.
 *
 * ⚠️ ГРАНИЦА, названная честно. В окружении набора шаг «SVG → PNG» недоступен:
 * движок раскладки отрабатывает, а преобразователь бросает
 * «Unsupported input '<svg width=…'». Поэтому проверка утверждает ровно то, что
 * может: раскладка ПРОШЛА и до преобразования дело дошло. Ошибка раскладки
 * выглядит иначе (например «Expected <div> to have explicit display») и здесь
 * упадёт.
 *
 * Контроль от ложного зелёного: в списке есть qskyway — его карточка живёт на
 * проде и отдаёт настоящий PNG. Если он ведёт себя как остальные, значит
 * различие в окружении, а не в наших файлах.
 */
const MODULI = ["qright", "bureau", "devhub", "qskyway"] as const;

/** Признак того, что раскладка отработала и упёрлась в недоступное преобразование. */
const PREOBRAZOVANIE_NEDOSTUPNO = "Unsupported input";

describe("карточки предпросмотра проходят раскладку", () => {
  for (const m of MODULI) {
    it(m + ": раскладка без ошибок", async () => {
      const mod = await import("../" + m + "/opengraph-image");
      const res = (mod.default as () => Response)();
      let oshibka = "";
      try {
        await res.arrayBuffer();
      } catch (e) {
        oshibka = String((e as Error)?.message ?? e);
      }
      if (!oshibka) return; // окружение умеет PNG — тем лучше
      expect(
        oshibka.includes(PREOBRAZOVANIE_NEDOSTUPNO),
        m + ": раскладка не прошла, движок сказал: " + oshibka.slice(0, 160),
      ).toBe(true);
    }, 30000);
  }
});

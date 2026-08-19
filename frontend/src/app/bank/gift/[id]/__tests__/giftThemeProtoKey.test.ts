/**
 * Тема подарочной карточки приходит из ?p= в адресе, то есть снаружи.
 *
 * Было: `decoded.themeId in THEME_GRADIENT`. Оператор `in` идёт по цепочке
 * прототипов, поэтому "constructor" проходил проверку, и в gradient попадала
 * функция-конструктор вместо строки градиента — превью подарочной ссылки
 * отрисовывалось неправильно. Денег и данных не затрагивает, но адрес
 * публичный: превью видит каждый, кому ссылку переслали.
 */
import { describe, expect, it } from "vitest";

import { resolveThemeId } from "../opengraph-image";

describe("resolveThemeId — тема из адреса подарочной ссылки", () => {
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "prototype"])(
    "ключ прототипа %s откатывается на general",
    (key) => {
      expect(resolveThemeId(key)).toBe("general");
    },
  );

  it.each(["", undefined, "nesushestvuyushaya"])("неизвестное значение %s даёт general", (raw) => {
    expect(resolveThemeId(raw as string | undefined)).toBe("general");
  });

  // Обратная проверка: без неё зелёным было бы и `return "general"` всегда.
  it.each(["birthday", "thanks", "wedding", "congrats", "royalty", "general"])(
    "настоящая тема %s сохраняется",
    (key) => {
      expect(resolveThemeId(key)).toBe(key);
    },
  );
});

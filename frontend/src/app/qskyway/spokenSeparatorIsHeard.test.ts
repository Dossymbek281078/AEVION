import { describe, test, expect } from "vitest";
import { allTranslations } from "../__tests__/localeSource";

/**
 * Разделитель, который не слышен, склеивает числа с соседними словами.
 *
 * НАШЛОСЬ ТАК. Соседнее окно обнаружило у себя строку «Шагов: 4 подтверждено: 3»
 * — вслух это «шагов четыре подтверждено», и смысл переворачивается. Проверил
 * своё тем же способом: прочитал строки так, как их произнесёт экранный диктор,
 * а не так, как они написаны в коде.
 *
 * У нас разделителем служила средняя точка. Она НЕ является надёжной паузой:
 * читалки либо пропускают её молча, либо называют знак. «радиус 30м просвет 15м
 * до запретной зоны 200м» — три числа подряд без пауз.
 *
 * ПОЧЕМУ ПРАВИЛО, А НЕ СПИСОК КЛЮЧЕЙ. Список устареет с первой новой строкой, и
 * зелёный цвет будет означать «те четыре, что я знал, в порядке». Правило
 * выводится из формы: точка между двумя подстановками — это всегда два значения
 * подряд без слышимой границы.
 *
 * ЧЕГО ПРАВИЛО НЕ ЛОВИТ, честно: точку между словами (там пауза не нужна) и
 * другие неслышные разделители, если их заведут. Класс не ловится ни мутацией,
 * ни сравнением текста — только чтением вслух.
 */

const DOT = " " + String.fromCharCode(183) + " ";

function dotBetweenPlaceholders(v: string): boolean {
  let i = v.indexOf(DOT);
  while (i !== -1) {
    const before = v.slice(0, i);
    const after = v.slice(i + DOT.length);
    if (before.includes("{") && after.includes("{")) return true;
    i = v.indexOf(DOT, i + 1);
  }
  return false;
}

describe("числа в строках модуля не склеиваются при чтении вслух", () => {
  test("прибор умеет находить: подсаженная строка ловится", () => {
    // Без положительного контроля ноль неотличим от «не умею искать».
    expect(dotBetweenPlaceholders("радиус {r}м" + DOT + "просвет {c}м")).toBe(true);
    // И отрицательный: точка между словами паузы не требует.
    expect(dotBetweenPlaceholders("Ed25519" + DOT + "подпись двойника")).toBe(false);
    expect(dotBetweenPlaceholders("выше потолка на {m} м, участков {n}")).toBe(false);
  });

  test("ни в одном языке нет точки между двумя подстановками", () => {
    const table = allTranslations();
    const langs = Object.keys(table);
    expect(langs.length, "языков не найдено — сторож ослеп").toBeGreaterThanOrEqual(2);

    let checked = 0;
    const bad: string[] = [];
    for (const lang of langs) {
      for (const [key, value] of Object.entries(table[lang] ?? {})) {
        if (!key.startsWith("qskyway.")) continue;
        checked += 1;
        if (typeof value === "string" && dotBetweenPlaceholders(value)) {
          bad.push(lang + ": " + key);
        }
      }
    }
    expect(checked, "ни одной строки модуля не проверено — сторож ослеп").toBeGreaterThan(50);
    expect(bad, "числа склеятся при чтении вслух: " + bad.join(", ")).toEqual([]);
  });
});

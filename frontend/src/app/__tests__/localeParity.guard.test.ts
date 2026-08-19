import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { allTranslations, allLangs, FALLBACK_LANG } from "./localeSource";

/**
 * Ключ, которого нет в английском словаре, показывает пользователю СВОЁ ИМЯ.
 *
 * Откат в `t()` устроен так: `tbl[lang]?.[key] || tbl["en"]?.[key] || key`.
 * Английский — последний рубеж перед голым именем ключа. Поэтому «есть в
 * русском, нет в английском» — не косметика, а текст вида
 * `challenge.subtitle2` на экране, и ничего при этом не падает.
 *
 * Обратное направление дефектом НЕ является и здесь не проверяется: восемь
 * языков из одиннадцати содержат по 40 ключей осознанно (витринный минимум),
 * всё остальное честно откатывается на английский. Замер 16.08.2026:
 * ru/en/kk — по ~3900 ключей, остальные — по 40.
 *
 * ПОЧЕМУ ПРОВЕРКА СПРАШИВАЕТ МОДУЛЬ, А НЕ ЧИТАЕТ ФАЙЛ. Разбор `i18n-data.ts`
 * регуляркой дал три разных НЕВЕРНЫХ ответа подряд: границы блоков по отступу
 * не совпадают с границами локалей (в файле несколько словарей разной формы),
 * часть пар упакована по многу в строку, а часть значений записана как
 * `\uXXXX` — и сравнение исходного текста объявляло одинаковые строки разными.
 * Импорт снимает все три ловушки сразу.
 */
describe("паритет локалей: английский как последний рубеж", () => {
  const tbl = allTranslations();

  it("английский словарь непустой", () => {
    // Без этого «сирот нет» верно и при развалившемся импорте.
    expect(Object.keys(tbl[FALLBACK_LANG] ?? {}).length).toBeGreaterThan(1000);
  });

  it("ни в одном языке нет ключа, которого нет в английском", () => {
    const en = new Set(Object.keys(tbl[FALLBACK_LANG] ?? {}));
    const orphans = allLangs().flatMap((l) =>
      Object.keys(tbl[l] ?? {})
        .filter((k) => !en.has(k))
        .map((k) => `${l}: ${k}`),
    );
    expect(
      orphans,
      "ключ без английской версии покажет пользователю своё имя — заведите строку в en",
    ).toEqual([]);
  });

  it("словари читаются из ОДНОГО места — иначе перестройку придётся вспоминать трижды", () => {
    // Правило «единственная точка» без проверки живёт до первого нового теста.
    // Проверено на себе: зная о перестройке, я сам завёл вторую копию импорта,
    // а третья уже лежала в тестах компонентов.
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        if (e === "node_modules" || e === ".next") return [];
        const full = join(dir, e);
        return statSync(full).isDirectory() ? walk(full) : /\.test\.tsx?$/.test(e) ? [full] : [];
      });
    const tests = walk(SRC);
    expect(tests.length, "тестовых файлов не найдено — обход сломан").toBeGreaterThan(30);

    const direct = tests
      .filter((f) => /from ["'][^"']*lib\/i18n-data["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f).split("\\").join("/"));
    expect(
      direct,
      "берите словари через app/__tests__/localeSource — там одна точка правки на всю перестройку",
    ).toEqual([]);
  });

  it("английское значение нигде не равно русскому (копипаста при заводе ключа)", () => {
    // Класс, который все прочие проверки пропускают: ключ есть во всех
    // локалях, подстановки совпадают, сторожа зелёные — а англоязычный
    // читатель видит кириллицу, потому что значение просто скопировали.
    //
    // Условие «содержит кириллицу» обязательно: латиница, числа и символы
    // законно совпадают между локалями («METAR», «QRight», «×2», «—»), и без
    // этого условия сторож краснел бы на правильном.
    //
    // Замер 19.08.2026 по всему словарю: 0 из 7315. Проверка заведена, чтобы
    // так и осталось, и стоит она один проход по объекту.
    const tbl = allTranslations();
    const ru = tbl.ru ?? {};
    const en = tbl[FALLBACK_LANG] ?? {};
    const same = Object.keys(ru).filter((k) => {
      const a = ru[k];
      const b = en[k];
      return a != null && b != null && a === b && /[А-Яа-яЁё]/.test(a);
    });
    expect(
      same.slice(0, 10),
      "английское значение совпало с русским — похоже, ключ скопировали, а не перевели",
    ).toEqual([]);
  });

  it("проверка ловит сироту (отрицательный контроль)", () => {
    const en = new Set(["a.b"]);
    const fake = { xx: { "a.b": "…", "a.orphan": "…" } } as Record<string, Record<string, string>>;
    const found = Object.keys(fake.xx).filter((k) => !en.has(k));
    expect(found).toEqual(["a.orphan"]);
  });
});

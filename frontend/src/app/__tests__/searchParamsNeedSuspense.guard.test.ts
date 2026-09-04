import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `useSearchParams()` на СТАТИЧЕСКОЙ странице обязан стоять под <Suspense>.
 *
 * ЗАЧЕМ. Хук отключает статическую генерацию, и Next требует объявить это
 * явно. Дефект не ловится ничем из того, что мы гоняем часто: в режиме
 * разработки правило НЕ применяется — страница открывается и работает, —
 * а `tsc` про сборку Next не знает вовсе. Краснеет только боевая сборка,
 * то есть за пять минут и в самый неудобный момент.
 *
 * ЗАМЕР 04.09.2026, из-за которого сторож и написан. Я завёл страницу
 * `/chain` и трижды проверил её: типы 0 ошибок, целевые прогоны 13/13,
 * страница живая в браузере. Боевая сборка упала:
 *
 *     useSearchParams() should be wrapped in a suspense boundary
 *     at page "/chain"                                   код 1
 *
 * Нашло соседнее окно, собрав мою страницу у себя. Своими приборами я бы
 * её не увидел до выкатки.
 *
 * ГРАНИЦА, и она здесь главная. Правило действует только для страниц,
 * которые Next генерирует статически. У ДИНАМИЧЕСКИХ адресов (`[id]`,
 * `[token]`) генерации нет, и требовать от них границу — ложная тревога.
 * Замер: страниц с `useSearchParams` сорок, без `Suspense` из них десять,
 * и ВСЕ ДЕСЯТЬ динамические. Сторож, не различающий эти два случая, дал
 * бы десять красных на исправном коде и был бы отключён в первый же день.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

type Stranica = { put: string; sSuspense: boolean; dinamicheskaya: boolean };

function obojti(): Stranica[] {
  const out: Stranica[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === "__tests__" || e === "node_modules") continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        walk(p);
      } else if (e === "page.tsx" || e === "layout.tsx") {
        // Комментарии вырезаем ДО поиска. Первая редакция этого не делала
        // и объявила нарушителями две страницы, которые про useSearchParams
        // только рассказывают: и /pricing, и /constitution/pricing несут
        // комментарий «признак берём иначе, чтобы не оборачиваться». То есть
        // сторож краснел ровно на том коде, который поступил правильно.
        const src = readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/\/\/.*/g, " ");
        if (!src.includes("useSearchParams")) continue;
        const otn = relative(APP, p).split("\\").join("/");
        out.push({
          put: otn,
          // Ищем ОТКРЫВАЮЩИЙ тег, а не слово. Первая редакция брала
          // `includes("Suspense")` и мутацию НЕ поймала: убери границу —
          // в файле останутся импорт, закрывающий тег и это самое
          // объяснение, и проверка пройдёт на сломанном коде.
          sSuspense: src.includes("<Suspense"),
          // Скобка в ЛЮБОМ сегменте пути делает адрес динамическим.
          dinamicheskaya: otn.includes("["),
        });
      }
    }
  };
  walk(APP);
  return out;
}

describe("useSearchParams под границей ожидания", () => {
  it("прибор исправен: обход находит страницы с этим хуком", () => {
    // Без этого поломка обхода делает сторожа вечнозелёным: «нарушений
    // нет» на пустом множестве неотличимо от «нарушений нет» на полном.
    // Порог с запасом вниз: страниц было 40, падение вдвое — уже повод
    // посмотреть, а не молча зеленеть.
    const vse = obojti();
    expect(vse.length, "страниц с useSearchParams не найдено — сломан обход").toBeGreaterThan(20);
    // И контроль на ВТОРУЮ ось: обход обязан видеть обе разновидности.
    // Если он перестанет различать динамические, правило ниже отсеет всё.
    expect(
      vse.some((s) => s.dinamicheskaya),
      "динамических адресов не видно — разделение перестало работать",
    ).toBe(true);
    expect(
      vse.some((s) => !s.dinamicheskaya),
      "статических адресов не видно — проверять станет нечего",
    ).toBe(true);
  });

  it("ни одна статическая страница не зовёт хук без Suspense", () => {
    const narusheniya = obojti()
      .filter((s) => !s.dinamicheskaya && !s.sSuspense)
      .map((s) => s.put);
    expect(
      narusheniya,
      "боевая сборка упадёт на этих страницах: useSearchParams без границы ожидания",
    ).toEqual([]);
  });
});

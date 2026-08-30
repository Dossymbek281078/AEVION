import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Каждый товар каталога должен попасть в один из списков витрины.
 *
 * Витрина `/shop` рисует ТРИ списка — SUBSCRIPTIONS, GUIDES, MODULES — а не
 * перебирает каталог целиком. Пока они покрывают его без остатка, всё сходится:
 * замер 29.08.2026 — 3 + 6 + 7 = 16, и все 16 идентификаторов касс нашлись на
 * живой странице.
 *
 * Но товар, заведённый в каталоге и не попавший ни в один список, исчезнет с
 * витрины МОЛЧА: он есть, у него цена и касса, а купить его негде. Проверить
 * это глазами нельзя — списки лежат в разных местах файла.
 *
 * Сторож НЕ ходит в сеть: он сверяет каталог сам с собой. Живость ссылок и их
 * присутствие на отрисованной странице — отдельная ручная проверка.
 */

const NL = String.fromCharCode(10);
const CATALOG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "lib", "products.ts");

function source(): string {
  return readFileSync(CATALOG, "utf8")
    .split(NL)
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join(NL);
}

/** Идентификаторы внутри одного экспортируемого списка. */
function idsOf(src: string, name: string): string[] {
  const i = src.indexOf("export const " + name);
  if (i < 0) return [];
  const j = src.indexOf("];", i);
  const body = src.slice(i, j < 0 ? src.length : j);
  return [...body.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/**
 * Имена списков, из которых собран каталог — прочитанные из самого каталога.
 *
 * Раньше три имени были зашиты здесь. Это давало ЛОЖНУЮ КРАСНОТУ на честном
 * изменении: заведи кто-нибудь четвёртую группу и добавь её в ALL_PRODUCTS —
 * её товары попали бы в «есть в каталоге», но не в «показаны на витрине», и
 * сторож обвинил бы правильную работу. Аудит, который краснеет на исправном
 * коде, перестают читать быстрее, чем чинят.
 *
 * Читая группы из ALL_PRODUCTS, закрываем оба направления сразу: новая группа
 * ВНУТРИ него засчитывается молча, новая группа СНАРУЖИ — настоящий дефект,
 * товар есть, а на витрину не попадает — по-прежнему краснеет.
 */
function storefrontGroups(src: string): string[] {
  const at = src.indexOf("ALL_PRODUCTS");
  if (at < 0) return [];
  const end = src.indexOf(";", at);
  const decl = src.slice(at, end < 0 ? src.length : end);
  return [...decl.matchAll(/\.\.\.([A-Z_][A-Z0-9_]*)/g)].map((m) => m[1]);
}

describe("каждый товар каталога есть на витрине", () => {
  const src = source();
  const all = [...src.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const groups = storefrontGroups(src);
  const shown = new Set(groups.flatMap((g) => idsOf(src, g)));

  // Контроль охвата: без него сломанный разбор дал бы пустые множества, и
  // сторож ответил бы «нарушений нет», не посмотрев ни на один товар.
  it("контроль прибора: каталог и списки разобраны", () => {
    expect(all.length, "каталог не разобран").toBeGreaterThanOrEqual(10);
    expect(shown.size, "списки витрины не разобраны").toBeGreaterThanOrEqual(10);
  });

  it("контроль охвата ПОИМЁННО: группы каталога прочитаны", () => {
    // Числа тут не годятся: если разбор потеряет одну группу и подберёт другую,
    // размер совпадёт, а состав — нет. Отвечать надо на вопрос, ЧЬИ товары
    // считаются показанными.
    expect(groups.length, `группы: ${groups.join(", ")}`).toBeGreaterThanOrEqual(3);
    for (const known of ["SUBSCRIPTIONS", "GUIDES", "MODULES"]) {
      expect(groups, `группа выпала из разбора: ${known}`).toContain(known);
    }
    // И каждая названная группа обязана дать хотя бы один товар: имя, по
    // которому ничего не нашлось, — это молчаливая потеря целой группы.
    const empty = groups.filter((g) => idsOf(src, g).length === 0);
    expect(empty, `группа названа, но товаров в ней не найдено: ${empty.join(", ")}`).toEqual([]);
  });

  it("ни один товар не остался вне списков витрины", () => {
    const orphans = all.filter((id) => !shown.has(id));
    expect(
      orphans,
      `товар есть в каталоге, но ни в одном списке витрины — купить его негде: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});

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

describe("каждый товар каталога есть на витрине", () => {
  const src = source();
  const all = [...src.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const shown = new Set([
    ...idsOf(src, "SUBSCRIPTIONS"),
    ...idsOf(src, "GUIDES"),
    ...idsOf(src, "MODULES"),
  ]);

  // Контроль охвата: без него сломанный разбор дал бы пустые множества, и
  // сторож ответил бы «нарушений нет», не посмотрев ни на один товар.
  it("контроль прибора: каталог и списки разобраны", () => {
    expect(all.length, "каталог не разобран").toBeGreaterThanOrEqual(10);
    expect(shown.size, "списки витрины не разобраны").toBeGreaterThanOrEqual(10);
  });

  it("ни один товар не остался вне списков витрины", () => {
    const orphans = all.filter((id) => !shown.has(id));
    expect(
      orphans,
      `товар есть в каталоге, но ни в одном списке витрины — купить его негде: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});

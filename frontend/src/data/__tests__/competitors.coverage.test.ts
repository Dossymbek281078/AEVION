import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { COMPARISONS, NOT_COMPARED_NOTE } from "../competitors";

/**
 * Новый модуль в реестре не должен молча выпадать из сравнения.
 *
 * Так уже произошло: Ventures появился в каталоге, сравнения для него не было,
 * и в оговорке «чего здесь нет» он тоже не упоминался. Снаружи это выглядит
 * как полный обзор платформы, из которого без объяснений пропал модуль, — а
 * поймал я это только сверкой руками.
 *
 * Правило: каждый модуль реестра либо сравнён, либо назван в NOT_COMPARED_NOTE
 * с причиной. Третьего состояния «просто забыли» быть не должно.
 *
 * Реестр читается как текст, а не импортируется: он лежит в соседнем пакете
 * (backend), и тянуть его сборку в тесты фронтенда ради списка id — дороже,
 * чем разобрать регуляркой.
 */

const REGISTRY = resolve(__dirname, "../../../../aevion-globus-backend/src/data/projects.ts");

describe("сравнением покрыт весь реестр модулей", () => {
  it("реестр на месте — иначе проверка ничего не проверяет", () => {
    // Без этой строки исчезнувший файл дал бы пустой список id и зелёный тест
    // на пустом месте — самый неприятный вид ложного «всё хорошо».
    expect(existsSync(REGISTRY), `Не найден реестр модулей: ${REGISTRY}`).toBe(true);
  });

  it("каждый модуль реестра либо сравнён, либо назван в оговорке", () => {
    const src = readFileSync(REGISTRY, "utf8");
    const registryIds = [...src.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(registryIds.length, "Из реестра не извлеклось ни одного id").toBeGreaterThan(10);

    const compared = new Set(COMPARISONS.map((c) => c.id));
    const note = NOT_COMPARED_NOTE.toLowerCase();

    const silent = registryIds.filter((id) => {
      if (compared.has(id)) return false;
      // В оговорке модули названы человеческими именами («Voice of the Earth»,
      // «QPayNet Embedded»), а не id — сравниваем по словам id.
      const words = id.split("-").filter((w) => w.length > 2);
      return !words.every((w) => note.includes(w));
    });

    expect(
      silent,
      "Модуль есть в реестре, но ни сравнения, ни причины пропуска:\n" + silent.join(", "),
    ).toEqual([]);
  });
});

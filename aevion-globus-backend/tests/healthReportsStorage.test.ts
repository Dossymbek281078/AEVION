import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Ручка здоровья модуля обязана называть, где он сейчас хранит данные.
 *
 * Замер 19.08.2026: сторож запасного хранилища опрашивает 12 модулей и видел
 * ДЕВЯТЬ. Три (qgood, qnews, qchaingov) поле не публиковали, и их молчание
 * попадало в строку «без поля 3» — то есть выглядело как свойство модулей, а не
 * как слепота наблюдателя.
 *
 * Опасность в том, КАК это читается: строка «на памяти 0» считается только по
 * видимым. Чем больше молчащих, тем спокойнее выглядит сводка.
 *
 * Модули, у которых есть запасное хранилище в памяти, — обязаны отвечать.
 */

const ROOT = join(__dirname, "..", "src", "routes");

/** Модули со сторожем: те, чьё состояние опрашивает aevion-fallback-watch. */
const WATCHED = [
  "lifebox", "psyappDeps", "qgood", "qlife", "qnews", "qpersona",
  "deepsan", "mapReality", "qchaingov", "shadownet", "qevents", "qsocial",
];

function fileFor(id: string): string | null {
  const files = readdirSync(ROOT);
  const exact = files.find((f) => f.toLowerCase() === `${id.toLowerCase()}.ts`);
  return exact ? join(ROOT, exact) : null;
}

describe("ручка здоровья называет хранилище", () => {
  test("контроль: файлы модулей находятся", () => {
    // Иначе цикл ниже прошёл бы по пустому списку и был бы зелёным всегда.
    const found = WATCHED.map(fileFor).filter(Boolean);
    expect(found.length, "файлы маршрутов не нашлись — проверка вхолостую").toBe(WATCHED.length);
  });

  for (const id of WATCHED) {
    test(`${id}: /health публикует состояние базы`, () => {
      const f = fileFor(id);
      expect(f, `нет файла для ${id}`).not.toBeNull();
      const src = readFileSync(f!, "utf8");
      const hasField = /\bdb:\s*(is\w+DbReady\(\)|db\b|_dbReady)|\bdbReady:\s*/.test(src)
        || /db,\s*timestamp/.test(src)
        || /"db":\s*/.test(src);
      expect(
        hasField,
        `${id} не публикует состояние базы — сторож запасного хранилища его не увидит, ` +
          `а «на памяти 0» посчитается без него`,
      ).toBe(true);
    });
  }
});

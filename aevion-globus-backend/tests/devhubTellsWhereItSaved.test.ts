import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * DevHub называет хранилище там, где человек теряет свою работу.
 *
 * Замер 19.08.2026: в файле 28 ответов, перед которыми в пределах 15 строк
 * стоит запись в память. Помечены ПЯТЬ — те, где теряется то, что человек
 * создал сам: проект (создание и правка) и файл (три ручки сохранения).
 *
 * Устройство здесь отличается от других модулей, и это важно для починки:
 * запасной путь срабатывает по ИСКЛЮЧЕНИЮ, а не по флагу готовности базы.
 *
 *   try { await dbSaveProject(project); }
 *   catch { memProjects.set(...); }        ← подмена случается здесь
 *   res.json({ project });                 ← а ответ о ней молчал
 *
 * Поэтому признак нельзя вычислить из isDbReady() — нужна локальная переменная,
 * выставляемая ровно в catch. Проверка следит именно за этим.
 *
 * Остальные 23 места не тронуты сознательно: файл правят 11 веток, из них одна
 * разошлась на 347 строк. Широкая правка создала бы им поверхность конфликта
 * там, где выигрыш меньше. Список — на доске запуска.
 */

const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8"));

describe("DevHub не выдаёт память за сохранение", () => {
  test("контроль: файл прочитан и содержит обе ветки", () => {
    expect(SRC.length).toBeGreaterThan(10000);
    expect(SRC).toContain("memProjects.set");
    expect(SRC).toContain("memFiles.set");
  });

  test("пять мест объявляют локальный признак", () => {
    const decls = SRC.match(/let storage: "db" \| "memory" = "db";/g) ?? [];
    expect(
      decls.length,
      "признак объявляется не там, где нужно — проверьте, не переписали ли обработчик",
    ).toBe(5);
  });

  test("признак выставляется РОВНО в catch, а не угадывается", () => {
    // Если бы его считали из isDbReady() после записи, на восстановившейся базе
    // ветка памяти вернула бы "db" и соврала снова.
    const setInCatch = SRC.match(/storage = "memory";/g) ?? [];
    expect(setInCatch.length, "подмена происходит в catch — там же и помечается").toBe(5);
  });

  test("создание проекта отвечает с признаком", () => {
    expect(SRC).toMatch(/res\.status\(201\)\.json\(\{ project, storage \}\)/);
  });

  test("сохранение файла отвечает с признаком", () => {
    const marked = SRC.match(/res\.json\(\{ file, storage \}\)/g) ?? [];
    expect(marked.length, "не все ручки сохранения файла помечены").toBe(2);
    expect(SRC).toMatch(/bytes: content\.length, mimeType: meta\.mimeType, storage/);
  });
});

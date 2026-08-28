import { describe, test, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

import { readBuildInfo } from "../src/lib/buildInfo";

/**
 * Отметка сборки должна находиться независимо от того, где лежит её читатель.
 *
 * Что случилось 28.08.2026. Читатель жил в `index.ts` и искал файл на один
 * уровень вверх: из `dist/index.js` это корень бэкенда, где скрипт выкатки его
 * и создаёт. Я вынес читатель в `lib/buildInfo.ts` — и тот же самый шаг вверх
 * стал вести из `dist/lib/` в `dist/`, где отметки нет.
 *
 * Один уровень разницы, и прод начал отвечать `commit: "unknown"`,
 * `branch: "unknown"` — то есть перестал отвечать на вопрос «какой код сейчас
 * работает». Обнаружилось это только на живой выкатке.
 *
 * Молчал он законно: «файла нет» здесь нормальная ситуация (локальный запуск),
 * и на этот случай в функции есть запасной путь. Именно поэтому ни типы, ни
 * тесты ничего не заметили — ошибка ушла в ветку, которая специально ЧИНИЛА
 * отметку у QReal.
 *
 * Проверка ловит ровно это: файл кладётся туда, куда его кладёт скрипт выкатки
 * (корень бэкенда), а читателя зовут из его настоящего места. При поиске на
 * ОДНОМ уровне тест краснеет — проверено мутацией.
 */

const STAMP = path.join(__dirname, "..", "build-info.json");
let created = false;

afterEach(() => {
  // Файл живёт секунды: он не в игноре намеренно, и забытый экземпляр уехал бы
  // в чужой коммит и врал бы чужим коммитом — ровно то, от чего скрипт выкатки
  // защищается своим trap.
  if (created && existsSync(STAMP)) unlinkSync(STAMP);
  created = false;
});

describe("отметка сборки находится с любой глубины", () => {
  test("читатель из lib/ находит файл, созданный скриптом выкатки", () => {
    writeFileSync(
      STAMP,
      JSON.stringify({
        commit: "deadbeefcafe0001",
        branch: "test/stamp-depth",
        source: "railway-deploy.sh",
        builtAt: "2026-08-28T09:00:00Z",
      }),
      "utf-8",
    );
    created = true;

    const info = readBuildInfo();
    expect(info.commit, "отметка не найдена — читатель ищет не там").toBe("deadbeefcafe");
    expect(info.branch).toBe("test/stamp-depth");
    expect(info.source).toBe("railway-deploy.sh");
  });

  test("без файла — честное «не знаю», а не выдумка", () => {
    // Контроль: если бы функция возвращала что-то бодрое при отсутствии
    // отметки, первый тест проходил бы и на сломанном поиске.
    if (existsSync(STAMP)) unlinkSync(STAMP);
    const info = readBuildInfo();
    expect(
      ["unknown", ""].includes(info.commit) || info.source !== "railway-deploy.sh",
      "без файла функция назвала конкретный коммит — значит выдумала его",
    ).toBe(true);
  });
});

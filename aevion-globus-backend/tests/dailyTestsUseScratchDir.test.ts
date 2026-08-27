/**
 * Сторож: тест задачи дня не пишет в отслеживаемую таблицу лидеров.
 *
 * `data/cyberchess-daily-leaderboard.json` лежит в репозитории и уезжает в
 * образ при выкатке. Тест, который решает задачу и не подменил каталог данных,
 * записывает своих игроков ПРЯМО ТУДА — и на проде рядом с живыми людьми
 * оказываются `u-fake` и `u-honest` с четырьмя сотнями очков. Это уже
 * случалось 13.08.2026, в истории есть коммит про удаление синтетических
 * строк из продакшена.
 *
 * Переменная `CYBERCHESS_DAILY_DIR` существует ровно для этого, и десять
 * тестов её задают. Одиннадцатый (написанный 21.08) не задал — и заметить это
 * можно было только по изменившемуся файлу в рабочей копии после прогона.
 * Ни один тест не краснел: каждый проверял своё и был прав.
 *
 * Поэтому проверка здесь не про поведение, а про дисциплину: любой тест,
 * который ОТПРАВЛЯЕТ решение, обязан сначала увести каталог во временный.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TESTS = join(__dirname);
const LB = join(__dirname, "..", "data", "cyberchess-daily-leaderboard.json");

/** Тесты, которые шлют решение задачи дня, то есть вызывают запись. */
function пишущиеТесты(): string[] {
  return readdirSync(TESTS)
    .filter((f) => f.endsWith(".test.ts"))
    .filter((f) => {
      const src = readFileSync(join(TESTS, f), "utf8");
      return src.includes("/api/cyberchess-daily/solve");
    });
}

describe("тесты задачи дня не пачкают боевые данные", () => {
  it("контроль: пишущие тесты вообще найдены", () => {
    // Без этого «все чисты» могло бы означать «список пуст».
    expect(пишущиеТесты().length).toBeGreaterThan(2);
  });

  it("каждый пишущий тест уводит каталог во временный", () => {
    const виновные = пишущиеТесты().filter(
      (f) => !readFileSync(join(TESTS, f), "utf8").includes("CYBERCHESS_DAILY_DIR"),
    );
    expect(
      виновные,
      "эти тесты пишут в отслеживаемую таблицу лидеров: задайте CYBERCHESS_DAILY_DIR временным каталогом",
    ).toEqual([]);
  });

  it("в отслеживаемой таблице лидеров нет тестовых игроков", () => {
    const raw = readFileSync(LB, "utf8");
    // Имена, которые генерирует сам код для безымянных: Player_<userId>.
    for (const мусор of ["u-fake", "u-honest", "u-fast", "u-test"]) {
      expect(raw, `в боевой таблице лидеров тестовый игрок ${мусор}`).not.toContain(мусор);
    }
  });

  it("файл таблицы лидеров остаётся разбираемым", () => {
    const j = JSON.parse(readFileSync(LB, "utf8")) as { leaderboard?: unknown };
    expect(Array.isArray(j.leaderboard), "leaderboard перестал быть списком").toBe(true);
  });
});

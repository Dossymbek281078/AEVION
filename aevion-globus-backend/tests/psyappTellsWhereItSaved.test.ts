import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * PsyApp называет, где сохранены отметка о срыве и профиль.
 *
 * Замер 19.08.2026: ответ был одинаков независимо от того, легла запись в
 * Postgres или в память процесса. Ручка /health при этом честно отдавала
 * db: postgres|memory — то есть ПЛАТФОРМА знать могла, а человек нет.
 *
 * Здесь цена выше, чем в других модулях того же класса: дневник срывов и
 * триггеров и есть продукт, за который платят $19/мес. Потерянная серия
 * воздержания — не строка в базе, а обесцененный месяц работы над собой.
 */

const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "psyappDeps.ts"), "utf8"));

describe("PsyApp не выдаёт временное хранилище за постоянное", () => {
  test("контроль: обе ветки записи на месте", () => {
    // Иначе проверки ниже прошли бы на переписанном файле.
    expect(SRC).toContain("isPsyAppDbReady()");
    expect(SRC).toContain("memRelapse(");
    expect(SRC).toContain("memUpsertUser(");
  });

  test("создание профиля называет хранилище", () => {
    expect(SRC, "ответ снова не различает базу и память").toMatch(
      /streak_days:\s*streakDays\(user\.streak_start_at\),\s*\n\s*storage:\s*isPsyAppDbReady\(\)/,
    );
  });

  test("отметка о срыве называет хранилище", () => {
    expect(SRC, "«fresh start» снова неотличим от настоящего сохранения").toMatch(
      /message:\s*"Streak reset[^"]*",\s*\n\s*storage:\s*isPsyAppDbReady\(\)/,
    );
  });

  test("признак вычисляется тем же вызовом, что выбирал ветку", () => {
    // Посчитанный ПОСЛЕ записи, он вернул бы "db" на восстановившейся базе и
    // соврал снова, только реже. Проверяем, что нигде не появилось иной формы.
    expect(SRC).not.toMatch(/storage:\s*"db"/);
    expect((SRC.match(/storage:\s*isPsyAppDbReady\(\)/g) || []).length).toBe(2);
  });
});

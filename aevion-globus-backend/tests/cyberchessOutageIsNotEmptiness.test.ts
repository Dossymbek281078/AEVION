import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* Серверная половина того же класса дефекта. 13.08.2026.
 *
 * На фронте он выглядит как `catch { setItems([]) }`, а здесь — как
 * `.catch(() => [])` на чтении: отказ базы превращается в пустой список, ручка
 * отвечает 200, и страница подписывает это словами «партий нет», «игроков
 * нет», «у вас 0 Chessy». За два дня так нашлось пять ручек.
 *
 * Лечится это в хранилище (чтение возвращает null вместо пустоты), а здесь
 * стоит сторож на сам идиом: он дешёвый, читается с одного взгляда и ловит
 * возврат к привычке раньше, чем она доедет до экрана.
 */

const ROUTES = "src/routes";

// Ищем подстановку ЗНАЧЕНИЯ: `.catch(() => [])` и `.catch(() => ({ ... }))`.
//
// А вот `.catch(() => {})` — пустой БЛОК, а не значение, и это законный приём
// на записи: запись намеренно не блокирует ответ игроку и её отказ не должен
// ронять запрос. Первая версия шаблона их не различала и краснела на четырёх
// честных строках — сторож, который ругается на правильный код, учит его
// обходить, а не писать лучше.
const SILENT_FALLBACK = /\.catch\(\s*\(\s*\)\s*=>\s*(\[\s*\]|\(\s*\{)/;

function chessRouteFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((n) => /^cyberchess.*\.ts$/.test(n))
    .map((n) => join(ROUTES, n));
}

describe("отказ базы не подменяется пустотой в шахматных ручках", () => {
  const files = chessRouteFiles();

  test("файлы маршрутов вообще найдены", () => {
    // Иначе сторож зелен на пустом множестве и молча ничего не проверяет.
    expect(files.length).toBeGreaterThan(3);
  });

  test("ни одно чтение не подставляет пустоту в catch", () => {
    const guilty: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (SILENT_FALLBACK.test(line)) guilty.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    // Если строка тут появится — это не всегда дефект, но всегда повод
    // объяснить в коде, почему подстановка честна. Молча оставлять нельзя.
    expect(guilty).toEqual([]);
  });

  test("вместо этого чтения умеют отвечать «не знаю»", () => {
    // Обратная сторона: сторож выше проходит и на коде, где чтений нет вовсе.
    // Здесь проверяем, что механизм, которым дефект лечится, на месте.
    const store = readFileSync(join(ROUTES, "cyberchessMatchStore.ts"), "utf8");
    expect(store).toMatch(/function qOrNull/);
    expect(store).toMatch(/Promise<number \| null>|Promise<WalletRow \| null>/);
  });
});

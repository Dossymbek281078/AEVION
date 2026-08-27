import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Один и тот же роутер не монтируется на один путь дважды.
 *
 * Замер 23.08.2026: в index.ts таких пар было ШЕСТЬ — healthai, mapreality,
 * voice-of-earth, deepsan, qpersona, qlife. Поведение при этом правильное:
 * Express отдаёт запрос ПЕРВОМУ совпавшему обработчику, второй не выполняется
 * никогда. Именно поэтому дубль и прожил незамеченным.
 *
 * Опасен он не сегодня, а завтра. Строки выглядят равноправными, и следующая
 * правка — «добавлю сюда planGate» или «здесь нужен ограничитель темпа» —
 * с равной вероятностью попадёт во ВТОРУЮ. Тогда защита будет в коде, в ревью
 * её будет видно, а работать она не будет вовсе. Модуль при этом выглядит
 * закрытым.
 *
 * Это не выдумка про будущее: в devhub дубль маршрута уже давал ровно такой
 * исход — фронтенд читал поле мёртвого обработчика (см. память
 * bug_devhub_github_branches_false_connected).
 *
 * Оставлена ПЕРВАЯ строка каждой пары: рядом с ней стоит объяснение
 * «mount BEFORE planning stubs so dedicated routes win», то есть порядок там
 * осмысленный и нагруженный.
 */

const INDEX = join(__dirname, "..", "src", "index.ts");
const MOUNT = /^\s*app\.use\(\s*"([^"]+)"\s*,\s*([A-Za-z0-9_]+)\s*\)\s*;\s*$/;

function mountsOf(text: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(MOUNT);
    if (!m) return;
    const key = `${m[1]} :: ${m[2]}`;
    if (!found.has(key)) found.set(key, []);
    found.get(key)!.push(i + 1);
  });
  return found;
}

describe("роутер монтируется на путь ровно один раз", () => {
  const text = readFileSync(INDEX, "utf8");
  const mounts = mountsOf(text);

  test("контроль: разбор вообще находит монтирования", () => {
    // Иначе пустая карта дала бы «дублей нет» — ответ на невыполненный поиск.
    expect(mounts.size).toBeGreaterThan(50);
    expect([...mounts.keys()].some((k) => k.startsWith("/api/search"))).toBe(true);
  });

  test("контроль: разбор краснеет на заведомом дубле", () => {
    const fake = [
      'app.use("/api/x", xRouter);',
      'app.use("/api/y", yRouter);',
      'app.use("/api/x", xRouter);',
    ].join("\n");
    const dup = [...mountsOf(fake).entries()].filter(([, v]) => v.length > 1);
    expect(dup).toHaveLength(1);
    expect(dup[0][1]).toEqual([1, 3]);
  });

  test("в index.ts нет ни одной пары, смонтированной дважды", () => {
    const dup = [...mounts.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => `${k} -> строки ${v.join(", ")}`);
    expect(
      dup,
      `второй app.use никогда не выполнится; правка в него будет мёртвой:\n${dup.join("\n")}`,
    ).toEqual([]);
  });
});

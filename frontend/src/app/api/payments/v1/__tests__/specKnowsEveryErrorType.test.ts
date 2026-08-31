import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: каждый тип ошибки, который код умеет отдать, перечислен в спеке.
 *
 * ЗАЧЕМ. Тип — это не украшение, а указание, ЧЬЯ сторона виновата: по нему
 * интегратор решает, повторять запрос или чинить своё тело. Сегодня в код
 * добавился api_error, и если бы спека о нём не знала, клиент получал бы
 * значение, которого нет в контракте, — и разумнее всего для него было бы
 * считать наш ответ поломкой.
 */
const V1 = join(__dirname, "..");
const spec = readFileSync(join(V1, "..", "..", "openapi.json", "route.ts"), "utf8");

function исходники(dir: string): string[] {
  const out: string[] = [];
  for (const i of readdirSync(dir)) {
    if (i === "__tests__") continue;
    const p = join(dir, i);
    if (statSync(p).isDirectory()) out.push(...исходники(p));
    else if (i.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("спека знает каждый тип ошибки из кода", () => {
  it("все типы, встречающиеся в ответах, перечислены в контракте", () => {
    const типы = new Set<string>();
    for (const f of исходники(V1)) {
      const src = readFileSync(f, "utf8");
      // ⚠️ Раньше здесь стоял шаблон /"([a-z_]+_error)"/ — он предполагал,
      // что имя типа кончается на _error. Рядом четыре места отвечали
      // "storage_unavailable", и сторож их не видел вовсе: собственная
      // слепая зона ровно того сорта, который он призван ловить.
      // Теперь берём ЛЮБОЕ значение type внутри объекта error.
      for (const m of src.matchAll(/error:\s*\{[^}]{0,160}?type:\s*"([a-z_]+)"/g)) {
        типы.add(m[1]);
      }
    }

    // Знаменатель: типов заведомо несколько. Пустое множество означало бы
    // сломанный обход, а не отсутствие ошибок в платёжном модуле.
    expect(типы.size, "типов ошибок не найдено — сторож проверял пустоту").toBeGreaterThan(2);

    const неизвестные = [...типы].filter((t) => !spec.includes(`"${t}"`));
    expect(неизвестные, "код отдаёт тип, которого нет в контракте").toEqual([]);
  });
});

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Сторож против сравнения «дата из базы» ⟷ «часы процесса». 19.08.2026.
//
// 18.08 из-за такого сравнения молча не работала доплата зависших начислений
// Chessy. Колонки `TIMESTAMP` (без зоны) драйвер читает как МЕСТНОЕ время
// процесса, и на машине в UTC+5 значение оказывается на пять часов раньше, чем
// Date.now(). Условие «закрыто позже границы» было ложным всегда — механизм
// выключился, не подав ни одного признака.
//
// Шахматы — единственный модуль платформы с колонками без зоны (замер 19.08:
// 9 колонок в трёх файлах, у остальных модулей TIMESTAMPTZ). Значит ловушка
// остаётся здесь, и следующий, кто сравнит такую колонку с Date.now(),
// повторит дефект.
//
// Сторож не запрещает колонки без зоны — он запрещает ЧИТАТЬ их в дату в коде.
// Правильный способ — просить эпоху у самой базы:
//   EXTRACT(EPOCH FROM "endedAt")*1000 AS "endedAtMs"

const ROUTES = path.join(__dirname, "..", "src", "routes");

/** Колонки без зоны, объявленные в шахматных модулях. */
function plainTimestampColumns(): Map<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const f of fs.readdirSync(ROUTES).filter((x) => /^cyberchess.*\.ts$/.test(x))) {
    const src = fs.readFileSync(path.join(ROUTES, f), "utf-8");
    const cols = [...src.matchAll(/"([A-Za-z]+)"\s+TIMESTAMP(?!TZ|\s+WITH)/g)].map((m) => m[1]);
    if (cols.length) byFile.set(f, [...new Set(cols)]);
  }
  return byFile;
}

describe("даты из базы не сравниваются с часами процесса", () => {
  test("колонок без часового пояса не осталось — ловушка убрана в корне", () => {
    // 19.08.2026 все девять колонок переведены на TIMESTAMPTZ, а данные в
    // боевой базе мигрированы (все таблицы были пусты, момент времени сверен
    // до и после). Раньше здесь стояло обратное требование — «колонки есть,
    // знать про ловушку». Требование поменялось на противоположное намеренно:
    // пока тип был без зоны, сторож ниже охранял живую опасность; теперь он
    // охраняет, чтобы её не завели заново.
    const byFile = plainTimestampColumns();
    const names = [...byFile.entries()].map(([f, c]) => `${f}: ${c.join(", ")}`);

    expect(names).toEqual([]);
  });

  test("ни одна такая колонка не превращается в дату прямо в коде", () => {
    const byFile = plainTimestampColumns();
    const allCols = new Set<string>();
    for (const cols of byFile.values()) for (const c of cols) allCols.add(c);

    const offenders: string[] = [];
    for (const f of fs.readdirSync(ROUTES).filter((x) => /^cyberchess.*\.ts$/.test(x))) {
      const src = fs.readFileSync(path.join(ROUTES, f), "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // Комментарии пропускаем: в них эти имена как раз объясняют ловушку, и
        // сторож, краснеющий на объяснении, будет отключён первым же человеком.
        const code = line.replace(/\/\/.*$/, "").trim();
        if (!code || code.startsWith("*") || code.startsWith("/*")) return;
        for (const col of allCols) {
          const re = new RegExp(String.raw`(new Date|Date\.parse)\s*\([^)]*\b${col}\b`);
          if (re.test(code)) offenders.push(`${f}:${i + 1} — ${col}: ${code.slice(0, 70)}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 24.10.2026 15:3x, прод ab343d42f: PATCH /api/deepsan/tasks/:id отвечал 500 на ЛЮБУЮ правку в режиме БД — в шаблонной строке
 * запроса стояло `WHERE id = ${idx} AND owner_id = ${idx + 1}` без `$` перед фигурной скобкой: в SQL уезжали литералы
 * «id = 2 AND owner_id = 3», pg падал на числе параметров. Сторож двух гостей этого не видел (память, не БД); прибор на проде
 * поймал только как «PATCH чужой → 500». Сторож: в src/routes/*.ts и src/lib/*.ts нет сравнений/присваиваний в SQL вида
 * `= ${имя}` или `= ${имя + N}` — плейсхолдер pg обязан быть `$${…}` (или `$1`). Контроль: образец с ошибкой — красный.
 */
const ROOTS = ["src/routes", "src/lib"].map((d) => join(process.cwd(), d));
// Исключение — конфигурационные SET, которые pg не параметризует (SET statement_timeout = N, SET search_path = схема):
// там подстановка литерала/идентификатора законна (dbPool.ts, devhubDbProvision.ts).
const BAD = /\b(WHERE|AND|OR|SET|VALUES\s*\(|,)\s*(?!statement_timeout\b|search_path\b|lock_timeout\b|idle_in_transaction_session_timeout\b)"?\w+"?\s*=\s*\$\{(?!\$)[A-Za-z_][\w.]*(\s*\+\s*\d+)?\}/g;

export function badPlaceholders(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  BAD.lastIndex = 0;
  while ((m = BAD.exec(src))) out.push(m[0]);
  return out;
}

function tsFiles(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(tsFiles(p));
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("SQL-плейсхолдеры в шаблонных строках — только $${n}, не ${n} (иначе литералы и 500)", () => {
  it("КОНТРОЛЬ: образец с ошибкой красный, исправленный — зелёный", () => {
    expect(badPlaceholders("`UPDATE t SET a = $1 WHERE id = ${idx} AND owner_id = ${idx + 1}`")).toHaveLength(2);
    expect(badPlaceholders("`UPDATE t SET a = $1 WHERE id = $${idx} AND owner_id = $${idx + 1}`")).toHaveLength(0);
    expect(badPlaceholders("`SELECT * FROM t WHERE id = $2 AND owner_id = $3`")).toHaveLength(0);
  });

  it("в src/routes и src/lib нарушений 0", () => {
    const files = ROOTS.flatMap((r) => tsFiles(r));
    expect(files.length, "файлов просмотрено").toBeGreaterThan(50);
    const bad = files.flatMap((f) => badPlaceholders(readFileSync(f, "utf8")).map((h) => `${f.replace(process.cwd(), "")}: ${h}`));
    expect(bad, "плейсхолдеры без $").toEqual([]);
  });
});

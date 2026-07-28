import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* Директива "use client" обязана быть ПЕРВЫМ выражением файла. Если перед ней
   окажется хоть один импорт, она перестаёт быть директивой и становится обычным
   строковым выражением — файл молча превращается в серверный компонент, хотя
   построен на хуках.

   Тест написан по факту: 28.07.2026 я сам сдвинул директиву в OpeningRepertoire.tsx,
   добавив импорт в начало файла. `tsc --noEmit` прошёл. Все 504 теста прошли.
   Поймало только чтение первых пяти строк глазами. Значит нужна проверка, которая
   смотрит именно на это.

   Комментарии перед директивой допустимы — они не выражения. */

const DIR = join(__dirname, "..");

/** Убирает комментарии в начале файла и возвращает первое непустое выражение. */
function firstStatement(src: string): string {
  let i = 0;
  while (i < src.length) {
    // пробелы и переводы строк
    if (/\s/.test(src[i])) { i++; continue }
    // строчный комментарий
    if (src.startsWith("//", i)) {
      const nl = src.indexOf("\n", i);
      if (nl === -1) return "";
      i = nl + 1;
      continue;
    }
    // блочный комментарий
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) return "";
      i = end + 2;
      continue;
    }
    break;
  }
  const rest = src.slice(i);
  const nl = rest.indexOf("\n");
  return (nl === -1 ? rest : rest.slice(0, nl)).trim();
}

const sourceFiles = readdirSync(DIR)
  .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".d.ts"))
  .map((f) => ({ name: f, src: readFileSync(join(DIR, f), "utf8") }));

const clientFiles = sourceFiles.filter((f) => /^\s*["']use client["'];?\s*$/m.test(f.src));

describe('директива "use client"', () => {
  it("в модуле вообще есть клиентские файлы — иначе тест ничего не проверяет", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  for (const f of clientFiles) {
    it(`${f.name}: директива стоит первым выражением`, () => {
      expect(firstStatement(f.src)).toMatch(/^["']use client["']/);
    });
  }
});

describe("разбор первого выражения", () => {
  it("пропускает блочный комментарий перед директивой", () => {
    expect(firstStatement('/* про файл */\n"use client";\nimport x from "y";')).toBe('"use client";');
  });

  it("пропускает строчные комментарии", () => {
    expect(firstStatement('// раз\n// два\n"use client";')).toBe('"use client";');
  });

  it("видит импорт, оказавшийся перед директивой — ровно эта ошибка и была", () => {
    expect(firstStatement('import { a } from "b";\n"use client";')).not.toMatch(/use client/);
  });
});

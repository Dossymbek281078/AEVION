import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Файл страницы Next вправе экспортировать только default и небольшой набор
   служебных полей. Любой другой экспорт валит `next build` на сгенерированном
   валидаторе — и ТОЛЬКО там: ни `tsc --noEmit`, ни тесты его не замечают.

   Тест написан по факту: 27.07.2026 я экспортировал из page.tsx функцию fmt,
   чтобы покрыть её тестом. Тест позеленел, tsc позеленел, а сборка упала бы.
   Обнаружилось это лишь через сутки, когда появились сгенерированные типы.

   Родственная проверка — useClientDirective.test.ts. Общее у них то, что система
   типов такие ошибки не видит по построению: дело не в типах, а в том, ЧТО и ГДЕ
   объявлено. */

const PAGE = join(__dirname, "..", "page.tsx");
const src = readFileSync(PAGE, "utf8");

/** Что Next разрешает экспортировать из файла страницы. */
const ALLOWED = new Set([
  "default",
  "metadata",
  "generateMetadata",
  "viewport",
  "generateViewport",
  "generateStaticParams",
  "dynamic",
  "dynamicParams",
  "revalidate",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
  "config",
]);

/** Имена всех экспортов файла — объявления и списки `export { a, b }`. */
function exportedNames(code: string): string[] {
  const out: string[] = [];
  /* `export default function Имя(){}` — это экспорт ИМЕНИ "default", а не "Имя":
     снаружи такой файл отдаёт только default. Первая версия разборщика считала имя
     функции лишним экспортом и обвиняла страницу в том, чего в ней нет. */
  const decl = /^\s*export\s+(default\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(code))) out.push(m[1] ? "default" : m[2]);
  if (/^\s*export\s+default\s/m.test(code)) out.push("default");
  const list = /^\s*export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(code))) {
    for (const part of m[1].split(",")) {
      const name = part.split(/\s+as\s+/).pop()!.trim();
      if (name) out.push(name);
    }
  }
  return [...new Set(out)];
}

describe("экспорты файла страницы", () => {
  it("страница вообще что-то экспортирует — иначе тест ничего не проверяет", () => {
    expect(exportedNames(src).length).toBeGreaterThan(0);
  });

  it("экспортируется только то, что разрешает Next", () => {
    const extra = exportedNames(src).filter((n) => !ALLOWED.has(n));
    // Сообщение важнее самого падения: оно называет, что именно надо вынести.
    expect(
      extra,
      `Лишние экспорты из page.tsx: ${extra.join(", ")}. Next разрешает только ${[...ALLOWED].join(", ")}. Вынеси это в отдельный модуль и импортируй — как сделано с clockFormat.ts.`,
    ).toEqual([]);
  });

  it("страница экспортирует default", () => {
    expect(exportedNames(src)).toContain("default");
  });
});

describe("разбор экспортов", () => {
  it("видит экспорт функции", () => {
    expect(exportedNames('export function fmt(){}')).toContain("fmt");
  });

  it("видит экспорт в списке и переименование", () => {
    const names = exportedNames("const a=1;\nexport { a as helper };");
    expect(names).toContain("helper");
  });

  it("видит default", () => {
    expect(exportedNames("export default function Page(){}")).toContain("default");
  });

  it("не считает экспортом слово export внутри строки", () => {
    expect(exportedNames('const s = "export function fake(){}";')).toEqual([]);
  });

  it("имя функции при export default не считается отдельным экспортом", () => {
    // первая версия разборщика спотыкалась ровно здесь и обвиняла страницу зря
    expect(exportedNames("export default function CyberChessPage(){}")).toEqual(["default"]);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Два способа сломать страницу одним именем — оба случились в одном коммите 28.07.2026
 * и жили в ветке до 10.08, пока я не запустил `tsc`.
 *
 * 1. ВРЕМЕННАЯ МЁРТВАЯ ЗОНА. `searchBank` объявили выше по файлу, чем состояния
 *    `pzFilterTheme/Phase/Rating`, которые он перечисляет в зависимостях. Тело
 *    колбэка выполнится когда-нибудь потом, а вот список зависимостей вычисляется
 *    при КАЖДОМ рендере — то есть `const` читался до объявления, ReferenceError, и
 *    белый экран на всём модуле шахмат.
 *
 * 2. ПЕРЕКРЫТИЕ ИМПОРТА. Состояние назвали `poolSize`, а из `variants` уже
 *    импортирована функция `poolSize(pool, color)` — пул сброшенных фигур в
 *    крейзихаусе. Внутри компонента состояние перекрыло функцию, и четыре её вызова
 *    стали «poolSize is not a function».
 *
 * Тесты видит `tsc`, но `tsc` на этой ветке не запускали неделю: набор тестов был
 * зелёным, потому что страницу целиком он не рендерит. Поэтому сторож живёт здесь,
 * рядом с тем, что запускают.
 */

const PAGE = join(__dirname, "..", "page.tsx");
const raw = readFileSync(PAGE, "utf8");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const src = stripComments(raw);
const lineOf = (index: number) => src.slice(0, index).split("\n").length;

/** Имена, привязанные именованными импортами: `import { a, b as c } from "..."`. */
function importedNames(code: string): Set<string> {
  const out = new Set<string>();
  const re = /^\s*import\s*(?:type\s*)?\{([^}]*)\}\s*from/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    for (const part of m[1].split(",")) {
      const name = part.replace(/^\s*type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  return out;
}

/** Состояния компонента: `const[имя,установщик]=useState...` со строкой объявления. */
function stateDecls(code: string): Map<string, number> {
  const out = new Map<string, number>();
  const re = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (!out.has(m[1])) out.set(m[1], lineOf(m.index));
  }
  return out;
}

/** Списки зависимостей хуков: закрывающая `},[a,b])` со строкой. */
function depsLists(code: string): { names: string[]; line: number }[] {
  const out: { names: string[]; line: number }[] = [];
  const re = /\}\s*,\s*\[([^\]]*)\]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
    if (names.length) out.push({ names, line: lineOf(m.index) });
  }
  return out;
}

describe("разборщики", () => {
  it("видит именованные импорты и переименование", () => {
    const n = importedNames('import { poolSize, addToPool as add } from "./variants";');
    expect(n.has("poolSize")).toBe(true);
    expect(n.has("add")).toBe(true);
  });

  it("видит объявление состояния", () => {
    expect([...stateDecls("const[a,sA]=useState(0);").keys()]).toEqual(["a"]);
  });

  it("видит список зависимостей", () => {
    const d = depsLists("const f=useCallback(()=>{},[x,y]);");
    expect(d[0].names).toEqual(["x", "y"]);
  });
});

describe("состояния страницы шахмат", () => {
  const imports = importedNames(src);
  const states = stateDecls(src);

  it("страница вообще разобралась — иначе сторож молчит впустую", () => {
    expect(states.size).toBeGreaterThan(50);
    expect(imports.size).toBeGreaterThan(20);
  });

  it("не перекрывают импортированные имена", () => {
    const shadowed = [...states.keys()].filter((n) => imports.has(n));
    expect(
      shadowed,
      `Состояния перекрывают импорты: ${shadowed.join(", ")}. Внутри компонента импортированная функция станет недоступна, и её вызовы упадут в рантайме. Переименуй состояние.`,
    ).toEqual([]);
  });

  it("не читаются в зависимостях хука раньше своего объявления", () => {
    const early: string[] = [];
    for (const { names, line } of depsLists(src)) {
      for (const n of names) {
        const decl = states.get(n);
        if (decl !== undefined && line < decl) early.push(`${n} (зависимость на ${line}, объявлено на ${decl})`);
      }
    }
    expect(
      early,
      `Список зависимостей вычисляется на каждом рендере, поэтому это ReferenceError и белая страница:\n${early.join("\n")}\nПеренеси хук ниже объявления состояний.`,
    ).toEqual([]);
  });
});

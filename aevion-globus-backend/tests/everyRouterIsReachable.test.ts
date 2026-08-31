import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * У каждого экспортированного роутера есть путь до приложения.
 *
 * Класс, ради которого сторож. При squash-мерже нескольких параллельных веток
 * строка `app.use("/api/...", router)` из `index.ts` ИСЧЕЗАЕТ, а файл маршрута
 * остаётся. Снаружи это выглядит так: код на месте, `git log` его показывает,
 * ручки отвечают 404. Ни типы, ни тесты модуля этого не видят — модуль-то
 * исправен, его просто никто не подключил.
 *
 * Соседний сторож (`routerMountedOnce`) ловит ОБРАТНЫЙ случай — один путь
 * смонтирован дважды. Пропажу он не заметит: путей стало меньше, и все
 * проверки зелёные.
 *
 * ⚠️ Три механизма монтирования, и наивный счёт по одному даёт горы призраков.
 * Замер 29.08.2026 при написании: считая только `app.use(путь, роутер)`,
 * получаешь 43 «неподключённых» из 135 — почти все ложные. Механизмы такие:
 *
 *   1. прямой:      app.use("/api/x", xRouter)
 *   2. с посредником: app.use("/api/x", requireModule("x"), xRouter)
 *   3. вложенный:   buildRouter.use("/documents", documentsRouter)
 *   4. манифестом:  { path: "/api/qventure", router: qventureRouter }
 *
 * Достижимость считается ТРАНЗИТИВНО: роутер подключён, если он подключён к
 * приложению или к роутеру, который сам подключён. Без этого вложенные
 * (billing, documents) выглядят потерянными, хотя работают.
 */

const SRC = join(__dirname, "..", "src");

function allTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules") out.push(...allTsFiles(p));
    } else if (name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

/** Все идентификаторы-роутеры среди аргументов каждого вызова `<владелец>.use(...)`. */
/**
 * Строки-комментарии выбрасываются ДО разбора.
 *
 * Без этого сторож пустой, и проверено это мутацией: в `lib/planGate.ts` в
 * пояснении стоит ровно строка `app.use("/api/qcoreai", …, qcoreaiRouter);`
 * как ПРИМЕР. Разбор считал её настоящим монтированием, поэтому удаление
 * НАСТОЯЩЕЙ строки из `index.ts` сторож не замечал — призрак из комментария
 * держал роутер «достижимым».
 *
 * Убираются только строки, которые ЦЕЛИКОМ комментарий (`//`, `*`, `/*`).
 * Вырезать комментарии регуляркой по всему тексту нельзя: она съедает `//`
 * внутри строковых литералов (адреса), и это уже давало ложное зелёное.
 */
function withoutCommentLines(text: string): string {
  return text
    .split(String.fromCharCode(10))
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join(String.fromCharCode(10));
}

function mountEdges(text: string): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  const head = /([A-Za-z0-9_]+)\.use\(/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(text))) {
    let depth = 1;
    let j = head.lastIndex;
    while (j < text.length && depth > 0) {
      if (text[j] === "(") depth += 1;
      else if (text[j] === ")") depth -= 1;
      j += 1;
    }
    const args = text.slice(head.lastIndex, j - 1);
    for (const id of args.match(/\b[A-Za-z0-9_]*[Rr]outer\b/g) ?? []) {
      edges.push([m[1], id]);
    }
  }
  return edges;
}

/** Записи манифеста вида `{ path: "...", router: xRouter }`. */
function manifestEdges(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of text.matchAll(/router:\s*([A-Za-z0-9_]+)/g)) out.push(["app", m[1]]);
  return out;
}

const files = allTsFiles(SRC);
const edges: Array<[string, string]> = [];
const exported = new Map<string, string>();

for (const p of files) {
  const text = readFileSync(p, "utf8");
  const code = withoutCommentLines(text);
  edges.push(...mountEdges(code));
  if (p.endsWith("moduleManifest.ts")) edges.push(...manifestEdges(code));
  if (p.includes(`${"routes"}`)) {
    for (const m of text.matchAll(/export const ([A-Za-z0-9_]*[Rr]outer)\b/g)) {
      exported.set(m[1], p.slice(p.lastIndexOf("routes")));
    }
  }
}

function reachableFrom(root: string, list: Array<[string, string]>): Set<string> {
  const child = new Map<string, string[]>();
  for (const [owner, r] of list) {
    if (!child.has(owner)) child.set(owner, []);
    child.get(owner)!.push(r);
  }
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    for (const c of child.get(stack.pop()!) ?? []) {
      if (!seen.has(c)) { seen.add(c); stack.push(c); }
    }
  }
  return seen;
}

describe("каждый роутер доступен из приложения", () => {
  test("контроль: разбор вообще находит монтирования", () => {
    expect(edges.length).toBeGreaterThan(100);
    expect(exported.size).toBeGreaterThan(100);
  });

  test("контроль: разбор краснеет, когда монтирование пропало", () => {
    const withoutOne = edges.filter(([, r]) => r !== "qcoreaiRouter");
    expect(reachableFrom("app", withoutOne).has("qcoreaiRouter")).toBe(false);
    expect(reachableFrom("app", edges).has("qcoreaiRouter")).toBe(true);
  });

  test("контроль: вложенные роутеры считаются доступными", () => {
    // billingRouter подключён не к приложению, а к buildRouter
    const reach = reachableFrom("app", edges);
    expect(reach.has("buildRouter")).toBe(true);
    expect(reach.has("billingRouter")).toBe(true);
  });

  test("ни один экспортированный роутер не потерял монтирование", () => {
    const reach = reachableFrom("app", edges);
    const lost = [...exported.entries()]
      .filter(([name]) => !reach.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(
      lost,
      "роутер экспортирован, но ни к чему не подключён — его ручки отвечают 404 при живом коде",
    ).toEqual([]);
  });
});

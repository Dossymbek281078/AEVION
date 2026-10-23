import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * 24.10.2026 00:32: выкатка сайта bf5b867a0 упала на Vercel — Turbopack: «The "use client" directive must be placed
 * before other expressions» в deepsan/components/StatsBar.tsx и TaskCard.tsx (директива стояла после import).
 * Локальные tsc (0) и vitest этого не видят — ловит только next build. Сторож: во всех .tsx/.ts под src/, где есть
 * "use client" / "use server", директива — первое выражение файла (до неё допустимы только комментарии и пустые строки).
 * Контроль: образец с импортом перед директивой — красный.
 */
const ROOT = join(process.cwd(), "src");
function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "__tests__" && e !== "node_modules") files(p, out); }
    else if (/\.(tsx|ts)$/.test(e) && !/\.test\.(tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}
export function directiveMisplaced(src: string): boolean {
  const m = src.match(/^\s*(['"])use (client|server)\1;?/m);
  if (!m) return false;
  const before = src.slice(0, m.index).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").trim();
  return before.length > 0;
}

describe('"use client"/"use server" — первое выражение файла (иначе сборка Vercel падает)', () => {
  it("КОНТРОЛЬ: образец с импортом перед директивой — нарушение; с директивой первой — нет", () => {
    expect(directiveMisplaced('import { x } from "./y";\n"use client";\nexport const a = 1;')).toBe(true);
    expect(directiveMisplaced('// комментарий\n/* блок */\n"use client";\nimport { x } from "./y";')).toBe(false);
    expect(directiveMisplaced('import { x } from "./y";\nexport const a = 1;')).toBe(false);
  });

  it("в src/ нарушений 0 (знаменатель — число файлов с директивой)", () => {
    const all = files(ROOT);
    const withDirective = all.filter((f) => /^\s*['"]use (client|server)['"]/m.test(readFileSync(f, "utf8")));
    expect(withDirective.length, "файлов с директивой").toBeGreaterThan(50);
    const bad = withDirective.filter((f) => directiveMisplaced(readFileSync(f, "utf8"))).map((f) => relative(process.cwd(), f).replace(/\\/g, "/"));
    expect(bad, "директива не первая").toEqual([]);
  });
});

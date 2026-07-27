import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* Дневная цель «Спроси Coach» висела 0/1 навсегда: ключ был объявлен, награда обещана,
   а `bumpDaily("coach")` не вызывался НИ ОДНОГО раза во всём проекте. Ничего не падало —
   цель просто была недостижима. Дефект починен, но класс остаётся: любой новый ключ
   можно объявить и забыть подключить. Здесь объявление сверяется с вызовами. */

const DIR = "src/app/cyberchess";

function sources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") walk(p);
      } else if (/\.tsx?$/.test(e.name)) {
        out.push(p);
      }
    }
  };
  walk(DIR);
  return out;
}

describe("daily goals", () => {
  const declared = (() => {
    const src = readFileSync(join(DIR, "DailyMission.tsx"), "utf8");
    const m = /export function bumpDaily\(key:\s*([^)]+)\)/.exec(src);
    if (!m) throw new Error("не найдено объявление bumpDaily");
    return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  })();

  /* Комментарии вырезаются ПЕРЕД поиском. Без этого проверка бесполезна: в AiCoach.tsx
     рядом с вызовом стоит комментарий, описывающий тот самый прежний дефект, и он один
     удовлетворял бы поиску — тест был бы зелёным даже при закомментированном вызове.
     Проверено мутацией: с комментариями в тексте закомментированный вызов не ловился. */
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const called = (() => {
    const set = new Set<string>();
    for (const f of sources()) {
      const src = stripComments(readFileSync(f, "utf8"));
      for (const m of src.matchAll(/bumpDaily\(\s*"([^"]+)"\s*\)/g)) set.add(m[1]);
    }
    return set;
  })();

  it("declares the goals the mission panel shows", () => {
    expect(declared.length).toBeGreaterThanOrEqual(4);
  });

  it("bumps every declared goal somewhere in the app", () => {
    const dead = declared.filter((k) => !called.has(k));
    expect(dead).toEqual([]);
  });

  it("bumps nothing it has not declared", () => {
    const unknown = [...called].filter((k) => !declared.includes(k));
    expect(unknown).toEqual([]);
  });
});
